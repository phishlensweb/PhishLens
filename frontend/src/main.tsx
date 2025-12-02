// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import ReactGA from "react-ga4";
import { AuthProvider } from "@/contexts/AuthContext";

// Get GA Measurement ID from environment variables (Vite uses import.meta.env)
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "G-XXXXXXXXXX";

// Initialize GA4 if measurement ID is configured
if (MEASUREMENT_ID && MEASUREMENT_ID !== "G-XXXXXXXXXX") {
  ReactGA.initialize(MEASUREMENT_ID);
  console.log("✅ GA4 initialized in main.tsx with ID:", MEASUREMENT_ID);
} else {
  console.warn("⚠️ GA4 Measurement ID not configured in .env");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
