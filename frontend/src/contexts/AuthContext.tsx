// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type User = { id: string; email: string };

type AuthContextType = {
  user: User | null;
  signInMock: (email?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);

  // restore from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("pl_user");
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem("pl_user");
      }
    }
  }, []);

  // IMPORTANT CHANGE: use the email as the stable user id
  const signInMock = async (email = "user@example.com") => {
    const u: User = {
      id: email,    // 👈 this used to be "demo-user"
      email,
    };
    setUser(u);
    localStorage.setItem("pl_user", JSON.stringify(u));
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem("pl_user");
    localStorage.removeItem("pl_token");
  };

  const value = useMemo(
    () => ({ user, signInMock, signOut }),
    [user]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
