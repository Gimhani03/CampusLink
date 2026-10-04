/**
 * seed.js — Development database seeder
 *
 * Populates the database with realistic university events for development
 * and testing. Safe to run multiple times — existing seeded events are
 * cleared before re-insertion (identified by the "_seeded" tag).
 *
 * Usage (from the server/ directory):
 *   node seed.js              — seed events + create default admin if needed
 *   node seed.js --clear      — remove all seeded events and exit
 *
 * Requirements:
 *   • MONGO_URI must be set in server/.env
 *   • An admin user must exist, OR the script will create one:
 *       Email:    admin@campuslink.lk
 *       Password: Admin@campuslink1
 */

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  ADMIN_DEFAULT_PASSWORD,
  ADMIN_EMAIL,
  PLATFORM_NAME,
} from "./constants/branding.js";

// ─── Minimal env check ────────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌  MONGO_URI is not set. Copy .env.example to .env and fill in MONGO_URI.");
  process.exit(1);
}

// ─── Inline mini-schemas (avoids importing the full app stack) ────────────────

const userSchema = new mongoose.Schema({
  fullName:       { type: String, required: true },
  email:          { type: String, required: true, unique: true, lowercase: true },
  studentId:      { type: String, default: "ADMIN-001" },
  degree:         { type: String, default: "Administration" },
  batch:          { type: String, default: "2024" },
  whatsappNumber: { type: String, default: "" },
  interests:      { type: [String], default: [] },
  password:       { type: String, required: true, select: false },
  role:           { type: String, enum: ["student", "admin"], default: "student" },
  profilePicture: { url: { type: String, default: "" }, publicId: { type: String, default: "" } },
  refreshToken:   { type: String, default: null, select: false },
}, { timestamps: true });

