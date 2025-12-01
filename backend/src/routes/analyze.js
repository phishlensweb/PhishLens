/**
 * File: routes/analyze.js
 * Description:
 *   Accepts uploads (imageBase64) or Google Photos URLs,
 *   runs Vision + Gemini, stores results in Firestore,
 *   and returns a normalized response for the frontend.
 */

import { Router } from "express";
import { colImages, colResults } from "../services/firestore.js";
import { analyzeVision } from "../services/vision.js";
import { analyzeGemini } from "../services/gemini.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { userId, imageId, source, url, imageBase64 } = req.body;

    if (!userId || !imageId || !source) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["upload", "google_photos"].includes(source)) {
      return res.status(400).json({ error: "Invalid source" });
    }

    const now = new Date().toISOString();

    // --- Store image metadata (idempotent) ---
    await colImages().doc(imageId).set(
      {
        imageId,
        userId,
        source,
        url: url || null,
        updatedAt: now,
        createdAt: now,
      },
      { merge: true }
    );

    // --- Run Google Vision ---
    let vision;
    let imageDataUrl = null;

    if (source === "upload") {
      if (!imageBase64) {
        return res
          .status(400)
          .json({ error: "imageBase64 required for uploads" });
      }

      const bytes = Buffer.from(imageBase64, "base64");
      vision = await analyzeVision({ imageBytes: bytes });

      // Use a data URL for preview in Dashboard
      imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;
    } else {
      if (!url) {
        return res
          .status(400)
          .json({ error: "url required for Google Photos source" });
      }

      vision = await analyzeVision({ imageUrl: url });

      // For Google Photos, preview is just the public URL
      imageDataUrl = url;
    }

    // --- Gemini reasoning ---
    const gemini = await analyzeGemini(vision);

    const recommendedAction =
      gemini.recommendedAction ||
      (vision.facesCount > 0 ? "review" : "ignore");

    // --- Persist canonical result ---
    await colResults().doc(imageId).set(
      {
        imageId,
        userId,
        source,
        image_url: imageDataUrl, // 👈 what Dashboard will use
        vision,                  // { facesCount, faces[], latencyMs }
        gemini,                  // { risk, reason, recommendedAction, latencyMs, model }
        forensics: null,
        recommendedAction,
        timestamp: now,
        pipeline: { usedForensics: false, status: "complete" },
      },
      { merge: true }
    );

    // --- Respond with normalized payload for frontend ---
    res.status(202).json({
      message: "complete",
      imageId,
      source,
      facesCount: vision.facesCount,
      risk: gemini.risk,
      reason: gemini.reason,
      recommendedAction,
      vision,
      image_url: imageDataUrl,
    });
  } catch (err) {
    console.error("Analyze error:", err);
    next(err);
  }
});

export default router;
