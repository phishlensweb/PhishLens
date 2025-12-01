/**
 * File: schemas.js
 * Author: Swathi Pallikala
 * Project: PhishLens
 * Description:
 *   Zod validation schemas for request inputs and query params.
 *   Centralizing schemas ensures consistent validation and clean controllers.
 *   - AnalyzeInput: validates POST /analyze payload
 *   - ResultsQuery: validates query params for GET /results
 */

import { z } from "zod";

// Payload for POST /analyze
export const AnalyzeInput = z
  .object({
    userId: z.string().min(1, "userId required"),
    imageId: z.string().min(1, "imageId required"),

    // Where the image came from
    source: z.enum(["google_photos", "upload"]),

    // Present when source is google_photos (or any URL-based source)
    url: z.string().url().optional(),

    // Present when source is "upload" (base64 from frontend)
    imageBase64: z.string().optional(),

    // Optional metadata for nicer UX / queries
    filename: z.string().optional(),
    mimeType: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Ensure we have *some* image data
    if (!data.url && !data.imageBase64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either url or imageBase64",
        path: ["url"], // arbitrary path; just to attach the error
      });
    }

    // Source-specific requirements
    if (data.source === "google_photos" && !data.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "url is required when source is google_photos",
        path: ["url"],
      });
    }

    if (data.source === "upload" && !data.imageBase64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "imageBase64 is required when source is upload",
        path: ["imageBase64"],
      });
    }
  });

// Query params for GET /results
export const ResultsQuery = z.object({
  userId: z.string().min(1, "userId required"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
