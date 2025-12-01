/**
 * File: server.js
 * Author: Swathi Pallikala
 * Project: PhishLens
 * Description:
 *   Main entry point of the Node.js backend.
 *   - Loads environment variables
 *   - Configures Express app with middleware
 *   - Mounts route handlers for /analyze, /results, /analytics, /auth, /photos
 *   - Starts the server on defined PORT (default 8080)
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

// Route modules
import analyzeRouter from "./src/routes/analyze.js";
import resultsRouter from "./src/routes/results.js";
import analyticsRouter from "./src/routes/analytics.js";
import authRouter from "./src/routes/auth.js";
import photosRouter from "./src/routes/photos.js"; // ✅ NEW

// Error handling middleware
import { errorHandler, notFound } from "./src/middleware/errors.js";

// Initialize Express app
const app = express();

// Apply middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")
);

// Health check route
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "phishlens-backend" });
});

// Register routes
app.use("/analyze", analyzeRouter);
app.use("/results", resultsRouter);
app.use("/analytics", analyticsRouter);
app.use("/auth", authRouter);
app.use("/photos", photosRouter); // ✅ mount Google Photos routes

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[phishlens] backend listening on :${PORT}`);
});