const eventSchema = new mongoose.Schema({
  title:                 { type: String, required: true },
  description:           { type: String, required: true },
  coverImage:            { url: { type: String, default: "" }, publicId: { type: String, default: "" } },
  category:              { type: String, required: true },
  tags:                  { type: [String], default: [] },
  organizer:             { type: String, required: true },
  channel:               { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
  eventType:             { type: String, required: true },
  venue:                 {
    name:    { type: String, default: "" },
    address: { type: String, default: "" },
    mapLink: { type: String, default: "" },
  },
  onlineLink:            { type: String, default: "" },
  startDate:             { type: Date, required: true },
  endDate:               { type: Date, required: true },
  registrationDeadline:  { type: Date, default: null },
  capacity:              { type: Number, default: null },
  registrationCount:     { type: Number, default: 0 },
  registrationMode:      { type: String, default: "individual" },
  audienceScope:         { type: String, default: "campus" },
  minTeamSize:           { type: Number, default: null },
  maxTeamSize:           { type: Number, default: null },
  registrationQuestions: { type: Array,  default: [] },
  status:                { type: String, default: "draft" },
  isFeatured:            { type: Boolean, default: false },
  createdBy:             { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

const channelSchema = new mongoose.Schema({
  name:          { type: String, required: true, unique: true },
  slug:          { type: String, required: true, unique: true, lowercase: true },
  description:   { type: String, default: "" },
  avatar:        { url: { type: String, default: "" }, publicId: { type: String, default: "" } },
  coverImage:    { url: { type: String, default: "" }, publicId: { type: String, default: "" } },
  category:      { type: String, required: true },
  organizer:     { type: String, default: "" },
  followerCount: { type: Number, default: 0 },
  eventCount:    { type: Number, default: 0 },
  isVerified:    { type: Boolean, default: false },
  isActive:      { type: Boolean, default: true },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

const registrationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  event:   { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  status:  { type: String, default: "confirmed" },
}, { timestamps: true });

const User         = mongoose.models.User         || mongoose.model("User",         userSchema);
const Event        = mongoose.models.Event        || mongoose.model("Event",        eventSchema);
const Channel      = mongoose.models.Channel      || mongoose.model("Channel",      channelSchema);
const Registration = mongoose.models.Registration || mongoose.model("Registration", registrationSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const days = (n) => new Date(Date.now() + n * 86_400_000);

const img = (id, w = 800, h = 450) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80`;

// ─── Channel seed data ────────────────────────────────────────────────────────

// followerCount = realistic seed baseline (represents existing subscribers before
// the app launched). Every real Follow/Unfollow action in the app increments /
// decrements this value via atomic $inc, so it stays accurate over time.
// eventCount is NOT seeded — it is always computed from real Event documents.
const buildChannels = (adminId) => [
  {
    name: "IEEE Student Branch — UoM",
    slug: "ieee-student-branch-uom",
    description: "The official IEEE Student Branch of the University of Moratuwa. We host technical workshops, competitions, and industry networking sessions on AI, IoT, robotics, and embedded systems.",
    coverImage: { url: img("1540575467063-178a50c2df87"), publicId: "" },
    category: "technology",
    organizer: "IEEE Student Branch — University of Moratuwa",
    followerCount: 312,
    isVerified: true,
    createdBy: adminId,
  },
  {
    name: "CS Faculty — UoC",
    slug: "cs-faculty-uoc",
    description: "Official channel of the Faculty of Computing, University of Colombo. Announcements for hackathons, coding competitions, industry talks, and department events.",
    coverImage: { url: img("1504384308090-c894fdcc538d"), publicId: "" },
    category: "technology",
    organizer: "CS Faculty · University of Colombo",
    followerCount: 489,
    isVerified: true,
    createdBy: adminId,
  },
  {
    name: "Rotaract Club of UoC",
    slug: "rotaract-club-uoc",
    description: "Rotaract Club of the University of Colombo — empowering youth through leadership, community service, and international fellowship events.",
    coverImage: { url: img("1511795409834-ef04bbd61622"), publicId: "" },
    category: "social",
    organizer: "Rotaract Club — University of Colombo",
    followerCount: 274,
    isVerified: true,
    createdBy: adminId,
  },
  {
    name: "Career Development Centre",
    slug: "career-development-centre",
    description: "Official CDC channel — CV workshops, career fairs, employer sessions, and internship drives to connect students with top employers.",
    coverImage: { url: img("1507003211169-0a1dd7228f2d"), publicId: "" },
    category: "career",
    organizer: "Career Development Centre — UoC",
    followerCount: 631,
    isVerified: true,
    createdBy: adminId,
  },
  {
    name: "Arts & Drama Society",
    slug: "arts-drama-society",
    description: "Showcasing student talent through theatre, dance, music, and art exhibitions. From Sinhala drama to contemporary performances — culture lives here.",
    coverImage: { url: img("1514320291840-2e0a9bf2a9ae"), publicId: "" },
    category: "cultural",
    organizer: "Arts & Drama Society — UoC",
    followerCount: 198,
    isVerified: false,
    createdBy: adminId,
  },
  {
    name: "Sports Council — UoC",
    slug: "sports-council-uoc",
    description: "University-wide sports fixtures, inter-faculty tournaments, and fitness events. Covering cricket, football, badminton, swimming and more.",
    coverImage: { url: img("1560272564-d6f9d02fba31"), publicId: "" },
    category: "sports",
    organizer: "Sports Council — University of Colombo",
    followerCount: 352,
    isVerified: true,
    createdBy: adminId,
  },
  {
    name: "ML & AI Research Circle",
    slug: "ml-ai-research-circle",
    description: "A student-run community for Machine Learning and AI enthusiasts. Weekly reading groups, project showcases, guest lectures, and Kaggle sprints.",
    coverImage: { url: img("1677442135703-1234abcd5678"), publicId: "" },
    category: "academic",
    organizer: "ML & AI Research Circle",
    followerCount: 267,
    isVerified: false,
    createdBy: adminId,
  },
  {
    name: "Entrepreneurship & Innovation Hub",
    slug: "entrepreneurship-innovation-hub",
    description: "Startup pitch nights, design sprints, mentoring sessions, and connections to angel investors and VCs. Build your venture from idea to MVP.",
    coverImage: { url: img("1559136555-9303baea8ebd"), publicId: "" },
    category: "career",
    organizer: "E&I Hub — University of Colombo",
    followerCount: 183,
    isVerified: false,
    createdBy: adminId,
  },
];

// Map: channel slug → event titles that belong to it
const CHANNEL_EVENT_MAP = {
  "ieee-student-branch-uom":        ["IEEE Tech Summit 2026"],
  "cs-faculty-uoc":                 ["HackFest 2026 — 48h University Hackathon"],
  "rotaract-club-uoc":              ["Rotaract Colombo District Assembly"],
  "career-development-centre":      ["CV Clinic & LinkedIn Optimisation", "TechCareers Fair 2026"],
  "arts-drama-society":             ["Inter-Faculty Drama Competition 2026"],
  "sports-council-uoc":             ["Inter-Faculty Cricket Championship 2026", "Annual Sports Meet 2026"],
  "ml-ai-research-circle":          ["Machine Learning Foundations Workshop"],
  "entrepreneurship-innovation-hub":["Startup Pitch Night — Demo Day 2026"],
};

// ─── Seed data ────────────────────────────────────────────────────────────────

const buildEvents = (adminId) => [
  // ── Technology ─────────────────────────────────────────────────────────────
  {
    title:        "HackFest 2026 — 48h University Hackathon",
    description:  "Sri Lanka's largest inter-university hackathon. Form a team of up to four, pick a problem track (HealthTech, AgriTech, FinTech, or Open Innovation), and build a working prototype in 48 hours. Top three teams share a prize pool of LKR 750,000. Mentors from leading tech companies will be on-site throughout the event.",
    coverImage:   { url: img("1504384308090-c894fdcc538d"), publicId: "" },
    category:     "competition",
    tags:         ["hackathon", "coding", "prizes", "teamwork", "innovation"],
    organizer:    "CS Faculty · University of Colombo",
    eventType:    "in-person",
    venue:        { name: "Engineering Faculty Auditorium", address: "University of Colombo, Reid Avenue, Colombo 03", mapLink: "https://maps.app.goo.gl/example1" },
    startDate:             days(6),
    endDate:               days(8),
    registrationDeadline:  days(3),
    capacity:     50,
    registrationCount: 12,
    registrationMode: "team",
    audienceScope: "inter_university",
    minTeamSize: 2,
    maxTeamSize: 4,
    registrationQuestions: [
      { question: "Which problem track will you tackle?", questionType: "multiple_choice", isRequired: true, options: ["HealthTech", "AgriTech", "FinTech", "Open Innovation"] },
      { question: "Primary programming language?", questionType: "multiple_choice", isRequired: false, options: ["Python", "JavaScript / TypeScript", "Java", "Kotlin / Swift", "Other"] },
      { question: "Do you need a hardware kit (Arduino/Raspberry Pi)?", questionType: "yes_no", isRequired: true, options: [] },
      { question: "Preferred T-shirt size",        questionType: "multiple_choice", isRequired: true,  options: ["XS", "S", "M", "L", "XL", "XXL"] },
    ],
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },
  {
    title:        "IEEE Tech Summit 2026",
    description:  "Three days of keynotes, deep-dive workshops, and open networking sessions with IEEE Fellows, industry leaders, and award-winning researchers. Topics span Artificial Intelligence, Internet of Things, Robotics, and Embedded Systems. Pre-registration is mandatory; selected participants receive a certificate of attendance.",
    coverImage:   { url: img("1540575467063-178a50c2df87"), publicId: "" },
    category:     "technology",
    tags:         ["ieee", "ai", "iot", "robotics", "networking"],
    organizer:    "IEEE Student Branch — University of Moratuwa",
    eventType:    "hybrid",
    venue:        { name: "B.R. De Silva Hall", address: "University of Moratuwa, Moratuwa 10400", mapLink: "" },
    onlineLink:   "https://zoom.us/j/example",
    startDate:             days(10),
    endDate:               days(12),
    registrationDeadline:  days(7),
    capacity:     300,
    registrationCount: 214,
    registrationQuestions: [
      { question: "What is your area of interest?", questionType: "multiple_choice", isRequired: true,  options: ["Artificial Intelligence & ML", "Internet of Things", "Robotics & Automation", "Embedded Systems", "General / All Topics"] },
      { question: "Your current academic level",    questionType: "multiple_choice", isRequired: true,  options: ["Undergraduate Year 1", "Undergraduate Year 2", "Undergraduate Year 3", "Undergraduate Year 4", "Postgraduate", "Other"] },
      { question: "Will you attend in-person or online?", questionType: "multiple_choice", isRequired: true, options: ["In-person", "Online (live stream)", "I will watch the recording later"] },
      { question: "Any dietary requirement for provided meals?", questionType: "text", isRequired: false, options: [] },
    ],
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },
  {
    title:        "Web Dev Bootcamp — React & Node.js",
    description:  "A two-day intensive bootcamp for students who want to go from zero to a full-stack web application. Day 1 covers React fundamentals, hooks, and state management. Day 2 covers Node.js, REST APIs, and MongoDB integration. Participants must bring a laptop. Materials and lunch provided.",
    coverImage:   { url: img("1593642632559-0c6d3fc62b89"), publicId: "" },
    category:     "technology",
    tags:         ["react", "nodejs", "webdev", "bootcamp", "javascript"],
    organizer:    "Software Engineering Society",
    eventType:    "in-person",
    venue:        { name: "IT Lab 3, Faculty of Computing", address: "University of Colombo, Reid Avenue, Colombo 03", mapLink: "" },
    startDate:             days(14),
    endDate:               days(15),
    registrationDeadline:  days(10),
    capacity:     50,
    registrationCount: 44,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },
  {
    title:        "AI & Machine Learning Workshop Series",
    description:  "A six-session online workshop series covering the fundamentals of Machine Learning through to deploying production ML models. Sessions include Python for ML, data wrangling with Pandas, supervised and unsupervised learning, neural networks with TensorFlow, and MLOps basics. Each session is 2 hours; recordings made available afterwards.",
    coverImage:   { url: img("1677442135703-1787eea5ce01"), publicId: "" },
    category:     "technology",
    tags:         ["ai", "machine-learning", "python", "tensorflow", "workshop"],
    organizer:    "Data Science Club",
    eventType:    "online",
    onlineLink:   "https://meet.google.com/example",
    startDate:             days(5),
    endDate:               days(35),
    registrationDeadline:  days(2),
    capacity:     150,
    registrationCount: 98,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },

  // ── Academic ───────────────────────────────────────────────────────────────
  {
    title:        "Research Methods & Academic Writing Seminar",
    description:  "A one-day intensive seminar for postgraduate students preparing their first journal publication. Topics include structuring a literature review, quantitative vs qualitative research design, statistical analysis with SPSS, APA/IEEE citation styles, and responding to peer-review comments. Limited seats; priority given to first-year postgraduate students.",
    coverImage:   { url: img("1434030216411-0b793f4b6ac0"), publicId: "" },
    category:     "academic",
    tags:         ["research", "academic-writing", "postgraduate", "seminar"],
    organizer:    "Faculty of Graduate Studies",
    eventType:    "in-person",
    venue:        { name: "Hector Kobbekaduwa Hall", address: "University of Colombo, Colombo 03", mapLink: "" },
    startDate:             days(8),
    endDate:               days(8),
    registrationDeadline:  days(5),
    capacity:     80,
    registrationCount: 72,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },
  {
    title:        "Inter-Faculty Debate Championship 2026",
    description:  "The annual inter-faculty debate competition returns for its 12th edition. Teams of three will argue British Parliamentary style on motions covering technology, ethics, economics, and social policy. Preliminary rounds run across three weekends; the grand final is held in the Main Auditorium. Best speaker award includes a LKR 50,000 scholarship.",
    coverImage:   { url: img("1559523182-a284c3fb7cff"), publicId: "" },
    category:     "academic",
    tags:         ["debate", "public-speaking", "competition", "inter-faculty"],
    organizer:    "Debating Union — University of Kelaniya",
    eventType:    "in-person",
    venue:        { name: "Main Auditorium, Arts Faculty", address: "University of Kelaniya, Kelaniya", mapLink: "" },
    startDate:             days(12),
    endDate:               days(32),
    registrationDeadline:  days(9),
    capacity:     120,
    registrationCount: 56,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },

  // ── Career ─────────────────────────────────────────────────────────────────
  {
    title:        "TechCareers Fair 2026",
    description:  "The largest university tech career fair in Sri Lanka. Over 40 leading companies — Dialog, WSO2, IFS, Sysco LABS, Virtusa, and more — will be present for on-the-spot interviews, CV reviews, and internship offers. Dress code: smart casual. Bring printed CVs and your student ID.",
    coverImage:   { url: img("1521737711867-e3b97375f902"), publicId: "" },
    category:     "career",
    tags:         ["career", "jobs", "internship", "networking", "tech"],
    organizer:    "Career Guidance Unit",
    eventType:    "in-person",
    venue:        { name: "University Sports Complex", address: "University of Colombo, Colombo 03", mapLink: "" },
    startDate:             days(18),
    endDate:               days(18),
    registrationDeadline:  days(14),
    capacity:     1000,
    registrationCount: 542,
    registrationQuestions: [
      { question: "Which industry are you targeting?", questionType: "multiple_choice", isRequired: true, options: ["Software Engineering", "Data / AI", "Cybersecurity", "Product Management", "UI/UX Design", "DevOps / Cloud", "Other"] },
      { question: "Are you looking for an internship or a full-time role?", questionType: "multiple_choice", isRequired: true, options: ["Internship (part-time)", "Internship (full-time)", "Graduate full-time job", "Both internship and full-time"] },
      { question: "Upload your CV?  (Enter your Google Drive / Dropbox share link)", questionType: "text", isRequired: false, options: [] },
    ],
    status:       "published",
    isFeatured:   true,
    createdBy:    adminId,
  },
  {
    title:        "CV Clinic & LinkedIn Optimisation",
    description:  "A practical two-hour workshop where senior HR professionals and industry mentors review your CV live and provide personalised feedback. Covers crafting a compelling professional summary, quantifying achievements, ATS optimisation, and building a LinkedIn profile that attracts recruiters. Maximum 30 students per session to ensure individual attention.",
    coverImage:   { url: img("1611532736597-de2d4265fba3"), publicId: "" },
    category:     "career",
    tags:         ["cv", "linkedin", "career", "job-hunt", "workshop"],
    organizer:    "Career Guidance Unit",
    eventType:    "in-person",
    venue:        { name: "Seminar Room 2, Admin Building", address: "University of Colombo, Colombo 03", mapLink: "" },
    startDate:             days(4),
    endDate:               days(4),
    registrationDeadline:  days(2),
    capacity:     30,
    registrationCount: 28,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },

  // ── Cultural ───────────────────────────────────────────────────────────────
  {
    title:        "Sooriya Arts Festival 2026",
    description:  "A spectacular three-day cultural extravaganza showcasing traditional and contemporary Sri Lankan arts. Features classical Kandyan dance performances, Baila nights, a photography exhibition titled \"Colours of the Island\", short-film screenings, spoken word poetry, and a student talent show. Entrance is free for all registered university students.",
    coverImage:   { url: img("1514525253161-7a46d19cd819"), publicId: "" },
    category:     "cultural",
    tags:         ["arts", "culture", "dance", "music", "festival"],
    organizer:    "Arts Faculty Students' Union",
    eventType:    "in-person",
    venue:        { name: "Open Air Theatre, Arts Faculty", address: "University of Peradeniya, Kandy", mapLink: "" },
    startDate:             days(22),
    endDate:               days(24),
    registrationDeadline:  days(19),
    capacity:     500,
    registrationCount: 231,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },
  {
    title:        "Traditional Attire Day & Photography Walk",
    description:  "Celebrate Sri Lanka's rich cultural heritage by wearing your traditional attire to campus. The day features a morning photography walk around the university grounds, a traditional food stall, and an evening fashion showcase. Prize for the best-dressed student in each faculty. All are welcome; no pre-registration required.",
    coverImage:   { url: img("1583939003579-730e3918a45a"), publicId: "" },
    category:     "cultural",
    tags:         ["culture", "traditional", "photography", "fashion"],
    organizer:    "Cultural Affairs Committee",
    eventType:    "in-person",
    venue:        { name: "University Green", address: "University of Sri Jayewardenepura, Nugegoda", mapLink: "" },
    startDate:             days(7),
    endDate:               days(7),
    registrationDeadline:  days(5),
    capacity:     null,
    registrationCount: 87,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },

  // ── Sports ─────────────────────────────────────────────────────────────────
  {
    title:        "Inter-University Cricket T20 Tournament",
    description:  "The annual inter-university T20 cricket tournament featuring eight teams from universities across the Western and Central Provinces. Round-robin group stage followed by knockout semifinals and a grand final. Free entry for spectators. Refreshments available on-site.",
    coverImage:   { url: img("1540747913346-19378f3b052e"), publicId: "" },
    category:     "sports",
    tags:         ["cricket", "t20", "sports", "inter-university", "tournament"],
    organizer:    "Physical Education Department",
    eventType:    "in-person",
    venue:        { name: "University Cricket Ground", address: "University of Colombo, Colombo 03", mapLink: "" },
    startDate:             days(15),
    endDate:               days(17),
    registrationDeadline:  days(10),
    capacity:     null,
    registrationCount: 64,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },
  {
    title:        "Fitness & Mental Wellness Challenge",
    description:  "A 30-day challenge combining physical fitness goals with mental wellness practices. Participants log daily workouts, mindfulness minutes, and sleep hours via the challenge app. Weekly group sessions on campus cover yoga, mindful running, and breathing techniques. End-of-month celebration for all completers.",
    coverImage:   { url: img("1517836357463-d25dfeac3438"), publicId: "" },
    category:     "sports",
    tags:         ["fitness", "wellness", "yoga", "mental-health", "challenge"],
    organizer:    "Student Welfare Division",
    eventType:    "hybrid",
    venue:        { name: "University Gym & Sports Hall", address: "University of Moratuwa, Moratuwa 10400", mapLink: "" },
    onlineLink:   "https://challengeapp.example.com",
    startDate:             days(3),
    endDate:               days(33),
    registrationDeadline:  days(1),
    capacity:     200,
    registrationCount: 112,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },

  // ── Competition ─────────────────────────────────────────────────────────────
  {
    title:        "Business Case Competition 2026",
    description:  "Teams of three analyse a real-world business challenge provided by a sponsoring company and present a 15-minute solution to a panel of judges drawn from industry and academia. Past challenges have covered market entry strategy, digital transformation, and sustainability. Winning team receives LKR 200,000 and a mentorship programme.",
    coverImage:   { url: img("1552664730-d307ca884978"), publicId: "" },
    category:     "competition",
    tags:         ["business", "case-study", "strategy", "competition", "finance"],
    organizer:    "Faculty of Management & Finance",
    eventType:    "in-person",
    venue:        { name: "Board Room, Management Faculty", address: "University of Colombo, Colombo 03", mapLink: "" },
    startDate:             days(20),
    endDate:               days(21),
    registrationDeadline:  days(15),
    capacity:     60,
    registrationCount: 36,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },
  {
    title:        "Photography Competition: \"Campus Unseen\"",
    description:  "Submit up to three photographs that capture a side of university life rarely seen in official channels — the late-night study session, the forgotten corner of the library, the caretaker's garden. Judged on composition, storytelling, and technical quality. Winning photos exhibited in the Main Library gallery for three months. Open to all registered students.",
    coverImage:   { url: img("1502920514313-52581002a659"), publicId: "" },
    category:     "competition",
    tags:         ["photography", "art", "competition", "creative", "campus"],
    organizer:    "Photography Society",
    eventType:    "online",
    onlineLink:   "https://submissions.example.com/photo2026",
    startDate:             days(1),
    endDate:               days(21),
    registrationDeadline:  days(1),
    capacity:     null,
    registrationCount: 73,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },

  // ── Social ─────────────────────────────────────────────────────────────────
  {
    title:        "Freshers' Night 2026",
    description:  "The biggest social event of the year, designed to help first-year students meet their seniors and make lifelong friends. Features a welcome address by the Student Union president, live DJ sets, a buffet dinner, games, and a karaoke competition. Formal dress code. Tickets issued on a first-come-first-served basis — do not miss out.",
    coverImage:   { url: img("1496337589254-7e19d01cec44"), publicId: "" },
    category:     "social",
    tags:         ["freshers", "networking", "party", "social", "dinner"],
    organizer:    "Students' Union",
    eventType:    "in-person",
    venue:        { name: "Grand Monarch Hotel, Ballroom", address: "Baseline Road, Colombo 09", mapLink: "" },
    startDate:             days(9),
    endDate:               days(9),
    registrationDeadline:  days(6),
    capacity:     250,
    registrationCount: 198,
    registrationQuestions: [
      { question: "Any dietary restrictions or allergies?", questionType: "multiple_choice", isRequired: true, options: ["None", "Vegetarian", "Vegan", "Halal only", "Gluten-free", "Other (specify below)"] },
      { question: "If 'Other', please describe your dietary requirement", questionType: "text", isRequired: false, options: [] },
      { question: "Preferred T-shirt size (provided to all attendees)", questionType: "multiple_choice", isRequired: true, options: ["XS", "S", "M", "L", "XL", "XXL"] },
      { question: "Emergency contact name & phone number", questionType: "text", isRequired: true, options: [] },
    ],
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },
  {
    title:        "Student Mental Health Awareness Week",
    description:  "Five days of activities, talks, and resources focused on student mental health. Monday: keynote by a clinical psychologist. Tuesday: peer support circle training. Wednesday: art therapy workshop. Thursday: panel discussion with student counsellors. Friday: mindful movie night. All events free. Drop-in counselling also available throughout the week.",
    coverImage:   { url: img("1576765608535-5c20db42c63d"), publicId: "" },
    category:     "social",
    tags:         ["mental-health", "wellbeing", "awareness", "counselling"],
    organizer:    "Student Counselling Centre",
    eventType:    "in-person",
    venue:        { name: "Student Counselling Centre & Annexe", address: "University of Colombo, Colombo 03", mapLink: "" },
    startDate:             days(11),
    endDate:               days(15),
    registrationDeadline:  days(9),
    capacity:     null,
    registrationCount: 145,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },

  // ── Religious ──────────────────────────────────────────────────────────────
  {
    title:        "Vesak Lantern Festival & Dhamma Talk",
    description:  "Join the Buddhist Society for an evening of Vesak celebrations including a lantern-making workshop in the afternoon, a candlelit procession around the campus lake at dusk, and a Dhamma talk on mindfulness in academic life by Venerable Nanda Thero. Refreshments served after the procession. All faiths warmly welcomed.",
    coverImage:   { url: img("1577495508326-19a1b3cf65b1"), publicId: "" },
    category:     "religious",
    tags:         ["vesak", "buddhism", "lantern", "dhamma", "festival"],
    organizer:    "Buddhist Society",
    eventType:    "in-person",
    venue:        { name: "Campus Lake Grounds", address: "University of Peradeniya, Kandy", mapLink: "" },
    startDate:             days(13),
    endDate:               days(13),
    registrationDeadline:  days(11),
    capacity:     null,
    registrationCount: 203,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },

  // ── Other ──────────────────────────────────────────────────────────────────
  {
    title:        "Entrepreneurship & Startup Weekend",
    description:  "54 hours to go from an idea to a validated startup concept. Friday evening: pitching ideas and team formation. Saturday: workshops on customer discovery, lean canvas, and rapid prototyping. Sunday morning: final pitches to a panel of investors and entrepreneurs. Winning teams receive seed funding up to LKR 500,000 from the Innovation Fund.",
    coverImage:   { url: img("1559136555-9303baea8ebd"), publicId: "" },
    category:     "other",
    tags:         ["startup", "entrepreneurship", "innovation", "pitching", "business"],
    organizer:    "Innovation & Entrepreneurship Centre",
    eventType:    "in-person",
    venue:        { name: "Innovation Hub, Engineering Faculty", address: "University of Moratuwa, Moratuwa 10400", mapLink: "" },
    startDate:             days(25),
    endDate:               days(27),
    registrationDeadline:  days(20),
    capacity:     100,
    registrationCount: 67,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },
  {
    title:        "Sustainability & Green Campus Initiative Launch",
    description:  "The university's new Sustainability Office launches its three-year Green Campus Action Plan. The launch event includes a tree-planting ceremony, a student-led e-waste drive, and an exhibition of student sustainability projects. Guest speaker: UN Environment Programme Young Champions of the Earth awardee from Sri Lanka. Light refreshments provided.",
    coverImage:   { url: img("1542601906897-d4f4cd372c30"), publicId: "" },
    category:     "other",
    tags:         ["sustainability", "environment", "green", "climate", "campus"],
    organizer:    "Sustainability Office",
    eventType:    "in-person",
    venue:        { name: "University Senate Building Lawn", address: "University of Colombo, Colombo 03", mapLink: "" },
    startDate:             days(16),
    endDate:               days(16),
    registrationDeadline:  days(13),
    capacity:     300,
    registrationCount: 89,
    status:       "published",
    isFeatured:   false,
    createdBy:    adminId,
  },
];

// ─── Seeder ───────────────────────────────────────────────────────────────────

async function seed() {
  const clearOnly = process.argv.includes("--clear");

  console.log("\n🌱  CampusLink — Database Seeder");
  console.log("─".repeat(50));

  // Connect
  console.log("⏳  Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  console.log("✅  Connected.\n");

  // Clear existing seeded events and channels.
  const deletedEvents = await Event.deleteMany({ tags: "_seeded" });
  if (deletedEvents.deletedCount > 0)
    console.log(`🗑   Removed ${deletedEvents.deletedCount} previously seeded event(s).`);

  const deletedChannels = await Channel.deleteMany({ slug: { $in: Object.keys(CHANNEL_EVENT_MAP) } });
  if (deletedChannels.deletedCount > 0)
    console.log(`🗑   Removed ${deletedChannels.deletedCount} previously seeded channel(s).`);


  if (clearOnly) {
    console.log("\n✅  --clear flag set. Seeded data removed. Exiting.\n");
    await mongoose.disconnect();
    return;
  }

  // Find or create admin user (always reset password so seed is a reliable recovery path)
  let admin = await User.findOne({ role: "admin" });
  const adminPassword = ADMIN_DEFAULT_PASSWORD;
  const hashed = await bcrypt.hash(adminPassword, 12);
  const adminFullName = `${PLATFORM_NAME} Admin`;

  if (!admin) {
    console.log("👤  No admin found. Creating default admin account…");
    admin = await User.create({
      fullName:  adminFullName,
      email:     ADMIN_EMAIL,
      studentId: "ADMIN-001",
      degree:    "Administration",
      batch:     "2024",
      password:  hashed,
      role:      "admin",
    });
    console.log(`✅  Admin created: ${ADMIN_EMAIL}  /  ${adminPassword}`);
  } else {
    await User.findByIdAndUpdate(admin._id, {
      password: hashed,
      isActive: true,
      email: ADMIN_EMAIL,
      fullName: adminFullName,
    });
    console.log(`👤  Admin ready: ${ADMIN_EMAIL}  /  ${adminPassword} (password reset)`);
  }

  // ── Seed channels ──────────────────────────────────────────────────────────
  console.log(`\n⏳  Inserting channels…`);
  const insertedChannels = await Channel.insertMany(buildChannels(admin._id), { ordered: false });
  console.log(`✅  ${insertedChannels.length} channels seeded.`);

  // Build slug → _id map for linking events
  const channelIdBySlug = Object.fromEntries(
    insertedChannels.map((ch) => [ch.slug, ch._id])
  );

  // Build title → channelId map
  const channelByEventTitle = {};
  for (const [slug, titles] of Object.entries(CHANNEL_EVENT_MAP)) {
    for (const title of titles) {
      channelByEventTitle[title] = channelIdBySlug[slug] ?? null;
    }
  }

  // ── Seed events ────────────────────────────────────────────────────────────
  const events = buildEvents(admin._id).map((e) => ({
    ...e,
    tags:    [...(e.tags || []), "_seeded"],
    channel: channelByEventTitle[e.title] ?? null,
  }));

  console.log(`\n⏳  Inserting ${events.length} events…`);
  const inserted = await Event.insertMany(events, { ordered: false });
  console.log(`✅  ${inserted.length} events seeded successfully.`);

  // ── Clean up orphaned registrations ────────────────────────────────────────
  // Runs AFTER new events are inserted so only registrations pointing to truly
  // non-existent events are removed (not the freshly seeded ones).
  const liveEventIds = await Event.distinct("_id");
  const { deletedCount: orphanCount } = await Registration.deleteMany({
    event: { $nin: liveEventIds },
  });
  if (orphanCount > 0)
    console.log(`🗑   Removed ${orphanCount} orphaned registration(s).`);
  console.log();

  // ── Update eventCount on channels ──────────────────────────────────────────
  for (const [slug, titles] of Object.entries(CHANNEL_EVENT_MAP)) {
    const chId = channelIdBySlug[slug];
    if (!chId) continue;
    const count = inserted.filter((e) => String(e.channel) === String(chId)).length;
    if (count > 0) await Channel.findByIdAndUpdate(chId, { eventCount: count });
  }

  // Summary table
  const byCategory = inserted.reduce((acc, e) => {
    const cat = e.category.charAt(0).toUpperCase() + e.category.slice(1);
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  console.log("Category breakdown:");
  Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, count]) => {
      console.log(`  ${"■".repeat(count)} ${cat} (${count})`);
    });

  const featured = inserted.filter((e) => e.isFeatured).length;
  console.log(`\nFeatured events : ${featured}`);
  console.log(`Total inserted  : ${inserted.length}`);
  console.log(`Total channels  : ${insertedChannels.length}`);
  console.log("\n🎉  Seeding complete!\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("\n❌  Seeding failed:", err.message || err);
  process.exit(1);
});
