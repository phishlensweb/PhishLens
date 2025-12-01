// src/routes/results.js
// List + fetch saved analyses from Firestore

import { Router } from "express";
import { colResults } from "../services/firestore.js";

const router = Router();

/**
 * GET /results
 * Optional: ?userId=someone@example.com
 *
 * Returns the most recent analyses, filtered by userId if provided.
 */
router.get("/", async (req, res, next) => {
  try {
    const { userId } = req.query;

    let query;

    if (userId && typeof userId === "string") {
      // 1) Filter by userId only (no orderBy here to avoid composite index)
      query = colResults().where("userId", "==", userId);
    } else {
      // 2) Global listing (no filter) – can safely orderBy createdAt
      query = colResults().orderBy("createdAt", "desc").limit(50);
    }

    const snap = await query.get();

    let results = snap.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        imageId: data.imageId || doc.id,
        userId: data.userId || null,
        filename: data.filename || data.imageId || doc.id,
        source: data.source || "upload",
        // risk from gemini block or plain risk field
        risk: data.gemini?.risk ?? data.risk ?? 0,
        createdAt: data.createdAt || data.timestamp || null,
        // allow either image_url or url
        image_url: data.image_url || data.url || null,
      };
    });

    // If we filtered by userId, sort in memory by createdAt desc
    if (userId && typeof userId === "string") {
      results = results.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      }).slice(0, 50); // keep top 50
    }

    res.json({ results });
  } catch (err) {
    console.error("[results] list error:", err);
    next(err);
  }
});

/**
 * GET /results/:id
 * Fetch a single saved analysis document.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await colResults().doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Result not found" });
    }

    const data = doc.data();

    res.json({
      id: doc.id,
      ...data,
    });
  } catch (err) {
    console.error("[results] get error:", err);
    next(err);
  }
});

export default router;
