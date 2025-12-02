import ReactGA from "react-ga4";

/**
 * Track custom events to Google Analytics 4
 * @param category - Event category (e.g., "API Request", "User Action")
 * @param action - Event action (e.g., "Called Gemini API", "Upload Image")
 * @param label - Event label for additional context
 * @param value - Optional numeric value for the event
 */
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  try {
    ReactGA.event({
      category,
      action,
      label,
      value,
    });
  } catch (error) {
    console.error("Failed to track event:", error);
  }
};

/**
 * Track API calls (e.g., Gemini API, backend endpoints)
 * @param apiName - Name of the API (e.g., "Gemini", "Backend")
 * @param endpoint - API endpoint being called
 * @param status - Response status (e.g., "success", "error")
 * @param duration - Time taken in milliseconds
 */
export const trackApiCall = (
  apiName: string,
  endpoint: string,
  status: "success" | "error",
  duration?: number
) => {
  trackEvent("API Request", `${apiName} - ${endpoint}`, status, duration);
};

/**
 * Track image upload events
 * @param status - Upload status (e.g., "started", "completed", "failed")
 * @param fileSize - Size of the uploaded file in bytes
 * @param source - Source of upload (e.g., "local-upload", "google-photos")
 */
export const trackImageUpload = (status: string, fileSize?: number, source?: string) => {
  const label = source 
    ? `${source} - File Size: ${fileSize || 0} bytes`
    : `File Size: ${fileSize || 0} bytes`;
  trackEvent("Image Upload", status, label, fileSize);
};

/**
 * Track analysis events
 * @param status - Analysis status (e.g., "started", "completed", "failed")
 * @param analysisType - Type of analysis (e.g., "phishing_detection", "risk_assessment")
 */
export const trackAnalysis = (status: string, analysisType: string) => {
  trackEvent("Analysis", status, analysisType);
};

/**
 * Track user authentication events
 * @param action - Auth action (e.g., "login", "logout", "signup")
 * @param provider - Auth provider (e.g., "Google", "GitHub", "Email")
 */
export const trackAuth = (action: string, provider: string) => {
  trackEvent("Authentication", action, provider);
};

/**
 * Track page navigation
 * @param pageName - Name of the page being navigated to
 * @param pageUrl - URL of the page
 */
export const trackPageView = (pageName: string, pageUrl: string) => {
  trackEvent("Page View", pageName, pageUrl);
};
