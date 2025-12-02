import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Analysis from "./pages/Analysis";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth"; // ✅ new auth page
import { AuthProvider } from "@/contexts/AuthContext"; // ✅ context wrapper
import AuthCallback from "@/pages/AuthCallback";
import React, { useEffect } from "react";
import ReactGA from "react-ga4";

const queryClient = new QueryClient();

// Get GA Measurement ID from environment variables (Vite uses import.meta.env)
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "G-XXXXXXXXXX";

// Initialize Google Analytics (only once)
const initializeGA = () => {
  if (MEASUREMENT_ID && MEASUREMENT_ID !== "G-XXXXXXXXXX") {
    ReactGA.initialize(MEASUREMENT_ID);
    console.log("✅ Google Analytics initialized with ID:", MEASUREMENT_ID);
  } else {
    console.warn("⚠️ GA4 Measurement ID not configured. Set VITE_GA_MEASUREMENT_ID in .env");
  }
};

// Hook to track page views on route changes
const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Only track if GA is properly configured
    if (MEASUREMENT_ID && MEASUREMENT_ID !== "G-XXXXXXXXXX") {
      // Map pathname to readable page name
      const getPageName = (path: string): string => {
        if (path === "/") return "Home";
        if (path === "/about") return "About";
        if (path === "/contact") return "Contact";
        if (path === "/auth") return "Sign In";
        if (path === "/dashboard") return "Dashboard";
        if (path === "/upload") return "Upload";
        if (path.startsWith("/analysis/")) return "Analysis";
        if (path === "/auth/callback") return "Auth Callback";
        return "Other";
      };

      const pageName = getPageName(location.pathname);

      // Send page view to GA4
      ReactGA.send({
        hitType: "pageview",
        page: location.pathname + location.search,
        title: document.title,
      });

      // Also track as a custom event for easier filtering
      ReactGA.event({
        category: "Page View",
        action: "Navigated",
        label: pageName,
      });
      
      console.log("📊 Tracked page view:", pageName, "(" + location.pathname + ")");
    }
  }, [location]);
};

// Inner App component (inside BrowserRouter, can use useLocation)
const AppContent = () => {
  usePageTracking();

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/analysis/:id" element={<Analysis />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Catch-all fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </TooltipProvider>
  );
};

// Outer App component (initializes GA and wraps with providers)
const App = () => {
  useEffect(() => {
    initializeGA();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
