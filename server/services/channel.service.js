/**
 * Channel Service — core channel business logic.
 *
 * Functions:
 *   getAllChannels      — paginated list with optional search + category filter
 *   getChannelBySlug   — single channel + recent events
 *   createChannel      — admin only
 *   updateChannel      — admin only
 *   deleteChannel      — admin only
 *   toggleFollow       — student follow / unfollow, keeps counters in sync
 *   getFollowedChannels — channels the authenticated student follows
 */

import mongoose from "mongoose";
import Channel from "../models/Channel.model.js";
import Event   from "../models/Event.model.js";
import User    from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import { parsePagination, buildPaginationMeta } from "../utils/paginate.js";
import { deleteFromCloudinary } from "../utils/upload.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Aggregate the real published-event count for a list of channel IDs.
 *
 * followerCount is stored as a denormalised field seeded with a realistic
 * baseline and kept accurate via atomic $inc / $dec on every follow/unfollow.
 * eventCount is always computed from the live Event collection so it stays
 * accurate when events are added, published, or cancelled.
 */
const buildEventCountMap = async (channelIds) => {
  const ids = channelIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const agg = await Event.aggregate([
    { $match: { channel: { $in: ids }, status: "published" } },
    { $group: { _id: "$channel", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(agg.map((r) => [String(r._id), r.count]));
};

// ─── List ──────────────────────────────────────────────────────────────────────

export const getAllChannels = async (queryParams, requestingUserId = null, isAdmin = false) => {
  const { page, limit, skip } = parsePagination(queryParams.page, queryParams.limit, isAdmin ? 100 : 20);

  // Admins can see inactive channels; students only see active ones.
  const filter = isAdmin ? {} : { isActive: true };
  if (queryParams.search)   filter.$text    = { $search: queryParams.search };
  if (queryParams.category) filter.category = queryParams.category;

  const [total, channels] = await Promise.all([
    Channel.countDocuments(filter),
    Channel.find(filter)
      .sort(queryParams.search ? { score: { $meta: "textScore" } } : { followerCount: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
  ]);

  if (channels.length === 0)
    return { channels: [], pagination: buildPaginationMeta(total, page, limit) };

  const channelIds = channels.map((ch) => ch._id);

  // Compute real event counts + isFollowing flag in parallel.
  const [eventMap, followedSet] = await Promise.all([
    buildEventCountMap(channelIds),
    requestingUserId
      ? User.findById(requestingUserId).select("followedChannels").lean()
          .then((u) => new Set((u?.followedChannels ?? []).map(String)))
      : Promise.resolve(new Set()),
  ]);

  const enriched = channels.map((ch) => {
    const id = String(ch._id);
    return {
      ...ch,
      // followerCount comes from the stored field (seed baseline + $inc updates)
      eventCount:  eventMap[id] ?? 0,
      isFollowing: followedSet.has(id),
    };
  });

  return {
    channels: enriched,
    pagination: buildPaginationMeta(total, page, limit),
  };
};

// ─── Single channel ────────────────────────────────────────────────────────────

export const getChannelBySlug = async (slug, requestingUserId = null) => {
  const channel = await Channel.findOne({ slug, isActive: true })
    .populate("createdBy", "fullName email profilePicture")
    .lean({ virtuals: true });

  if (!channel) throw ApiError.notFound("Channel not found.");

  // Run all data fetches in parallel.
  const [recentEvents, eventMap, followingUser] = await Promise.all([
    // Upcoming published events for this channel (max 6).
    Event.find({ channel: channel._id, status: "published" })
      .sort({ startDate: 1 })
      .limit(6)
      .select("title category startDate endDate coverImage eventType venue onlineLink registrationCount capacity")
      .lean({ virtuals: true }),

    // Real event count from Event collection.
    buildEventCountMap([channel._id]),

    // Is the requesting user following this channel?
    requestingUserId
      ? User.findById(requestingUserId).select("followedChannels").lean()
      : Promise.resolve(null),
  ]);

  const id         = String(channel._id);
  const eventCount = eventMap[id] ?? 0;
  const isFollowing = (followingUser?.followedChannels ?? []).map(String).includes(id);

  // Keep the stored eventCount in sync (background, non-blocking).
  Channel.findByIdAndUpdate(channel._id, { eventCount }).exec().catch(() => {});

  // followerCount is the stored value (seed baseline + real $inc updates).
  return { ...channel, eventCount, recentEvents, isFollowing };
};

// ─── Follow / Unfollow ─────────────────────────────────────────────────────────

export const toggleFollow = async (channelId, userId) => {
  const channel = await Channel.findById(channelId);
  if (!channel || !channel.isActive) throw ApiError.notFound("Channel not found.");

  const user = await User.findById(userId).select("followedChannels");
  if (!user) throw ApiError.notFound("User not found.");

  const alreadyFollowing = user.followedChannels.map(String).includes(String(channelId));

  if (alreadyFollowing) {
    await User.findByIdAndUpdate(userId, { $pull:    { followedChannels: channelId } });
    await Channel.findByIdAndUpdate(channelId, { $inc: { followerCount: -1 } });
    // Return the updated stored count (clamped to 0).
    const updated = await Channel.findById(channelId).select("followerCount").lean();
    return { following: false, followerCount: Math.max(0, updated?.followerCount ?? 0) };
  } else {
    await User.findByIdAndUpdate(userId, { $addToSet: { followedChannels: channelId } });
    await Channel.findByIdAndUpdate(channelId, { $inc: { followerCount: 1 } });
    const updated = await Channel.findById(channelId).select("followerCount").lean();
    return { following: true, followerCount: updated?.followerCount ?? channel.followerCount + 1 };
  }
};

// ─── Followed channels for a student ──────────────────────────────────────────

export const getFollowedChannels = async (userId) => {
  const user = await User.findById(userId).select("followedChannels").lean();
  if (!user) throw ApiError.notFound("User not found.");

  const channels = await Channel.find({
    _id: { $in: user.followedChannels },
    isActive: true,
  })
    .sort({ name: 1 })
    .lean({ virtuals: true });

  if (channels.length === 0) return [];

  const eventMap = await buildEventCountMap(channels.map((c) => c._id));

  return channels.map((ch) => ({
    ...ch,
    eventCount:  eventMap[String(ch._id)] ?? 0,
    isFollowing: true,
  }));
};

// ─── Admin CRUD ────────────────────────────────────────────────────────────────

export const createChannel = async (data, adminId) => {
  const exists = await Channel.findOne({ name: data.name });
  if (exists) throw ApiError.conflict(`A channel named "${data.name}" already exists.`);

  const channel = await Channel.create({ ...data, createdBy: adminId });
  return channel;
};

export const updateChannel = async (channelId, data, replaceAvatar = false) => {
  // Delete the old Cloudinary avatar when a new one is being uploaded.
  if (replaceAvatar) {
    const existing = await Channel.findById(channelId).select("avatar").lean();
    if (existing?.avatar?.publicId) {
      await deleteFromCloudinary(existing.avatar.publicId).catch(() => {});
    }
  }
  const channel = await Channel.findByIdAndUpdate(channelId, data, { new: true, runValidators: true });
  if (!channel) throw ApiError.notFound("Channel not found.");
  return channel;
};

export const deleteChannel = async (channelId) => {
  const channel = await Channel.findByIdAndUpdate(channelId, { isActive: false }, { new: true });
  if (!channel) throw ApiError.notFound("Channel not found.");
};
