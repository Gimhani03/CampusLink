# 🎓 CampusLink

**University event discovery and management platform** hosted for **NSBM Green University**, with support for **other Sri Lankan university students** at inter-university events (hackathons, competitions, open workshops). NSBM students get the full campus experience; guest students join via a separate signup and see only events marked **inter-university**. Admins publish events, set audience rules, manage registrations, and run QR check-in on the day.

<p align="center">
  ⚛️ React · 🟢 Node.js · 🚂 Express · 🍃 MongoDB
</p>

---

## 👥 Who it’s for

| Audience | How they join | What they can access |
|----------|----------------|----------------------|
| **NSBM campus students** | Main signup with **`@students.nsbm.ac.lk`** | All published events, **channels**, calendar, recommendations, campus-only and inter-university events |
| **Guest / external students** | **`/register/guest`** — pick your university, use a personal email | **Inter-university** events only (e.g. multi-uni hackathons); no campus-only listings or channels |
| **Organisers & admins** | Admin login | Create events, choose **campus** vs **inter-university** audience, manage registrations and check-in |

Events use an **audience scope**: *NSBM campus only* or *Inter-university (guest students)*, so organisers control who can browse and register.

---

## ✨ Features

### 🧑‍🎓 Student portal

- 📊 **Dashboard** — upcoming events, trending listings, deadlines, and recommended events
- 🔍 **Discovery** — browse and filter events, event detail pages, save favourites
- 📣 **Channels** — follow university clubs and societies (**NSBM campus students**)
- 📅 **Calendar** — month view of registered and saved events
- 🎟️ **Registration** — individual sign-up, custom organiser questions, and **team registration** for hackathons
- 📱 **Digital event passes** — unique QR pass per attendee (email delivery when SMTP is enabled)
- 🔔 **Notifications** — in-app alerts with **Server-Sent Events** for live updates
- 👤 **Profile** — interests (powers recommendations), profile photo via Cloudinary

### 🛡️ Admin portal

- 📋 **Event lifecycle** — create, edit, publish, and manage events with images plus **campus vs inter-university** audience rules
- ✅ **Registrations** — review applicants, export **PDF** reports, team roster management
- 📣 **Channels** — manage organiser channels
- 📈 **Analytics** — registration trends and category charts (Recharts)
- 📷 **Check-in scanner** — camera or manual token entry to mark attendance at the venue

### ⚙️ Backend

- 🔐 **JWT auth** — short-lived access tokens + **httpOnly** refresh cookies with rotation
- 🎯 **Recommendations** — weighted scoring from interests, past registrations, and followed channels
- ⏰ **Scheduled jobs** — registration deadline reminders and “event starts soon” notifications (`node-cron`)
- 🛡️ **Security** — Helmet, CORS, rate limiting (production), MongoDB sanitisation

---

## 🧰 Tech stack

| Layer | Technologies |
|--------|----------------|
| **Frontend** | React 19, Vite, React Router, Tailwind CSS 4, shadcn/ui, Framer Motion, Axios, Recharts, jsPDF |
| **Backend** | Node.js 18+, Express, Mongoose, express-validator, Winston |
| **Data & media** | MongoDB, Cloudinary |
| **Auth & email** | JWT, bcrypt, Nodemailer (optional), QR codes |

---

## 📁 Project structure

```text
Event Planner/
├── client/          # React SPA (Vite)
│   └── src/
│       ├── pages/           # Student & admin routes
│       ├── components/      # UI, dashboard, admin tools
│       ├── services/        # API clients
│       └── context/         # Auth & app state
└── server/          # REST API
    ├── models/              # Mongoose schemas
    ├── routes/              # /api/v1/*
    ├── services/            # Business logic
    ├── jobs/                # Cron tasks
    └── seed.js              # Sample data & default admin
```

---

## 🚀 Getting started

### 📋 Prerequisites

- [Node.js](https://nodejs.org/) **18+**
- [MongoDB](https://www.mongodb.com/) (local or Atlas)
- ☁️ Optional: [Cloudinary](https://cloudinary.com/) account for event/profile images
- ✉️ Optional: Gmail **App Password** for QR pass emails

### 1️⃣ Clone the repository

```bash
git clone https://github.com/Gimhani03/CampusLink.git
cd CampusLink
```

### 2️⃣ Backend setup

```bash
cd server
cp .env.example .env
npm install
```

Edit `server/.env`:

- Set **`MONGO_URI`**
- Set **`JWT_SECRET`** and **`JWT_REFRESH_SECRET`** to long random strings
- Set **`CLIENT_ORIGIN`** to your Vite URL (default `http://localhost:5173`)
- Set **`PORT=5001`** so the API matches the Vite dev proxy (see `client/vite.config.js`)
- Add Cloudinary keys if you upload images
- Set **`EMAIL_ENABLED=true`** and SMTP fields to email event passes

Seed the database (channels, sample events, admin user):

```bash
npm run seed
```

Start the API:

```bash
npm run dev
```

Health check: `http://localhost:5001/health` 💚

### 3️⃣ Frontend setup

```bash
cd ../client
npm install
npm run dev
```

Open **http://localhost:5173** 🌐

### 🔑 Default admin (after seed)

| Field | Value |
|--------|--------|
| Email | `admin@campuslink.lk` |
| Password | `Admin@campuslink1` |

Admin login: **http://localhost:5173/admin/login**

> ⚠️ Override via `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `server/.env`. Re-running `npm run seed` resets the admin password to the configured default.

**NSBM students:** register at `/register` with a **`@students.nsbm.ac.lk`** email.

**Other university students:** register at **`/register/guest`**, select your institution (Colombo, Moratuwa, SLIIT, etc.), and use a personal email — not an NSBM student address. After login, only **inter-university** events appear in discovery and registration.

---

## 🔌 API overview

Base path: **`/api/v1`**

| Route prefix | Purpose |
|--------------|---------|
| `/auth` | Register, login, refresh token, profile |
| `/events` | Public and authenticated event queries |
| `/registrations` | Register, cancel, list my events |
| `/recommendations` | Personalised event feed |
| `/notifications` | Notifications + SSE stream |
| `/channels` | Follow and list channels |
| `/admin` | Admin-only event and registration management |
| `/passes` | QR pass resolution and check-in |

---

## 📜 Scripts

**Server** (`server/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Production start |
| `npm run seed` | Seed DB + ensure admin |
| `npm run seed:clear` | Remove seeded data |

**Client** (`client/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

---

## 🔧 Environment variables

See **`server/.env.example`** for the full list. Important flags:

| Variable | Description |
|----------|-------------|
| `CRON_ENABLED` | Hourly reminder jobs (`false` to disable locally) |
| `CRON_AUTO_COMPLETE_EVENTS` | Auto-mark past events completed |
| `EMAIL_ENABLED` | Send QR passes by email |
| `PLATFORM_NAME` | Brand name in emails (default CampusLink) |

---

## 🎨 Rebranding

Display name and tagline live in:

- `client/src/constants/branding.js`
- `server/constants/branding.js`

Change **`PLATFORM_NAME`** there to update UI copy and server-side email branding.

---

## 👩‍💻 Author

**Gimhani Samanalee** — [GitHub @Gimhani03](https://github.com/Gimhani03)

---

## 📄 License

This project is for academic and portfolio use unless a separate license file is added.
