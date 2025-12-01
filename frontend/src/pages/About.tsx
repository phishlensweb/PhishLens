import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Eye, Brain, Zap } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4">About PhishLens</h1>
            <p className="text-xl text-muted-foreground">
              Advanced deepfake detection powered by cutting-edge AI technology
            </p>
          </div>

          <div className="prose prose-lg max-w-none mb-16">
            <Card className="shadow-card mb-8">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
                <p className="text-muted-foreground mb-4">
                  PhishLens is an advanced Single Page Application designed to protect users from
                  deepfake images and manipulation risks. By combining Google Cloud Vision, Google
                  Gemini AI, and noise-based forensics, we provide comprehensive analysis to detect
                  potential threats in digital images.
                </p>
                <p className="text-muted-foreground">
                  Our platform analyzes photos from your social networks or uploaded images, flagging
                  potential phishing attempts and image manipulations with detailed explanations and
                  confidence scores.
                </p>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Google Cloud Vision</h3>
                  <p className="text-muted-foreground">
                    Advanced face detection, OCR, web entities, and image properties analysis for
                    comprehensive visual inspection.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Google Gemini AI</h3>
                  <p className="text-muted-foreground">
                    Sophisticated reasoning over vision features providing risk scoring and
                    plain-English explanations.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Noise Forensics</h3>
                  <p className="text-muted-foreground">
                    Error Level Analysis (ELA), residuals, and DCT boundary detection for refined
                    manipulation detection.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Secure Storage</h3>
                  <p className="text-muted-foreground">
                    All results stored securely in Google Firestore with privacy-first architecture
                    and encryption.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-card">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">How It Works</h2>
                <ol className="space-y-4 text-muted-foreground">
                  <li className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                      1
                    </span>
                    <div>
                      <strong className="text-foreground">Upload or Connect:</strong> Upload an image
                      or connect your Google Photos account via secure OAuth
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                      2
                    </span>
                    <div>
                      <strong className="text-foreground">Vision Analysis:</strong> Google Cloud Vision
                      detects faces, landmarks, and visual features
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                      3
                    </span>
                    <div>
                      <strong className="text-foreground">AI Reasoning:</strong> Gemini AI analyzes
                      patterns and generates risk scores with explanations
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                      4
                    </span>
                    <div>
                      <strong className="text-foreground">Forensic Refinement:</strong> Optional
                      noise-based analysis for deeper inspection of suspicious images
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                      5
                    </span>
                    <div>
                      <strong className="text-foreground">Results:</strong> View detailed analysis with
                      overlays, metrics, and actionable recommendations
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
