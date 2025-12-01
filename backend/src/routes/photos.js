// src/routes/photos.js
// Google Photos routes for PhishLens

import { Router } from "express";
import { google } from "googleapis";
import { colUsers } from "../services/firestore.js";

const router = Router();

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  console.warn(
    "[photos] Missing Google OAuth env vars. Check GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI"
  );
}

// Reusable OAuth2 client (same config as auth.js)
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

/**
 * Helper: load user from Firestore and return an authorized OAuth client.
 *
 * userIdentifier can be either:
 *   - the Google user id (doc id), or
 *   - the email address (what the frontend currently sends).
 */
async function getAuthorizedClientForUser(userIdentifier) {
  if (!userIdentifier) {
    const err = new Error("Missing user identifier");
    // @ts-ignore
    err.status = 400;
    throw err;
  }

  let snap;

  // If it looks like an email, query by email.
  if (userIdentifier.includes("@")) {
    const querySnap = await colUsers()
      .where("email", "==", userIdentifier)
      .limit(1)
      .get();

    if (querySnap.empty) {
      const err = new Error("User not found in Firestore (by email)");
      // @ts-ignore
      err.status = 404;
      throw err;
    }

    snap = querySnap.docs[0];
  } else {
    // Otherwise, treat it as a doc id (Google profile id).
    snap = await colUsers().doc(userIdentifier).get();
    if (!snap.exists) {
      const err = new Error("User not found in Firestore (by id)");
      // @ts-ignore
      err.status = 404;
      throw err;
    }
  }

  const data = snap.data();
  const tokens = data.googleTokens || {};

  // Tiny bit of logging so we can see which scopes the token actually has
  console.log("[photos] using tokens for", data.email, "scope:", tokens.scope);

  oauth2Client.setCredentials({
    access_token: tokens.access_token || null,
    refresh_token: tokens.refresh_token || null,
    scope: tokens.scope || undefined,
    token_type: tokens.token_type || undefined,
    expiry_date: tokens.expiry_date || undefined,
  });

  return oauth2Client;
}

/**
 * GET /photos/list-recent?userId=...&pageToken=...
 *
 * Lists recent **photo** media items from Google Photos for the given user.
 * We use mediaItems:search with a mediaTypeFilter so we only get photos.
 * This should return all photos the app can see in the user's library,
 * not just app-created items.
 */
router.get("/list-recent", async (req, res, next) => {
  const { userId, pageToken } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId query param" });
  }

  try {
    const authClient = await getAuthorizedClientForUser(userId);

    // Get an access token to call Google Photos REST API
    const accessTokenResp = await authClient.getAccessToken();
    const accessToken =
      typeof accessTokenResp === "string"
        ? accessTokenResp
        : accessTokenResp?.token;

    if (!accessToken) {
      throw new Error("Failed to obtain access token for Google Photos");
    }

    // Build body for mediaItems:search.
    // We filter only PHOTOS and order by creation time (newest first).
    const body = {
      pageSize: 50,
      filters: {
        mediaTypeFilter: { mediaTypes: ["PHOTO"] },
      },
      orderBy: "MediaMetadata.creation_time desc",
    };

    if (pageToken && typeof pageToken === "string") {
      body.pageToken = pageToken;
    }

    const resp = await fetch(
      "https://photoslibrary.googleapis.com/v1/mediaItems:search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[photos] Google Photos API error:", resp.status, text);
      return res
        .status(resp.status)
        .json({ error: "Google Photos API error", details: text });
    }

    const data = await resp.json();

    const count = Array.isArray(data.mediaItems)
      ? data.mediaItems.length
      : 0;

    console.log("[photos] mediaItems.search returned", count, "items");

    res.json({
      items: data.mediaItems || [],
      nextPageToken: data.nextPageToken || null,
    });
  } catch (err) {
    console.error("[photos] list-recent error:", err);
    next(err);
  }
});

/**
 * GET /photos/download?userId=...&mediaItemId=...
 *
 * Downloads a single Google Photos media item as base64 so we can send it
 * into the /analyze endpoint just like a locally uploaded file.
 */
router.get("/download", async (req, res, next) => {
  const { userId, mediaItemId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId query param" });
  }
  if (!mediaItemId || typeof mediaItemId !== "string") {
    return res.status(400).json({ error: "Missing mediaItemId query param" });
  }

  try {
    const authClient = await getAuthorizedClientForUser(userId);

    const accessTokenResp = await authClient.getAccessToken();
    const accessToken =
      typeof accessTokenResp === "string"
        ? accessTokenResp
        : accessTokenResp?.token;

    if (!accessToken) {
      throw new Error("Failed to obtain access token for Google Photos");
    }

    // 1) Get metadata (including baseUrl) for this media item
    const metaResp = await fetch(
      `https://photoslibrary.googleapis.com/v1/mediaItems/${encodeURIComponent(
        mediaItemId
      )}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!metaResp.ok) {
      const text = await metaResp.text();
      console.error(
        "[photos] mediaItem metadata error:",
        metaResp.status,
        text
      );
      return res
        .status(metaResp.status)
        .json({ error: "Failed to get media item metadata", details: text });
    }

    const meta = await metaResp.json();
    const baseUrl = meta.baseUrl;
    const filename = meta.filename || "google-photo.jpg";
    const mimeType = meta.mimeType || "image/jpeg";

    if (!baseUrl) {
      return res
        .status(500)
        .json({ error: "Media item has no baseUrl for download" });
    }

    // 2) Download the actual bytes. The '=d' suffix requests the original
    // bytes (or best available) instead of a preview.
    const downloadResp = await fetch(`${baseUrl}=d`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!downloadResp.ok) {
      const text = await downloadResp.text();
      console.error(
        "[photos] mediaItem download error:",
        downloadResp.status,
        text
      );
      return res.status(downloadResp.status).json({
        error: "Failed to download Google Photos media item",
        details: text,
      });
    }

    const arrayBuffer = await downloadResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageBase64 = buffer.toString("base64");

    res.json({
      filename,
      mimeType,
      imageBase64,
    });
  } catch (err) {
    console.error("[photos] download error:", err);
    next(err);
  }
});

export default router;
