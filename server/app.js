/**
 * Express application factory.
 *
 * This module is solely responsible for:
 *   - Creating the Express app instance.
 *   - Registering global middleware (security, parsing, logging).
 *   - Mounting API routes.
 *   - Attaching terminal error-handling middleware.
 *
 * It does NOT start the HTTP server or connect to the database.
 * That responsibility belongs to server.js, keeping this module
 * easily importable in integration tests without side effects.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";

import env from "./config/env.js";
import logger from "./utils/logger.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";
import authRoutes             from "./routes/auth.routes.js";
import eventRoutes            from "./routes/event.routes.js";
import registrationRoutes     from "./routes/registration.routes.js";
import recommendationRoutes   from "./routes/recommendation.routes.js";
import notificationRoutes     from "./routes/notification.routes.js";
import channelRoutes          from "./routes/channel.routes.js";
import adminRoutes            from "./routes/admin.routes.js";
import passRoutes             from "./routes/pass.routes.js";

const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// Security middleware
// ─────────────────────────────────────────────────────────────────────────────

// Sets a comprehensive set of HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());

// Prevent MongoDB operator injection attacks by sanitising request bodies,
// query strings, and params — strips keys that contain $ or .
app.use(mongoSanitize());

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────

// Build the set of allowed origins from CLIENT_ORIGIN (comma-separated list).
// In development, also allow any localhost port so Vite port conflicts
// (e.g. 5173 occupied → Vite picks 5174) do not block the frontend.
const ALLOWED_ORIGINS = new Set(
  env.CLIENT_ORIGIN.split(",").map((o) => o.trim())
);

const isOriginAllowed = (origin) => {
  if (!origin) return true;                          // curl / Postman / SSR
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (!env.IS_PRODUCTION && /^https?:\/\/localhost(:\d+)?$/.test(origin))
    return true;                                     // any localhost port in dev
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      // Use a plain string message — the error handler will convert this
      // to a proper 403 ApiError rather than a generic 500.
      const err = new Error(`CORS: origin '${origin}' is not allowed`);
      err.statusCode = 403;
      callback(err);
    }
  },
  credentials: true, // Allow cookies and Authorization headers cross-origin.
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Ensure preflight OPTIONS requests are handled for all routes.
app.options("*", cors(corsOptions));

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────────

// Rate limiting is disabled in development — dev sessions burn through limits
// fast due to React StrictMode double-invocations, Vite HMR re-fetches, and
// multiple simultaneous API calls on each page load.
// In production this becomes 200 req / 15 min per IP.
if (env.IS_PRODUCTION) {
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      statusCode: 429,
      message: "Too many requests. Please try again later.",
    },
  });
  app.use("/api", globalLimiter);
}


// ─────────────────────────────────────────────────────────────────────────────
// Request parsing
// ─────────────────────────────────────────────────────────────────────────────

// Parse JSON bodies; reject payloads larger than 10 KB to reduce DoS surface.
app.use(express.json({ limit: "10kb" }));

// Parse URL-encoded bodies (standard HTML form submissions).
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Parse Cookie header and populate req.cookies for JWT cookie strategy.
app.use(cookieParser());

// ─────────────────────────────────────────────────────────────────────────────
// HTTP request logging (Morgan → Winston)
// ─────────────────────────────────────────────────────────────────────────────

const morganFormat = env.IS_PRODUCTION ? "combined" : "dev";
app.use(morgan(morganFormat, { stream: logger.stream }));

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API routes
// ─────────────────────────────────────────────────────────────────────────────

app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/events",           eventRoutes);
app.use("/api/v1/registrations",    registrationRoutes);
app.use("/api/v1/recommendations",  recommendationRoutes);
app.use("/api/v1/notifications",    notificationRoutes);
app.use("/api/v1/channels",         channelRoutes);
app.use("/api/v1/admin",            adminRoutes);
app.use("/api/v1/passes",           passRoutes);

// Future routes (uncomment as features are built):
// import userRoutes from "./routes/user.routes.js";
// app.use("/api/v1/users", userRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// Terminal middleware — order matters: notFound → errorHandler
// ─────────────────────────────────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

export default app;
