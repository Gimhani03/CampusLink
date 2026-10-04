/**
 * Recommendation Service — weighted multi-signal event scoring engine.
 *
 * ─── Algorithm overview ───────────────────────────────────────────────────────
 *
 * Phase 1 — Signal gathering (3 parallel DB reads):
 *   a) Student's declared interests          (from User document)
 *   b) Past registration history             (from Registration collection)
 *   c) Followed channel IDs                  (architecture-ready; Channel model
 *                                             not yet built — returns [] for now)
 *
 * Phase 2 — Candidate filtering (MongoDB $match):
 *   - status: "published"
 *   - startDate: > now  (exclude past and ongoing events)
 *   - _id: not in already-registered event IDs
 *
 * Phase 3 — Scoring (MongoDB $addFields pipeline):
 *   All arithmetic runs inside MongoDB using $setIntersection, $size, $cond,
 *   $switch, and $multiply. No event documents are loaded into Node.js for
 *   scoring. The aggregation returns pre-scored, pre-sorted, paginated results.
 *
 * Phase 4 — Post-processing (Node.js):
 *   matchReasons strings are generated in JavaScript because string
 *   interpolation is far cleaner in JS than in MongoDB expressions.
 *
 * Phase 5 — Caching:
 *   Results are cached per student for 5 minutes to avoid re-running the
 *   full aggregation on every page load. The cache is invalidated when the
 *   student's interests change or they register for a new event.
 *
 * ─── Scoring weights ──────────────────────────────────────────────────────────
 *
 *   interestPerTag   : 10  (explicit preference — strongest signal)
 *   pastCategory     :  8  (revealed category preference)
 *   pastTagPerMatch  :  6  (revealed tag preference)
 *   channel          : 15  (explicit follow — very strong signal)
 *   featured         :  5  (admin-curated quality)
 *   popularityMax    :  8  (social proof, capped to prevent monopoly)
 *   urgency7days     :  4  (temporal relevance — starts within a week)
 *   urgency30days    :  2  (mild temporal relevance)
 *
 * ─── Graceful degradation ─────────────────────────────────────────────────────
 *
 *   A new student with no interests and no registration history receives
 *   recommendations ordered by: featured → popularity → upcoming urgency.
 *   This provides a reasonable discovery experience on day 1.
 */

import mongoose from "mongoose";
import Event from "../models/Event.model.js";
import Registration from "../models/Registration.model.js";
import * as cache from "../utils/simpleCache.js";
import { parsePagination, buildPaginationMeta } from "../utils/paginate.js";
import { isExternalStudent } from "../utils/eventAudience.js";

// ─── Scoring weights ──────────────────────────────────────────────────────────

const W = {
  interestPerTag:   10,
  pastCategory:      8,
  pastTagPerMatch:   6,
  channel:          15,
  featured:          5,
  popularityDivisor: 10, // registrationCount / 10 → raw popularity score
  popularityMax:     8,  // cap to prevent viral events monopolising results
  urgency7days:      4,
  urgency30days:     2,
};

// Cache TTL: 5 minutes per student.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheKey = (studentId) => `recommendations:${studentId}`;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Builds human-readable match reason strings in Node.js.
 * Called after the aggregation returns results.
 *
 * @param {object}   event              Aggregated event document.
 * @param {string[]} studentInterests   Student's declared interests.
 * @param {string[]} pastCategories     Categories of previously attended events.
 * @returns {string[]}
 */
