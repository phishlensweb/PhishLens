/**
 * File: vision.js
 * Updated Version — accepts imageBase64 from frontend
 */

import { ImageAnnotatorClient } from "@google-cloud/vision";
import { trackEvent } from './analytics.js';
import { logToCloud } from './cloudLogging.js';

const client = new ImageAnnotatorClient();

/** Normalize landmark format */
function normalizeLandmark(lm) {
  return {
    type: lm.type,
    position: lm.position,
  };
}

/** Normalize bounding polygon */
function normalizeBox(poly) {
  const vs = poly?.vertices || [];
  return vs.map(v => ({ x: v.x ?? 0, y: v.y ?? 0 }));
}

/**
 * Analyze an image with Vision API — now supports:
 *   - imageUrl
 *   - imageBytes (Buffer)
 *   - imageBase64 (string)
 */
export async function analyzeVision({ imageUrl, imageBytes, imageBase64 }) {
  const started = Date.now();
  let request;

  // 1️⃣ If frontend sent raw base64
  if (imageBase64) {
    request = {
      image: { content: imageBase64 },
    };
  }

  // 2️⃣ If earlier logic passes imageBytes (Buffer)
  else if (imageBytes) {
    request = {
      image: { content: imageBytes.toString("base64") },
    };
  }

  // 3️⃣ If URL is available
  else if (imageUrl) {
    request = {
      image: { source: { imageUri: imageUrl } },
    };
  }

  // 4️⃣ Nothing provided → error
  else {
    throw Object.assign(
      new Error(
        "analyzeVision: provide imageUrl, imageBytes, or imageBase64"
      ),
      { status: 400 }
    );
  }

  // Call Google Vision
  const [result] = await client.faceDetection(request);
  const faces =
    (result.faceAnnotations || []).map(f => ({
      confidence: f.detectionConfidence ?? 0,
      box: normalizeBox(f.boundingPoly),
      fdBox: normalizeBox(f.fdBoundingPoly),
      landmarks: (f.landmarks || []).map(normalizeLandmark),
    })) || [];

    const latency = Date.now() - started;

    // Track Vision API call to GA4
    try {
      console.log(`[vision] 📊 Tracking Vision API call: facesCount=${faces.length}, latencyMs=${latency}`);
      await trackEvent(process.env.GA_CLIENT_ID || 'server', 'vision_api_call', {
        facesCount: faces.length,
        latencyMs: latency,
        source: imageUrl ? 'url' : (imageBase64 ? 'base64' : 'bytes')
      });
    } catch (e) {
      console.warn('[vision] ❌ Analytics track failed', e?.message || e);
    }

    // Write structured log to Google Cloud Logging
    try {
      await logToCloud('vision-api-requests', {
        service: 'vision',
        action: 'faceDetection',
        facesCount: faces.length,
        latencyMs: latency,
        source: imageUrl ? 'url' : (imageBase64 ? 'base64' : 'bytes'),
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[vision] failed to write cloud log', e?.message || e);
    }

    return {
      facesCount: faces.length,
      faces,
      latencyMs: Date.now() - started,
    };
}
