/**
 * File: firestore.js
 * Author: Swathi Pallikala
 * Project: PhishLens
 * Description:
 *   Initializes and exports the Firestore database connection.
 *   Provides helper functions to access specific collections.
 *   This is the single point of contact for Firestore in the backend.
 */

import { Firestore } from '@google-cloud/firestore';

// Use FIRESTORE_PROJECT_ID from .env if provided, otherwise auto-detect
const projectId = process.env.FIRESTORE_PROJECT_ID || undefined;

/**
 * Firestore automatically uses credentials from the environment variable:
 * GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 * For Cloud Run, it will use the attached service account instead.
 */
export const db = new Firestore({ projectId });

// Collection helper functions
export const colUsers   = () => db.collection('users');
export const colImages  = () => db.collection('images');
export const colResults = () => db.collection('results');
export const colMetrics = () => db.collection('analytics_daily');
