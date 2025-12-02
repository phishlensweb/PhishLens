/**
 * Cloud Logging helper
 * Writes structured logs to Google Cloud Logging
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var (service account JSON)
 */
import { Logging } from '@google-cloud/logging';

// Use explicit projectId from FIRESTORE_PROJECT_ID or GCP_PROJECT_ID env var
const projectId = process.env.GCP_PROJECT_ID

if (!projectId) {
  console.warn('[cloudLogging] ⚠️  Neither GCP_PROJECT_ID nor FIRESTORE_PROJECT_ID set in .env; Cloud Logging may not work');
}

// Initialize Cloud Logging client with explicit project ID
const logging = new Logging({ projectId });

function safeMeta() {
  return { resource: { type: 'global' } };
}

/**
 * Write a structured log entry to Google Cloud Logging
 * @param {string} logName - The name of the log (e.g., 'vision-api-requests')
 * @param {object} payload - The structured data to log
 */
export async function logToCloud(logName = 'phishlens-api-requests', payload = {}) {
  // Do not fail the app if Cloud Logging is unavailable
  if (!projectId) {
    console.warn(`[cloudLogging] ⚠️  Skipping log to "${logName}" (no projectId configured)`);
    return;
  }

  try {
    console.log(`[cloudLogging] 📝 Writing to log "${logName}" (project: ${projectId}):`, JSON.stringify(payload));
    const log = logging.log(logName);
    const entry = log.entry(safeMeta(), payload);
    await log.write(entry);
    console.log(`[cloudLogging] ✅ Successfully logged to "${logName}"`);
  } catch (err) {
    console.warn(`[cloudLogging] ❌ Failed to write to "${logName}":`, err?.message || err);
    if (err?.code) console.warn('[cloudLogging] error code:', err.code);
    if (err?.stack) console.warn('[cloudLogging] stack trace:', err.stack);
  }
}

export default logToCloud;
