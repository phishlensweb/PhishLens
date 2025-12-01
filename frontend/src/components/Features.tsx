import { Eye, Brain, ScanSearch } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Eye,
    title: "Vision OCR",
    description:
      "Advanced computer vision algorithms detect subtle inconsistencies in image metadata and pixel patterns.",
  },
  {
    icon: ScanSearch,
    title: "Visual Cues",
    description:
      "AI-powered analysis identifies manipulation artifacts like unnatural lighting, shadows, and facial distortions.",
  },
  {
    icon: Brain,
    title: "LLM Reasoning",
    description:
      "Large language models provide contextual analysis and confidence scoring for comprehensive detection.",
  },
];

export const Features = () => {
  return (
    <section className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Powered by Advanced AI</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Multiple detection layers working together to ensure accurate deepfake identification
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border-border shadow-card hover:shadow-hover transition-all duration-300 hover:-translate-y-1"
            >
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
