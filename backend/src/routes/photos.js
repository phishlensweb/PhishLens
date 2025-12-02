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

const PICKER_BASE_URL = "https://photospicker.googleapis.com/v1";

/**
 * Helper: for a given user, return a fresh OAuth access token that
 * has the photospicker.mediaitems.readonly scope.
 */
async function getAccessTokenForUser(userIdentifier) {
  const authClient = await getAuthorizedClientForUser(userIdentifier);

  const accessTokenResp = await authClient.getAccessToken();
  const accessToken =
    typeof accessTokenResp === "string"
      ? accessTokenResp
      : accessTokenResp?.token;

  if (!accessToken) {
    const err = new Error(
      "Failed to obtain access token for Google Photos Picker"
    );
    // @ts-ignore
    err.status = 500;
    throw err;
  }

  return accessToken;
}

/**
 * POST /photos/picker/session
 *
 * Creates a new Google Photos Picker session for the given user and
 * returns:
 *  - sessionId: used later to poll for picked media
 *  - pickerUri: URL your frontend will open so the user can pick photos
 */
router.post("/picker/session", async (req, res, next) => {
  const { userId } = req.body;

  if (!userId || typeof userId !== "string") {
    return res
      .status(400)
      .json({ error: "Missing userId in request body" });
  }

  try {
    const accessToken = await getAccessTokenForUser(userId);

    const createResp = await fetch(`${PICKER_BASE_URL}/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      // Minimal PickingSession config: allow up to 10 items.
      // (You can change maxItemCount to "1" if you only want one photo.)
      body: JSON.stringify({
        pickingConfig: {
          maxItemCount: "10",
        },
      }),
    });

    if (!createResp.ok) {
      const text = await createResp.text();
      console.error(
        "[photos] Picker sessions.create error:",
        createResp.status,
        text
      );
      return res.status(createResp.status).json({
        error: "Google Photos Picker sessions.create failed",
        details: text,
      });
    }

    const session = await createResp.json();

    // session.id and session.pickerUri come from the PickingSession resource
    // https://photospicker.googleapis.com/v1/sessions
    console.log(
      "[photos] created picker session",
      session.id,
      "expires at",
      session.expireTime
    );

    return res.json({
      sessionId: session.id,
      pickerUri: session.pickerUri,
      // optional, might be useful later when we add polling
      pollingConfig: session.pollingConfig || null,
      expireTime: session.expireTime || null,
    });
  } catch (err) {
    console.error("[photos] picker/session error:", err);
    next(err);
  }
});

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

/**
 * GET /photos/picker/media?userId=...&sessionId=...
 *
 * - Polls the Picker session to see if the user has finished selecting photos.
 * - If not done yet → returns { status: "pending", ... }.
 * - If done → calls mediaItems.list and returns the picked media items.
 */
router.get("/picker/media", async (req, res, next) => {
  const { userId, sessionId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId query param" });
  }
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Missing sessionId query param" });
  }

  try {
    const accessToken = await getAccessTokenForUser(userId);

    // 1) Check session status: has the user finished picking?
    const sessionResp = await fetch(
      `${PICKER_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!sessionResp.ok) {
      const text = await sessionResp.text();
      console.error(
        "[photos] Picker sessions.get error:",
        sessionResp.status,
        text
      );
      return res.status(sessionResp.status).json({
        error: "Google Photos Picker sessions.get failed",
        details: text,
      });
    }

    const session = await sessionResp.json();

    // If user hasn't finished selecting media yet, tell the frontend to keep polling.
    if (!session.mediaItemsSet) {
      return res.json({
        status: "pending",
        mediaItemsSet: false,
        pollingConfig: session.pollingConfig || null,
      });
    }

    // 2) User has finished selecting → list picked media items
    const listUrl =
      `${PICKER_BASE_URL}/mediaItems?` +
      new URLSearchParams({ sessionId: sessionId }).toString();

    const listResp = await fetch(listUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!listResp.ok) {
      const text = await listResp.text();
      console.error(
        "[photos] Picker mediaItems.list error:",
        listResp.status,
        text
      );
      return res.status(listResp.status).json({
        error: "Google Photos Picker mediaItems.list failed",
        details: text,
      });
    }

    const data = await listResp.json();

    const items = Array.isArray(data.mediaItems) ? data.mediaItems : [];
    console.log(
      "[photos] Picker mediaItems.list returned",
      items.length,
      "items"
    );

    // For now, just return the raw picked items to the frontend.
    // Each item has baseUrl, mimeType, id, etc.
    return res.json({
      status: "done",
      mediaItemsSet: true,
      items,
      nextPageToken: data.nextPageToken || null,
    });
  } catch (err) {
    console.error("[photos] picker/media error:", err);
    next(err);
  }
});

/**
 * POST /photos/picker/download
 *
 * Body: { userId, baseUrl, filename?, mimeType? }
 *
 * Uses the Google Photos Picker API access token to download the chosen
 * mediaFile.baseUrl and returns it as base64 so we can send it to /analyze.
 */
router.post("/picker/download", async (req, res, next) => {
  const { userId, baseUrl, filename, mimeType } = req.body || {};

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId in request body" });
  }
  if (!baseUrl || typeof baseUrl !== "string") {
    return res.status(400).json({ error: "Missing baseUrl in request body" });
  }

  try {
    const accessToken = await getAccessTokenForUser(userId);

    // Download original bytes using baseUrl from PickedMediaItem
    const downloadResp = await fetch(`${baseUrl}=d`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!downloadResp.ok) {
      const text = await downloadResp.text();
      console.error(
        "[photos] picker/download error:",
        downloadResp.status,
        text
      );
      return res.status(downloadResp.status).json({
        error: "Failed to download picked Google Photos mediaFile",
        details: text,
      });
    }

    const arrayBuffer = await downloadResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageBase64 = buffer.toString("base64");

    res.json({
      filename: filename || "google-photo.jpg",
      mimeType: mimeType || "image/jpeg",
      imageBase64,
    });
  } catch (err) {
    console.error("[photos] picker/download handler error:", err);
    next(err);
  }
});

export default router;
