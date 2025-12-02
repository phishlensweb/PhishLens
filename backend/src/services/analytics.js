import axios from 'axios';

// GA4 Measurement Protocol helper
// Requires these env vars to be set:
// - GA_MEASUREMENT_ID (e.g. G-XXXXXXX)
// - GA_API_SECRET (API secret from GA4)
// Optionally set GA_CLIENT_ID for server-supplied client id fallback.

export async function trackEvent(clientId, eventName, params = {}) {
  const measurementId = process.env.GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;

  if (!measurementId || !apiSecret) {
    // Missing config — don't fail application, just log.
    console.warn('[analytics] ⚠️  GA_MEASUREMENT_ID or GA_API_SECRET not set; skipping event', eventName);
    console.warn('[analytics] Set GA_MEASUREMENT_ID and GA_API_SECRET in .env to enable GA4 tracking');
    return;
  }

  // Allow using the debug endpoint for easier development/DebugView testing
  const useDebug = String(process.env.GA_USE_DEBUG_ENDPOINT || '').toLowerCase() === 'true';
  const base = useDebug ? 'https://www.google-analytics.com/debug/mp/collect' : 'https://www.google-analytics.com/mp/collect';
  const url = `${base}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

  // Ensure a reasonably unique client_id when none provided
  const cid = clientId || process.env.GA_CLIENT_ID || `server-${Date.now()}`;

  const payload = {
    client_id: cid,
    events: [
      {
        name: eventName,
        params: {
          ...params,
          debug_mode: true // prefer debug view visibility for dev
        }
      }
    ]
  };

  console.log(`[analytics] 📤 Sending event "${eventName}" to GA4 (${useDebug ? 'debug' : 'collect'}) as client_id=${cid} payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 5000 });
    console.log(`[analytics] ✅ Sent event "${eventName}" (status: ${response.status})`);
    if (response.data) console.log('[analytics] response data:', response.data);
  } catch (err) {
    console.warn(`[analytics] ❌ Failed to send event "${eventName}":`, err?.message || err);
    if (err?.response) {
      console.warn('[analytics] Response status:', err.response.status);
      console.warn('[analytics] Response data:', JSON.stringify(err.response.data));
    }
  }
}
