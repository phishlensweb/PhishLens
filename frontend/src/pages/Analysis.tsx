
// src/pages/Analysis.tsx
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import { Navigation } from "@/components/Navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Vertex = { x?: number; y?: number };

type Face = {
  confidence?: number;
  box?: Vertex[];
  fdBox?: Vertex[];
};

type VisionPayload = {
  facesCount: number;
  faces: Face[];
};

type Metrics = {
  elaMean: number;
  elaStdDev: number;
  roiDelta: number;
  blockBoundaryEnergy: number;
};

type AnalysisData = {
  imageId: string;
  filename: string;
  risk: number;
  reason: string;
  recommendedAction: string;
  image?: string;
  vision?: VisionPayload | null;
  metrics: Metrics;
};

const defaultMetrics: Metrics = {
  elaMean: 0,
  elaStdDev: 0,
  roiDelta: 0,
  blockBoundaryEnergy: 0,
};

const Analysis = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  const [imageSize, setImageSize] = useState({
    width: 0,
    height: 0,
  });

  // Fetch analysis from backend first, fall back to localStorage
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/results/${id}`);

        if (res.ok) {
          const data = await res.json();

          setAnalysis({
            imageId: id,
            filename: data.filename ?? id,
            risk: data.gemini?.risk ?? 0,
            reason: data.gemini?.reason ?? "",
            recommendedAction: data.gemini?.recommendedAction ?? "Review",
            image: data.image_url ?? "",
            vision: data.vision ?? null,
            metrics: data.metrics ?? defaultMetrics,
          });

          setLoading(false);
          return;
        }

        // fallback to last local analysis
        const raw = localStorage.getItem("pl_lastAnalysis");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.imageId === id) {
            setAnalysis({
              imageId: parsed.imageId,
              filename: parsed.filename ?? id,
              risk: parsed.risk ?? 0,
              reason: parsed.reason ?? "",
              recommendedAction: parsed.recommendedAction ?? "Review",
              image: parsed.image ?? parsed.imageUrl ?? "",
              vision: parsed.vision ?? null,
              metrics: parsed.metrics ?? defaultMetrics,
            });
          }
        }
      } catch (err) {
        console.error("Error loading analysis:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const getRiskMeta = (score: number) => {
    if (score < 30) {
      return {
        icon: CheckCircle2,
        colorClass: "text-emerald-500",
        badgeVariant: "default" as const,
        badgeClass: "bg-emerald-100 text-emerald-700",
        label: "Low Risk",
      };
    }
    if (score < 70) {
      return {
        icon: AlertCircle,
        colorClass: "text-amber-500",
        badgeVariant: "secondary" as const,
        badgeClass: "bg-amber-100 text-amber-700",
        label: "Medium Risk",
      };
    }
    return {
      icon: AlertTriangle,
      colorClass: "text-red-500",
      badgeVariant: "destructive" as const,
      badgeClass: "",
      label: "High Risk",
    };
  };

  const riskScore = analysis ? Math.round(analysis.risk ?? 0) : 0;
  const riskMeta = useMemo(() => getRiskMeta(riskScore), [riskScore]);
  const RiskIcon = riskMeta.icon;

  const handleSave = async () => {
    // Results are already persisted; this is just UX feedback.
    setSaving(true);
    try {
      toast({
        title: "Already saved",
        description: "This analysis is already stored in your history.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  const faces = analysis?.vision?.faces ?? [];

  // Compute normalized face box style
  const getFaceBoxStyle = (face: Face): React.CSSProperties => {
    const verts = face.fdBox?.length ? face.fdBox : face.box;

    if (!verts || verts.length < 2 || !imageSize.width || !imageSize.height) {
      return { display: "none" };
    }

    const xs = verts.map((v) => v.x ?? 0);
    const ys = verts.map((v) => v.y ?? 0);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      left: `${(minX / imageSize.width) * 100}%`,
      top: `${(minY / imageSize.height) * 100}%`,
      width: `${((maxX - minX) / imageSize.width) * 100}%`,
      height: `${((maxY - minY) / imageSize.height) * 100}%`,
    };
  };

  // For the noise overlay, choose face heatmap color based on risk
  const getRiskHeatClass = () => {
    if (riskScore < 30) {
      // low risk → green
      return "bg-emerald-400/30 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.7)]";
    }
    if (riskScore < 70) {
      // medium → yellow/amber
      return "bg-amber-400/30 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.7)]";
    }
    // high → red
    return "bg-red-500/30 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.7)]";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading analysis…</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-24 pb-16 text-center">
          <h2 className="text-xl font-semibold">No analysis found</h2>
          <Button asChild className="mt-4">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-24 pb-16 max-w-7xl mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="ghost" size="icon">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>

          <div className="flex-1">
            <h1 className="text-3xl font-bold">{analysis.filename}</h1>
            <p className="text-muted-foreground">
              Deepfake Analysis (ID {analysis.imageId})
            </p>
          </div>

          <Button className="gap-2" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Analysis"}
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* IMAGE + OVERLAYS */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden shadow-card">
              <Tabs defaultValue="vision">
                <CardHeader className="border-b">
                  <TabsList className="w-full">
                    <TabsTrigger value="vision" className="flex-1">
                      Vision Overlay
                    </TabsTrigger>
                    <TabsTrigger value="noise" className="flex-1">
                      Noise Overlay (ELA)
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                {/* Vision Overlay with dashed boxes + dots */}
                <TabsContent value="vision">
                  <div className="relative flex justify-center bg-muted">
                    {analysis.image ? (
                      <div className="relative max-h-[70vh] flex items-center justify-center">
                        <img
                          src={analysis.image}
                          className="max-w-full max-h-[70vh] object-contain"
                          onLoad={handleImageLoad}
                          alt={analysis.filename}
                        />

                        {faces.map((face, i) => {
                          const boxStyle = getFaceBoxStyle(face);
                          if ((boxStyle as any).display === "none") return null;

                          return (
                            <div
                              key={i}
                              className="absolute pointer-events-none"
                              style={boxStyle}
                            >
                              {/* Dashed neon border */}
                              <div className="w-full h-full rounded-2xl border-[3px] border-emerald-400 border-dashed shadow-[0_0_25px_rgba(16,185,129,0.7)]" />

                              {/* Glowing corner dots */}
                              <span className="absolute w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)] -top-1 -left-1" />
                              <span className="absolute w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)] -top-1 -right-1" />
                              <span className="absolute w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)] -bottom-1 -left-1" />
                              <span className="absolute w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)] -bottom-1 -right-1" />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="p-8 text-muted-foreground">
                        No preview available
                      </p>
                    )}
                  </div>
                </TabsContent>

                {/* Noise Overlay: dimmed image + risk-colored face heat */}
                <TabsContent value="noise">
                  <div className="relative flex justify-center bg-muted">
                    {analysis.image ? (
                      <div className="relative max-h-[70vh] flex items-center justify-center">
                        <img
                          src={analysis.image}
                          className="max-w-full max-h-[70vh] object-contain opacity-70"
                          onLoad={handleImageLoad}
                          alt={analysis.filename}
                        />

                        {faces.map((face, i) => {
                          const boxStyle = getFaceBoxStyle(face);
                          if ((boxStyle as any).display === "none") return null;

                          const heatClass = getRiskHeatClass();

                          return (
                            <div
                              key={i}
                              className={`absolute rounded-2xl border ${heatClass} pointer-events-none`}
                              style={boxStyle}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <p className="p-8 text-muted-foreground">
                        No preview available
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-6">
            {/* RISK */}
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm">
                  Gemini Deepfake Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  <span className={riskMeta.colorClass}>{riskScore}%</span>
                </div>

                <div className="flex gap-2 items-center mt-2">
                  <RiskIcon className={`w-5 h-5 ${riskMeta.colorClass}`} />
                  <Badge
                    variant={riskMeta.badgeVariant}
                    className={riskMeta.badgeClass}
                  >
                    {riskMeta.label}
                  </Badge>
                </div>

                {analysis.reason && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-1">Analysis Details</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {analysis.reason}
                    </p>
                  </div>
                )}

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-semibold mb-1">Recommended Action</h4>
                  <p className="text-sm text-muted-foreground">
                    {analysis.recommendedAction}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* FORENSICS */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Noise / Forensics Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      ELA Mean
                    </p>
                    <p className="font-bold">{analysis.metrics.elaMean}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      ELA StdDev
                    </p>
                    <p className="font-bold">{analysis.metrics.elaStdDev}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      ROI Δ (Face vs BG)
                    </p>
                    <p className="font-bold">{analysis.metrics.roiDelta}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Block Boundary Energy
                    </p>
                    <p className="font-bold">
                      {analysis.metrics.blockBoundaryEnergy}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;
