// src/pages/Upload.tsx

import React, { useState } from "react";
import { Navigation } from "@/components/Navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload as UploadIcon, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Backend base URL (local dev)
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Convert File -> { base64WithoutPrefix, dataUrlWithPrefix }
const fileToBase64AndDataUrl = (
  file: File
): Promise<{ base64: string; dataUrl: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const [, base64] = result.split(",");
      resolve({
        dataUrl: result,
        base64: base64 || "",
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// simple client-side id
const generateImageId = () =>
  `img_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// Shape of the items we get back from /photos/list-recent
type GooglePhotoItem = {
  id: string;
  baseUrl: string;
  filename?: string;
  mimeType?: string;
};

const Upload: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Google Photos specific state
  const [photos, setPhotos] = useState<GooglePhotoItem[]>([]);
  const [photosNextPageToken, setPhotosNextPageToken] = useState<string | null>(
    null
  );
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isAnalyzingFromPhotos, setIsAnalyzingFromPhotos] = useState(false);
  const [hasConnectedPhotos, setHasConnectedPhotos] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      void handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in before analyzing an image.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      setIsUploading(true);

      toast({
        title: "Analyzing image…",
        description: "Please wait while we process your image.",
      });

      const { base64, dataUrl } = await fileToBase64AndDataUrl(file);
      const imageId = generateImageId();

      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id, // tie analysis to logged-in user id
          imageId,
          source: "upload",
          filename: file.name,
          mimeType: file.type,
          imageBase64: base64,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? data)
        );
      }

      const stored = {
        imageId,
        filename: file.name,
        image: dataUrl,
        risk: typeof data.risk === "number" ? data.risk : 0,
        reason: data.reason ?? "",
        recommendedAction: data.recommendedAction ?? "Review",
        vision: data.vision ?? null,
      };

      try {
        localStorage.setItem("pl_lastAnalysis", JSON.stringify(stored));
      } catch {
        // non-fatal
      }

      toast({
        title: "Analysis complete",
        description: "View detailed results on the analysis page.",
      });

      navigate(`/analysis/${imageId}`);
    } catch (err: any) {
      console.error("Upload/analysis error", err);
      toast({
        title: "Error",
        description:
          err?.message ??
          "Something went wrong while analyzing the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Connect to Google Photos and fetch the first page of recent photos.
   */
  const handleGooglePhotosConnect = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in before connecting Google Photos.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      setIsLoadingPhotos(true);

      const url = `${API_BASE_URL}/photos/list-recent?userId=${encodeURIComponent(
        user.email
      )}`;

      console.log("[Google Photos] requesting:", url);

      const res = await fetch(url);
      const data = await res.json();
      console.log("[Google Photos] raw:", data);

      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : `HTTP ${res.status}`
        );
      }

      const items = (data.items ?? []) as any[];

      const mapped: GooglePhotoItem[] = items.map((item) => ({
        id: item.id,
        baseUrl: item.baseUrl,
        filename: item.filename,
        mimeType: item.mimeType,
      }));

      setPhotos(mapped);
      setPhotosNextPageToken(data.nextPageToken || null);
      setHasConnectedPhotos(true);

      toast({
        title: "Google Photos Connected",
        description: `Found ${mapped.length} photo(s).`,
      });
    } catch (err: any) {
      console.error("Google Photos connect error:", err);
      toast({
        title: "Google Photos error",
        description: err?.message ?? "Failed to connect Google Photos.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  /**
   * Optional: load the next page of Google Photos (if available).
   */
  const handleLoadMorePhotos = async () => {
    if (!user || !photosNextPageToken) return;

    try {
      setIsLoadingPhotos(true);

      const url = `${API_BASE_URL}/photos/list-recent?userId=${encodeURIComponent(
        user.email
      )}&pageToken=${encodeURIComponent(photosNextPageToken)}`;

      console.log("[Google Photos] requesting next page:", url);

      const res = await fetch(url);
      const data = await res.json();
      console.log("[Google Photos] next page raw:", data);

      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : `HTTP ${res.status}`
        );
      }

      const items = (data.items ?? []) as any[];
      const mapped: GooglePhotoItem[] = items.map((item) => ({
        id: item.id,
        baseUrl: item.baseUrl,
        filename: item.filename,
        mimeType: item.mimeType,
      }));

      setPhotos((prev) => [...prev, ...mapped]);
      setPhotosNextPageToken(data.nextPageToken || null);

      toast({
        title: "Loaded more photos",
        description: `Added ${mapped.length} photo(s).`,
      });
    } catch (err: any) {
      console.error("Google Photos load more error:", err);
      toast({
        title: "Google Photos error",
        description: err?.message ?? "Failed to load more photos.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  /**
   * Analyze a chosen Google Photos image:
   *  1) /photos/download -> get base64 + metadata
   *  2) /analyze          -> run your detector
   */
  const handleAnalyzeGooglePhoto = async (photo: GooglePhotoItem) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in before analyzing an image.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      setIsAnalyzingFromPhotos(true);

      toast({
        title: "Analyzing Google photo…",
        description: "Downloading and processing the selected image.",
      });

      // 1) Download image bytes as base64 from backend
      const downloadUrl = `${API_BASE_URL}/photos/download?userId=${encodeURIComponent(
        user.email
      )}&mediaItemId=${encodeURIComponent(photo.id)}`;

      const downloadRes = await fetch(downloadUrl);
      const downloadData = await downloadRes.json();

      if (!downloadRes.ok) {
        throw new Error(
          typeof downloadData.error === "string"
            ? downloadData.error
            : `HTTP ${downloadRes.status}`
        );
      }

      const filename: string =
        downloadData.filename || photo.filename || "google-photo.jpg";
      const mimeType: string =
        downloadData.mimeType || photo.mimeType || "image/jpeg";
      const imageBase64: string = downloadData.imageBase64;

      const imageId = generateImageId();

      // 2) Send to /analyze, same as local upload
      const analyzeRes = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          imageId,
          source: "google-photos",
          filename,
          mimeType,
          imageBase64,
        }),
      });

      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) {
        throw new Error(
          typeof analyzeData.error === "string"
            ? analyzeData.error
            : JSON.stringify(analyzeData.error ?? analyzeData)
        );
      }

      // Data URL form for local display / caching
      const dataUrl = `data:${mimeType};base64,${imageBase64}`;

      const stored = {
        imageId,
        filename,
        image: dataUrl,
        risk: typeof analyzeData.risk === "number" ? analyzeData.risk : 0,
        reason: analyzeData.reason ?? "",
        recommendedAction: analyzeData.recommendedAction ?? "Review",
        vision: analyzeData.vision ?? null,
      };

      try {
        localStorage.setItem("pl_lastAnalysis", JSON.stringify(stored));
      } catch {
        // ignore
      }

      toast({
        title: "Analysis complete",
        description: "View detailed results on the analysis page.",
      });

      navigate(`/analysis/${imageId}`);
    } catch (err: any) {
      console.error("Google Photos analyze error:", err);
      toast({
        title: "Google Photos error",
        description:
          err?.message ??
          "Something went wrong while analyzing the Google Photos image.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingFromPhotos(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              Upload Image for Analysis
            </h1>
            <p className="text-lg text-muted-foreground">
              Upload an image or connect Google Photos to detect potential
              deepfake manipulation
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Upload from Device */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Upload from Device</CardTitle>
                <CardDescription>
                  Upload an image to detect potential deepfake manipulation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept="image/jpeg,image/png"
                    onChange={handleFileSelect}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UploadIcon className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-lg font-medium mb-2">
                      Drag &amp; drop or Choose File
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supported formats: JPG, PNG (Max 5MB)
                    </p>
                  </label>
                </div>
                <Button
                  className="w-full mt-6"
                  onClick={() =>
                    document.getElementById("file-upload")?.click()
                  }
                  disabled={isUploading || isAnalyzingFromPhotos}
                >
                  {isUploading ? "Analyzing…" : "Select File"}
                </Button>
              </CardContent>
            </Card>

            {/* Connect Google Photos */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Connect Google Photos</CardTitle>
                <CardDescription>
                  Analyze images directly from your Google Photos library
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-border rounded-lg p-8 text-center mb-4">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="w-8 h-8 text-accent" />
                  </div>
                  <p className="text-lg font-medium mb-2">Google Photos</p>
                  <p className="text-sm text-muted-foreground">
                    Secure OAuth 2.0 connection - no photos stored without
                    consent
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full mb-4"
                  onClick={handleGooglePhotosConnect}
                  disabled={isLoadingPhotos || isAnalyzingFromPhotos}
                >
                  {isLoadingPhotos ? "Connecting…" : "Connect Account"}
                </Button>

                <div className="mt-2 mb-4 p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                  <strong>Read-only access:</strong> PhishLens will only read
                  your photos, never modify or delete them. Your privacy is
                  protected with industry-standard encryption.
                </div>

                {/* Photo grid */}
                {photos.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-2">
                      Choose a Google photo to analyze:
                    </p>
                    <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto rounded-md border border-border p-2">
                      {photos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => void handleAnalyzeGooglePhoto(photo)}
                          disabled={isAnalyzingFromPhotos || isUploading}
                          className="relative group rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
                          title={photo.filename || "Google photo"}
                        >
                          <img
                            src={`${photo.baseUrl}=w200-h200`}
                            alt={photo.filename || "Google photo"}
                            className="w-full h-full object-cover group-hover:opacity-80 transition"
                          />
                        </button>
                      ))}
                    </div>

                    {photosNextPageToken && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={handleLoadMorePhotos}
                        disabled={isLoadingPhotos || isAnalyzingFromPhotos}
                      >
                        {isLoadingPhotos ? "Loading…" : "Load more photos"}
                      </Button>
                    )}
                  </div>
                )}

                {hasConnectedPhotos && photos.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Google Photos is connected, but no photos were returned for
                    this account.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
