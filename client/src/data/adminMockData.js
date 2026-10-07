/**
 * Admin Mock Data
 *
 * Matches backend model shapes exactly.
 * Replace with real API calls by swapping these exports for axios calls.
 */

import { subDays, addDays, format } from "date-fns";

// ─── Admin user ───────────────────────────────────────────────────────────────

export const adminUser = {
  _id: "admin_001",
  fullName: "Dr. Kasun Jayawardena",
  email: "admin@uoc.lk",
  role: "admin",
  profilePicture: {
    url: "https://api.dicebear.com/7.x/notionists/svg?seed=Kasun&backgroundColor=f59e0b",
  },
};

// ─── KPI Stats ────────────────────────────────────────────────────────────────

export const adminStats = {
  totalEvents:        { value: 47,    delta: "+12%",  positive: true  },
  totalRegistrations: { value: 8924,  delta: "+23%",  positive: true  },
  activeStudents:     { value: 1243,  delta: "+8%",   positive: true  },
  publishedEvents:    { value: 32,    delta: "+4",    positive: true  },
  cancelledEvents:    { value: 3,     delta: "+1",    positive: false },
  avgCapacityFill:    { value: "74%", delta: "+6pp",  positive: true  },
};

// ─── Registration trend (last 30 days) ───────────────────────────────────────

export const registrationTrend = Array.from({ length: 30 }, (_, i) => ({
  date: format(subDays(new Date(), 29 - i), "MMM d"),
  registrations: Math.floor(
    180 + Math.sin(i * 0.4) * 60 + Math.random() * 80 + (i > 20 ? i * 4 : 0)
  ),
  events: Math.floor(1 + Math.random() * 2),
}));

// ─── Registrations per event (top 8) ─────────────────────────────────────────

export const registrationsPerEvent = [
  { name: "Career Fair",       count: 1400, capacity: 2000, category: "career"     },
  { name: "Cricket Champ.",    count: 3201, capacity: 5000, category: "sports"     },
  { name: "IEEE Tech Summit",  count: 312,  capacity: 500,  category: "technology" },
  { name: "HackThon 2026",     count: 156,  capacity: 200,  category: "competition"},
  { name: "Startup Weekend",   count: 61,   capacity: 80,   category: "career"     },
  { name: "Research Symposium",count: 178,  capacity: 300,  category: "academic"   },
  { name: "Dance Festival",    count: 234,  capacity: 1000, category: "cultural"   },
  { name: "ML Workshop",       count: 47,   capacity: 50,   category: "technology" },
];

// ─── Events by category ───────────────────────────────────────────────────────

export const eventsByCategory = [
  { name: "Technology",  value: 12, color: "#38bdf8" },
  { name: "Career",      value: 8,  color: "#fb923c" },
  { name: "Competition", value: 7,  color: "#f87171" },
  { name: "Cultural",    value: 6,  color: "#c084fc" },
  { name: "Sports",      value: 5,  color: "#34d399" },
  { name: "Academic",    value: 5,  color: "#60a5fa" },
  { name: "Social",      value: 3,  color: "#f472b6" },
  { name: "Other",       value: 1,  color: "#94a3b8" },
];

// ─── Monthly event creation trend ────────────────────────────────────────────

export const monthlyEventCreation = [
  { month: "Jan", created: 3,  published: 2 },
  { month: "Feb", created: 5,  published: 4 },
  { month: "Mar", created: 7,  published: 6 },
  { month: "Apr", created: 4,  published: 3 },
  { month: "May", created: 9,  published: 8 },
  { month: "Jun", created: 11, published: 9 },
  { month: "Jul", created: 8,  published: 6 },
];

// ─── Admin events (full list) ─────────────────────────────────────────────────

