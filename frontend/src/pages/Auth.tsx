// src/pages/Auth.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// const BACKEND_BASE =
//  import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8080";

 // src/pages/Auth.tsx

// Use the dev proxy in development, and the full Cloud Run URL in production

// const BACKEND_BASE =
//   import.meta.env.MODE === "development"
//     ? "/api"
//     : import.meta.env.VITE_API_BASE_URL;

// if (!BACKEND_BASE) {
//   console.error("VITE_API_BASE_URL is not set for this build.");
// }

const BACKEND_BASE =
  import.meta.env.MODE === "development"
    ? "http://localhost:8080"
    : "https://phishlens-backend-1087775975982.us-west1.run.app";

const Auth = () => {
  const { user, signInMock } = useAuth();
  const navigate = useNavigate();

  // If already signed in, go to dashboard
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleSignIn = () => {
    // Kick off Google OAuth flow (backend will redirect to Google)
    window.location.href = `${BACKEND_BASE}/auth/google`;
  };

  const handleMockSignIn = async () => {
    await signInMock("demo@phishlens.dev");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Sign in to PhishLens
          </CardTitle>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Use your Google account to save analyses and sync across devices.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full flex items-center justify-center gap-2"
            onClick={handleGoogleSignIn}
          >
            <span>Continue with Google</span>
          </Button>

          {/* <div className="text-xs text-muted-foreground text-center">
            For local testing, you can also use a mock login:
          </div> */}
          {/* <Button
            variant="outline"
            className="w-full text-xs"
            onClick={handleMockSignIn}
          >
            Use mock account
          </Button> */}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
