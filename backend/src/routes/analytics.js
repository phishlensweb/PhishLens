/**
 * File: routes/analytics.js
 * Author: Swathi Pallikala
 * Project: PhishLens
 * Description:
 *   Analytics read endpoint (stub for now).
 *   - GET /analytics/summary?day=YYYY-MM-DD
 *   - Returns daily rollup metrics if present in Firestore,
 *     otherwise a default stub object.
 *   Notes:
 *   - We’ll populate analytics_daily/{day} later from logged events.
 */

import { Router } from 'express';
import { colMetrics } from '../services/firestore.js';

const router = Router();

router.get('/summary', async (req, res, next) => {
  try {
    const day = (req.query.day || new Date().toISOString().slice(0, 10));
    const doc = await colMetrics().doc(day).get();

    const data = doc.exists ? doc.data() : {
      day,
      calls: { vision: 0, gemini: 0, forensics: 0 },
      latenciesMsAvg: { vision: 0, gemini: 0, forensics: 0 },
      successRate: 1.0
    };

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
