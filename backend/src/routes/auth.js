// src/routes/auth.js

import { Router } from "express";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { colUsers } from "../services/firestore.js";

const router = Router();

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  JWT_SECRET,
  FRONTEND_ORIGIN,
} = process.env;

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// -------------------------------------
// GOOGLE LOGIN – include all photo scopes
// -------------------------------------
router.get("/google", (_req, res) => {
  const scopes = [
    "openid",
    "profile",
    "email",

    // 🔥 REQUIRED – full Google Photos access via REST
   //  "https://www.googleapis.com/auth/photoslibrary",
   // "https://www.googleapis.com/auth/photoslibrary.readonly",
   // "https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata",

     // ✅ New required scope for Google Photos Picker API
    "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
  ];
  

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  return res.redirect(url);
});

// -------------------------------------
// GOOGLE CALLBACK
// -------------------------------------
router.get("/google/callback", async (req, res, next) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: "Missing OAuth code" });

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // fetch profile
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    const user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };

    // Store tokens
    await colUsers().doc(user.id).set(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: "google",
        googleTokens: {
          access_token: tokens.access_token ?? null,
          refresh_token: tokens.refresh_token ?? null,
          scope: tokens.scope ?? null,
          token_type: tokens.token_type ?? null,
          expiry_date: tokens.expiry_date ?? null,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Sign JWT
    const jwtToken = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });

    const frontend = FRONTEND_ORIGIN || "http://localhost:8081";
    const redirectUrl = new URL("/auth/callback", frontend);

    redirectUrl.searchParams.set("token", jwtToken);
    redirectUrl.searchParams.set("email", user.email);
    redirectUrl.searchParams.set("name", user.name);
    redirectUrl.searchParams.set("picture", user.picture);

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("OAuth callback error:", err);
    return next(err);
  }
});

export default router;
