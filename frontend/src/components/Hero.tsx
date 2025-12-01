import { Button } from "@/components/ui/button";
import { ArrowRight, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-8 animate-fade-in">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">Powered by Advanced AI</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in-up">
          Spot Fake Images <br />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            in Seconds
          </span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-in-up delay-200">
          Identify deepfake images instantly with PhishLens using our smart Vision-based analysis
          powered by Google Cloud Vision and Gemini AI
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up delay-300">
          <Button asChild size="lg" className="gap-2">
            <Link to="/auth">
              Try PhishLens
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/about">Learn More</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mt-20 animate-fade-in-up delay-500">
          <div className="space-y-2">
            <div className="text-3xl md:text-4xl font-bold text-primary">99%</div>
            <div className="text-sm text-muted-foreground">Detection Rate</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl md:text-4xl font-bold text-primary">&lt;2s</div>
            <div className="text-sm text-muted-foreground">Analysis Time</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl md:text-4xl font-bold text-primary">AI</div>
            <div className="text-sm text-muted-foreground">Powered</div>
          </div>
        </div>
      </div>
    </section>
  );
};