const buildMatchReasons = (event, studentInterests, pastCategories) => {
  const reasons = [];
  const { scoreBreakdown, tags = [], isFeatured, registrationCount, startDate } = event;

  // ── Interest match ────────────────────────────────────────────────────────
  const interestMatches = tags.filter((t) => studentInterests.includes(t));
  if (interestMatches.length > 0) {
    const displayed = interestMatches.slice(0, 3).join(", ");
    reasons.push(
      interestMatches.length === 1
        ? `Matches your interest: ${displayed}`
        : `Matches your interests: ${displayed}`
    );
  }

  // ── Past behaviour ────────────────────────────────────────────────────────
  const hasPastBehaviour =
    (scoreBreakdown?.pastCategoryMatch ?? 0) > 0 ||
    (scoreBreakdown?.pastTagMatch ?? 0) > 0;

  if (hasPastBehaviour) {
    if (pastCategories.includes(event.category)) {
      reasons.push(`Based on ${event.category} events you've attended`);
    } else {
      reasons.push("Similar to events you've attended");
    }
  }

  // ── Channel follow ────────────────────────────────────────────────────────
  if ((scoreBreakdown?.channelFollow ?? 0) > 0) {
    reasons.push("From a channel you follow");
  }

  // ── Featured ──────────────────────────────────────────────────────────────
  if (isFeatured) {
    reasons.push("Featured event");
  }

  // ── Popularity ────────────────────────────────────────────────────────────
  if (registrationCount >= 10) {
    reasons.push(`${registrationCount} students already registered`);
  }

  // ── Urgency ───────────────────────────────────────────────────────────────
  if ((scoreBreakdown?.urgency ?? 0) > 0) {
    const daysUntil = Math.ceil(
      (new Date(startDate) - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil <= 1) {
      reasons.push("Starting tomorrow — register now");
    } else if (daysUntil <= 7) {
      reasons.push(`Starting soon — ${daysUntil} days away`);
    } else {
      reasons.push(`Starting in ${daysUntil} days`);
    }
  }

  // ── Fallback for zero-score events ────────────────────────────────────────
  if (reasons.length === 0) {
    reasons.push("Upcoming event you might enjoy");
  }

  return reasons;
};

/**
 * Constructs the MongoDB scoring pipeline stages from signal data.
 * Keeping this as a pure function makes the stages testable in isolation.
 *
 * @param {object} signals
 * @param {string[]} signals.studentInterests
 * @param {string[]} signals.pastTags
 * @param {string[]} signals.pastCategories
 * @param {string[]} signals.followedChannelIds  ObjectId[]
 * @returns {object[]}  Array of aggregation pipeline stage objects.
 */
const buildScoringStages = ({ studentInterests, pastTags, pastCategories, followedChannelIds }) => {
  const now = new Date();
  const sevenDaysMs  = 7  * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  // Helper: $size of $setIntersection, safely handling empty result arrays.
  const intersectionSize = (fieldRef, valueArray) =>
    valueArray.length > 0
      ? { $size: { $ifNull: [{ $setIntersection: [fieldRef, valueArray] }, []] } }
      : 0; // Constant 0 when array is empty — avoids unnecessary DB work.

  return [
    // ── Stage A: compute raw signal counts ───────────────────────────────────
    {
      $addFields: {
        _interestTagMatches:  intersectionSize("$tags", studentInterests),
        _pastTagMatches:      intersectionSize("$tags", pastTags),
        _pastCategoryMatch:   pastCategories.length > 0
          ? { $cond: [{ $in: ["$category", pastCategories] }, 1, 0] }
          : 0,
        _channelMatch:        followedChannelIds.length > 0
          ? { $cond: [{ $in: ["$channel", followedChannelIds.map((id) => new mongoose.Types.ObjectId(id))] }, 1, 0] }
          : 0,
      },
    },

    // ── Stage B: compute score breakdown sub-document ────────────────────────
    {
      $addFields: {
        scoreBreakdown: {
          interestMatch: { $multiply: ["$_interestTagMatches", W.interestPerTag] },

          pastTagMatch: { $multiply: ["$_pastTagMatches", W.pastTagPerMatch] },

          pastCategoryMatch: { $multiply: ["$_pastCategoryMatch", W.pastCategory] },

          channelFollow: { $multiply: ["$_channelMatch", W.channel] },

          // Popularity: floor(registrationCount / divisor), capped at max.
          popularity: {
            $min: [
              {
                $floor: {
                  $divide: [{ $ifNull: ["$registrationCount", 0] }, W.popularityDivisor],
                },
              },
              W.popularityMax,
            ],
          },

          featured: { $cond: [{ $eq: ["$isFeatured", true] }, W.featured, 0] },

          // Urgency: based on how far in the future the event is.
          urgency: {
            $switch: {
              branches: [
                {
                  case: { $lte: [{ $subtract: ["$startDate", now] }, sevenDaysMs] },
                  then: W.urgency7days,
                },
                {
                  case: { $lte: [{ $subtract: ["$startDate", now] }, thirtyDaysMs] },
                  then: W.urgency30days,
                },
              ],
              default: 0,
            },
          },
        },
      },
    },

    // ── Stage C: sum breakdown into a single relevance score ─────────────────
    {
      $addFields: {
        relevanceScore: {
          $add: [
            "$scoreBreakdown.interestMatch",
            "$scoreBreakdown.pastTagMatch",
            "$scoreBreakdown.pastCategoryMatch",
            "$scoreBreakdown.channelFollow",
            "$scoreBreakdown.popularity",
            "$scoreBreakdown.featured",
            "$scoreBreakdown.urgency",
          ],
        },
      },
    },
  ];
};

// ─── Exported service function ────────────────────────────────────────────────

/**
 * Returns a personalised, scored, and paginated list of event recommendations
 * for the authenticated student.
 *
 * @param {object} student      Full User document from req.user.
 * @param {object} queryParams  { page, limit, refresh }
 * @returns {object}            { recommendations, pagination, signals, meta }
 */
export const getRecommendations = async (student, queryParams) => {
  const { page, limit, skip } = parsePagination(queryParams.page, queryParams.limit, 50);
  const forceRefresh = queryParams.refresh === "true";
  const key = cacheKey(student._id.toString());

  // ── Cache check (page 1 only, to avoid caching all pages) ────────────────
  if (!forceRefresh && page === 1) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  // ── Phase 1: gather signals in parallel ───────────────────────────────────
  const [pastRegistrations, /* followedChannels would be fetched here */] =
    await Promise.all([
      Registration.find({ student: student._id, status: { $ne: "cancelled" } })
        .populate("event", "category tags")
        .lean(),
      // Channel.find({ followers: student._id }).select("_id").lean()
      //   → returns [] until Channel module is built
      Promise.resolve([]),
    ]);

  const studentInterests   = student.interests ?? [];
  const registeredEventIds = pastRegistrations
    .map((r) => r.event?._id)
    .filter(Boolean);
  const pastCategories = [
    ...new Set(pastRegistrations.map((r) => r.event?.category).filter(Boolean)),
  ];
  const pastTags = [
    ...new Set(pastRegistrations.flatMap((r) => r.event?.tags ?? [])),
  ];
  const followedChannelIds = []; // populated once Channel module is built

  // ── Phase 2: build aggregation pipeline ───────────────────────────────────
  const matchStage = {
    $match: {
      status:   "published",
      startDate: { $gt: new Date() },
      ...(isExternalStudent(student) && { audienceScope: "inter_university" }),
      ...(registeredEventIds.length > 0 && {
        _id: { $nin: registeredEventIds },
      }),
    },
  };

  const scoringStages = buildScoringStages({
    studentInterests,
    pastTags,
    pastCategories,
    followedChannelIds,
  });

  // $facet runs the count branch and data branch in a single aggregation pass.
  const facetStage = {
    $facet: {
      // Count total scored candidates for pagination metadata.
      metadata: [{ $count: "total" }],

      // Sort, paginate, enrich, and project the results.
      results: [
        // Primary sort: relevance DESC; secondary: soonest first.
        { $sort: { relevanceScore: -1, startDate: 1 } },
        { $skip: skip },
        { $limit: limit },

        // Remove internal scoring fields from the response.
        {
          $project: {
            _interestTagMatches:  0,
            _pastTagMatches:      0,
            _pastCategoryMatch:   0,
            _channelMatch:        0,
            __v:                  0,
          },
        },

        // Enrich with creator details.
        {
          $lookup: {
            from:         "users",
            localField:   "createdBy",
            foreignField: "_id",
            as:           "createdBy",
            pipeline:     [{ $project: { fullName: 1, email: 1, profilePicture: 1 } }],
          },
        },
        {
          $unwind: {
            path:                       "$createdBy",
            preserveNullAndEmptyArrays: true,
          },
        },
      ],
    },
  };

  const pipeline = [matchStage, ...scoringStages, facetStage];

  const [facetResult] = await Event.aggregate(pipeline);

  const total   = facetResult?.metadata?.[0]?.total ?? 0;
  const rawEvents = facetResult?.results ?? [];

  // ── Phase 3: post-process — add matchReasons in Node.js ───────────────────
  const recommendations = rawEvents.map((event) => ({
    ...event,
    matchingInterests: (event.tags ?? []).filter((t) => studentInterests.includes(t)),
    matchReasons:      buildMatchReasons(event, studentInterests, pastCategories),
  }));

  // ── Build response payload ─────────────────────────────────────────────────
  const result = {
    recommendations,
    pagination: buildPaginationMeta(total, page, limit),
    // Signal summary for debugging and transparent UX ("Why do I see this?")
    signals: {
      interestsUsed:        studentInterests,
      pastCategoriesUsed:   pastCategories,
      pastTagsUsed:         pastTags.slice(0, 10), // truncated for response size
      followedChannelsUsed: followedChannelIds.length,
      registeredEventsExcluded: registeredEventIds.length,
    },
    meta: {
      scoringWeights: W,
      cachedAt: new Date().toISOString(),
    },
  };

  // ── Cache page 1 results ───────────────────────────────────────────────────
  if (page === 1) {
    cache.set(key, result, CACHE_TTL_MS);
  }

  return result;
};

/**
 * Invalidates the recommendation cache for a specific student.
 * Call this after:
 *   - Student updates their interests.
 *   - Student registers for or cancels a registration.
 *
 * @param {string} studentId
 */
export const invalidateStudentCache = (studentId) => {
  cache.invalidate(cacheKey(studentId.toString()));
};

/**
 * Invalidates all recommendation caches.
 * Call this after a new event is published or an event is cancelled,
 * since the change should surface for all students immediately.
 */
export const invalidateAllCaches = () => {
  cache.invalidateByPrefix("recommendations:");
};