export const adminEvents = [
  {
    _id: "ev1",
    title: "HackThon 2026",
    coverImage: { url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=80&h=60&fit=crop" },
    category: "competition",
    eventType: "physical",
    startDate: addDays(new Date(), 5),
    endDate:   addDays(new Date(), 7),
    registrationDeadline: addDays(new Date(), 2),
    capacity: 200,
    registrationCount: 156,
    status: "published",
    isFeatured: true,
    createdAt: subDays(new Date(), 15),
    organizer: "CS Faculty",
  },
  {
    _id: "ev2",
    title: "IEEE Tech Summit 2026",
    coverImage: { url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=80&h=60&fit=crop" },
    category: "technology",
    eventType: "hybrid",
    startDate: addDays(new Date(), 10),
    endDate:   addDays(new Date(), 12),
    registrationDeadline: addDays(new Date(), 6),
    capacity: 500,
    registrationCount: 312,
    status: "published",
    isFeatured: true,
    createdAt: subDays(new Date(), 20),
    organizer: "IEEE Student Branch UOC",
  },
  {
    _id: "ev3",
    title: "Career Fair 2026",
    coverImage: { url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=80&h=60&fit=crop" },
    category: "career",
    eventType: "physical",
    startDate: addDays(new Date(), 3),
    endDate:   addDays(new Date(), 3),
    registrationDeadline: addDays(new Date(), 1),
    capacity: 2000,
    registrationCount: 1400,
    status: "published",
    isFeatured: false,
    createdAt: subDays(new Date(), 30),
    organizer: "Career Guidance Unit",
  },
  {
    _id: "ev4",
    title: "International Dance Festival",
    coverImage: { url: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=80&h=60&fit=crop" },
    category: "cultural",
    eventType: "physical",
    startDate: addDays(new Date(), 14),
    endDate:   addDays(new Date(), 14),
    registrationDeadline: addDays(new Date(), 8),
    capacity: 1000,
    registrationCount: 234,
    status: "published",
    isFeatured: false,
    createdAt: subDays(new Date(), 10),
    organizer: "Arts & Culture Society",
  },
  {
    _id: "ev5",
    title: "UI/UX Design Bootcamp",
    coverImage: { url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=80&h=60&fit=crop" },
    category: "technology",
    eventType: "physical",
    startDate: addDays(new Date(), 7),
    endDate:   addDays(new Date(), 8),
    registrationDeadline: addDays(new Date(), 3),
    capacity: 40,
    registrationCount: 38,
    status: "published",
    isFeatured: false,
    createdAt: subDays(new Date(), 5),
    organizer: "UX Society",
  },
  {
    _id: "ev6",
    title: "Startup Weekend Colombo",
    coverImage: { url: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=80&h=60&fit=crop" },
    category: "career",
    eventType: "physical",
    startDate: addDays(new Date(), 9),
    endDate:   addDays(new Date(), 11),
    registrationDeadline: addDays(new Date(), 4),
    capacity: 80,
    registrationCount: 61,
    status: "published",
    isFeatured: false,
    createdAt: subDays(new Date(), 8),
    organizer: "Business & Entrepreneurship Club",
  },
  {
    _id: "ev7",
    title: "Research Symposium 2026",
    coverImage: { url: "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=80&h=60&fit=crop" },
    category: "academic",
    eventType: "hybrid",
    startDate: addDays(new Date(), 18),
    endDate:   addDays(new Date(), 18),
    registrationDeadline: addDays(new Date(), 12),
    capacity: 300,
    registrationCount: 178,
    status: "published",
    isFeatured: false,
    createdAt: subDays(new Date(), 25),
    organizer: "Faculty of Graduate Studies",
  },
  {
    _id: "ev8",
    title: "Inter-Faculty Cricket Championship",
    coverImage: { url: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=80&h=60&fit=crop" },
    category: "sports",
    eventType: "physical",
    startDate: addDays(new Date(), 20),
    endDate:   addDays(new Date(), 21),
    registrationDeadline: addDays(new Date(), 15),
    capacity: 5000,
    registrationCount: 3201,
    status: "published",
    isFeatured: false,
    createdAt: subDays(new Date(), 40),
    organizer: "Sports Union",
  },
  {
    _id: "ev9",
    title: "Competitive Programming Contest",
    coverImage: { url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=80&h=60&fit=crop" },
    category: "competition",
    eventType: "physical",
    startDate: addDays(new Date(), 2),
    endDate:   addDays(new Date(), 2),
    registrationDeadline: new Date(Date.now() + 16 * 60 * 60 * 1000),
    capacity: 60,
    registrationCount: 54,
    status: "published",
    isFeatured: false,
    createdAt: subDays(new Date(), 7),
    organizer: "CS Guild",
  },
  {
    _id: "ev10",
    title: "Machine Learning Workshop",
    coverImage: { url: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=80&h=60&fit=crop" },
    category: "technology",
    eventType: "physical",
    startDate: addDays(new Date(), 13),
    endDate:   addDays(new Date(), 13),
    registrationDeadline: addDays(new Date(), 5),
    capacity: 50,
    registrationCount: 47,
    status: "published",
    isFeatured: false,
    createdAt: subDays(new Date(), 3),
    organizer: "AI & Data Science Society",
  },
  {
    _id: "ev11",
    title: "Annual Sports Awards Night",
    coverImage: { url: "https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=80&h=60&fit=crop" },
    category: "sports",
    eventType: "physical",
    startDate: addDays(new Date(), 25),
    endDate:   addDays(new Date(), 25),
    registrationDeadline: addDays(new Date(), 20),
    capacity: 500,
    registrationCount: 0,
    status: "draft",
    isFeatured: false,
    createdAt: subDays(new Date(), 1),
    organizer: "Sports Union",
  },
  {
    _id: "ev12",
    title: "Cultural Night 2025",
    coverImage: { url: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=80&h=60&fit=crop" },
    category: "cultural",
    eventType: "physical",
    startDate: subDays(new Date(), 30),
    endDate:   subDays(new Date(), 30),
    registrationDeadline: subDays(new Date(), 35),
    capacity: 800,
    registrationCount: 623,
    status: "completed",
    isFeatured: false,
    createdAt: subDays(new Date(), 60),
    organizer: "Arts & Culture Society",
  },
];

// ─── Registrations (sample across events) ────────────────────────────────────

const degrees = [
  "BSc Computer Science", "BSc Information Technology", "BSc Management",
  "BA Economics", "BSc Mathematics", "LLB Law",
];
const batches = ["2020", "2021", "2022", "2023"];
const statuses = ["confirmed", "confirmed", "confirmed", "confirmed", "waitlisted", "cancelled"];

export const adminRegistrations = Array.from({ length: 48 }, (_, i) => ({
  _id: `reg_${String(i + 1).padStart(3, "0")}`,
  student: {
    _id: `stu_${String(i + 1).padStart(3, "0")}`,
    fullName: [
      "Kasun Perera", "Nimasha Silva", "Tharindu Fernando", "Dilini Wijesinghe",
      "Sachith Bandara", "Piumali Jayawardena", "Ruvini Senanayake", "Hasith Gunaratne",
      "Malsha Dissanayake", "Lahiru Wickramasinghe", "Chandani Kumari", "Isuru Rajapaksha",
      "Oshadi Seneviratne", "Thiwanka Herath", "Navoda Pathirana", "Yasith Karunaratne",
    ][i % 16],
    studentId: `STD/202${1 + (i % 4)}/CS/${String(i + 1).padStart(3, "0")}`,
    email: `student${i + 1}@uoc.lk`,
    degree: degrees[i % degrees.length],
    batch: batches[i % batches.length],
    whatsappNumber: `+94 7${7 + (i % 3)} ${String(100 + i).padStart(7, "0")}`,
  },
  event: adminEvents[i % 10]._id,
  eventTitle: adminEvents[i % 10].title,
  status: statuses[i % statuses.length],
  registeredAt: subDays(new Date(), Math.floor(Math.random() * 20)),
  answers: [],
}));
