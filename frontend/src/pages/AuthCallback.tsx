// src/pages/AuthCallback.tsx

import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const AuthCallback: React.FC = () => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { signInMock } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");

    if (!token) {
      navigate("/auth?error=missing_token", { replace: true });
      return;
    }

    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid token format");
      }

      const payloadBase64 = parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const payloadJson = atob(payloadBase64);
      const payload = JSON.parse(payloadJson);

      const email: string | undefined = payload.email;
      if (!email) {
        throw new Error("No email in token payload");
      }

      signInMock(email);
      localStorage.setItem("pl_token", token);

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Failed to process OAuth token", err);
      navigate("/auth?error=token_parse", { replace: true });
    }
  }, [search, navigate, signInMock]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  );
};

export default AuthCallback;
