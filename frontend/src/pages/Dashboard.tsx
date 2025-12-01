// src/pages/Dashboard.tsx

import { Navigation } from "@/components/Navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Calendar, ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface Analysis {
  id: string;
  imageId?: string;
  filename: string;
  image_url: string | null;
  source: string;
  risk: number;
  createdAt: string | null;
}

const getRiskColor = (
  score: number
): "success" | "warning" | "destructive" => {
  if (score < 30) return "success";
  if (score < 70) return "warning";
  return "destructive";
};

const getRiskLabel = (
  score: number
): "Low Risk" | "Medium Risk" | "High Risk" => {
  if (score < 30) return "Low Risk";
  if (score < 70) return "Medium Risk";
  return "High Risk";
};

const Dashboard = () => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // If user is not signed in, just show empty state (and stop loading)
    if (!user) {
      setAnalyses([]);
      setLoading(false);
      return;
    }

    const fetchAnalyses = async () => {
      try {
        setLoading(true);

        const url = `/api/results?userId=${encodeURIComponent(user.email)}`;
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Failed to load results (${res.status})`);
        }

        const data = await res.json();
        const list: Analysis[] = Array.isArray(data.results)
          ? data.results
          : [];

        setAnalyses(list);
      } catch (error: any) {
        console.error("Dashboard fetch error:", error);
        toast({
          title: "Error loading saved analyses",
          description: error.message || "Failed to load results",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, [toast, user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Saved Analyses</h1>
            <p className="text-muted-foreground">
              These are the images you’ve analyzed. Click any card to reopen
              the detailed view.
            </p>
          </div>
          <Button asChild>
            <Link to="/upload">
              <Upload className="w-4 h-4 mr-2" />
              New Analysis
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : analyses.length === 0 ? (
          <Card className="text-center py-12">
            <CardHeader>
              <CardTitle>No analyses yet</CardTitle>
              <CardDescription>
                Upload an image to run your first deepfake analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/upload">Upload your first image</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analyses.map((analysis) => {
              const riskColor = getRiskColor(analysis.risk);
              const riskLabel = getRiskLabel(analysis.risk);

              const badgeVariant =
                riskColor === "destructive" ? "destructive" : "default";
              const badgeClass =
                riskColor === "success"
                  ? "bg-success hover:bg-success"
                  : riskColor === "warning"
                  ? "bg-warning hover:bg-warning"
                  : "";

              const dateLabel = analysis.createdAt
                ? format(new Date(analysis.createdAt), "MMM d, yyyy")
                : "Unknown date";

              return (
                <Card
                  key={analysis.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="aspect-video overflow-hidden bg-muted flex items-center justify-center">
                    {analysis.image_url ? (
                      <img
                        src={analysis.image_url}
                        alt={analysis.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-6 h-6 mb-2" />
                        <span className="text-sm">No preview stored</span>
                      </div>
                    )}
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {analysis.filename}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {dateLabel}
                        </div>
                      </div>
                      <Badge variant={badgeVariant} className={badgeClass}>
                        {riskLabel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Source:</span>
                      <span className="font-medium">
                        {analysis.source || "Upload"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Risk score:</span>
                      <span className="font-bold">{analysis.risk}%</span>
                    </div>
                    <Button asChild className="w-full" variant="outline">
                      <Link
                        to={`/analysis/${
                          analysis.imageId || analysis.id
                        }`}
                      >
                        View analysis
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
