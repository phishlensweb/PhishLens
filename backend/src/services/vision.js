/**
 * File: vision.js
 * Updated Version — accepts imageBase64 from frontend
 */

import { ImageAnnotatorClient } from "@google-cloud/vision";

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

  return {
    facesCount: faces.length,
    faces,
    latencyMs: Date.now() - started,
  };
}
