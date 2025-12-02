// src/components/Navigation.tsx
import { NavLink } from "@/components/NavLink";
import { Shield, Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import ReactGA from "react-ga4";
import { trackEvent } from "@/lib/analytics";

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    // Track Sign Out event
    ReactGA.event({
      category: "Authentication",
      action: "Sign Out",
      label: user?.email || "Unknown User",
    });
    console.log("📊 Tracked Sign Out event");
    
    await signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <NavLink to="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-gradient-primary rounded-lg transition-transform group-hover:scale-110">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              PhishLens
            </span>
          </NavLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <NavLink
              to="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-primary font-medium"
            >
              Home
            </NavLink>
            <NavLink
              to="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-primary font-medium"
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/about"
              className="text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-primary font-medium"
              onClick={() => {
                try {
                  trackEvent("Navigation", "Click", "About Us");
                  console.log("📊 Tracked Navigation click: About Us");
                } catch (e) {
                  console.warn("Failed to track About click", e);
                }
              }}
            >
              About Us
            </NavLink>
            <NavLink
              to="/contact"
              className="text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-primary font-medium"
            >
              Contact
            </NavLink>

            {/* Right-side auth button */}
            {user ? (
              <Button onClick={handleSignOut} variant="outline">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            ) : (
              <Button asChild>
                <NavLink to="/auth">Sign In</NavLink>
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-foreground"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-4">
            <NavLink
              to="/"
              className="block text-muted-foreground hover:text-foreground transition-colors py-2"
              activeClassName="text-primary font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/dashboard"
              className="block text-muted-foreground hover:text-foreground transition-colors py-2"
              activeClassName="text-primary font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/about"
              className="block text-muted-foreground hover:text-foreground transition-colors py-2"
              activeClassName="text-primary font-medium"
              onClick={() => {
                setIsMenuOpen(false);
                try {
                  trackEvent("Navigation", "Click", "About Us (mobile)");
                  console.log("📊 Tracked Navigation click: About Us (mobile)");
                } catch (e) {
                  console.warn("Failed to track About mobile click", e);
                }
              }}
            >
              About Us
            </NavLink>
            <NavLink
              to="/contact"
              className="block text-muted-foreground hover:text-foreground transition-colors py-2"
              activeClassName="text-primary font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </NavLink>

            {user ? (
              <Button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleSignOut();
                }}
                variant="outline"
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            ) : (
              <Button
                asChild
                className="w-full"
                onClick={() => setIsMenuOpen(false)}
              >
                <NavLink to="/auth">Sign In</NavLink>
              </Button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};
