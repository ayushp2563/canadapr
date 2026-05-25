import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "../config/env.js";

// Routes
import chatRouter from "./routes/chat.js";
import drawsRouter from "./routes/draws.js";
import announcementsRouter from "./routes/announcements.js";
import healthRouter from "./routes/health.js";

// ============================================================
// App Setup
// ============================================================
const app = express();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS — in dev allow any localhost port (Vite auto-increments if 5173 is taken)
// In production, set ALLOWED_ORIGINS env var or restrict here.
const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow no-origin requests (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      if (env.NODE_ENV === "development" && localhostRegex.test(origin)) {
        return callback(null, true);
      }

      // Production: only allow explicitly listed origins
      const productionOrigins = (process.env["ALLOWED_ORIGINS"] ?? "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

      if (productionOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    credentials: true,
  })
);

// Request logging
app.use(
  morgan(":method :url :status :response-time ms - :res[content-length]", {
    skip: (req) => req.url === "/api/health",
  })
);

// Body parsing
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ============================================================
// Routes
// ============================================================
app.use("/api/chat", chatRouter);
app.use("/api/draws", drawsRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/health", healthRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

// ============================================================
// Start Server
// ============================================================
async function bootstrap() {
  // Import and start scheduler (lazy to avoid circular deps)
  if (env.NODE_ENV !== "test") {
    const { startScheduler } = await import("../scheduler/jobs.js");
    startScheduler();
  }

  app.listen(env.PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║   🇨🇦  CanadaPathways AI  — API Server    ║
╠═══════════════════════════════════════════╣
║  Port:     ${env.PORT}                           ║
║  Env:      ${env.NODE_ENV.padEnd(10)}                   ║
║  Chat:     POST /api/chat                 ║
║  Draws:    GET  /api/draws/latest         ║
║  Health:   GET  /api/health               ║
╚═══════════════════════════════════════════╝
    `);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
