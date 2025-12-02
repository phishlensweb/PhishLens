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
import { trackImageUpload, trackApiCall, trackEvent } from "@/lib/analytics";


// Backend base URL (local dev)
// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// ✅ use proxy in dev, env var in prod
// const API_BASE_URL =
//   import.meta.env.MODE === "development"
//     ? "/api"
//     : import.meta.env.VITE_API_BASE_URL;

const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "/api"
    : "https://phishlens-backend-1087775975982.us-west1.run.app";

if (!API_BASE_URL) {
  // Helpful runtime log if you ever forget to set it
  // (in prod this will be undefined if VITE_API_BASE_URL wasn't provided at build time)
  // eslint-disable-next-line no-console
  console.error("VITE_API_BASE_URL is not set for this build.");
}


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

// Shape of the items we get back from the Picker media endpoint
type GooglePhotoItem = {
  id: string;
  baseUrl: string;
  filename?: string;
  mimeType?: string;
};

/**
 * Downscale/compress a base64 image if it’s too large for Firestore.
 * - maxSize: max width/height in pixels.
 * - quality: JPEG quality (0–1).
 */
const downscaleBase64IfNeeded = async (
  base64: string,
  mimeType: string,
  maxSize = 1024,
  quality = 0.8
): Promise<string> => {
  // Heuristic: if already under ~900k chars, skip (Firestore field limit is ~1,048,487 bytes)
  if (base64.length < 900_000) {
    return base64;
  }

  try {
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const img = new Image();
    img.src = dataUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (err) => reject(err);
    });

    let { width, height } = img;

    // No need to resize if already small
    if (width <= maxSize && height <= maxSize) {
      return base64;
    }

    const scale = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return base64;

    ctx.drawImage(img, 0, 0, width, height);

    // Use JPEG for better compression, regardless of original type
    const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
    const [, compressedBase64] = compressedDataUrl.split(",");

    return compressedBase64 || base64;
  } catch (err) {
    console.warn("downscaleBase64IfNeeded failed, using original image", err);
    return base64;
  }
};

const Upload: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Google Photos specific state
  const [photos, setPhotos] = useState<GooglePhotoItem[]>([]);
  const [photosNextPageToken, setPhotosNextPageToken] =
    useState<string | null>(null);
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
      
      // Track image upload started
      trackImageUpload("started", file.size);

      toast({
        title: "Analyzing image…",
        description: "Please wait while we process your image.",
      });

      const { base64, dataUrl } = await fileToBase64AndDataUrl(file);
      const imageId = generateImageId();

      const startTime = performance.now();
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          imageId,
          source: "upload",
          filename: file.name,
          mimeType: file.type,
          imageBase64: base64,
        }),
      });
      const duration = performance.now() - startTime;

      const data = await response.json();

      if (!response.ok) {
        trackApiCall("Backend", "/analyze", "error", Math.round(duration));
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? data)
        );
      }

      // Track successful API call
      trackApiCall("Backend", "/analyze", "success", Math.round(duration));
      trackImageUpload("completed", file.size);

      // If backend returned Gemini or Vision data, track them separately
      if (data.gemini) {
        trackEvent(
          "Gemini",
          "Analysis Result",
          `Risk: ${data.gemini?.risk ?? 0}% - ${data.gemini?.reason ?? ""}`,
          typeof data.gemini?.risk === "number" ? Math.round(data.gemini.risk) : undefined
        );
      }

      if (data.vision) {
        const facesCount = data.vision?.facesCount ?? (data.vision?.faces?.length ?? 0);
        trackEvent("Vision", "Vision Result", `Faces: ${facesCount}`, facesCount);
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
      // Track failed upload/analysis
      trackImageUpload("failed", file.size);
      
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
   * Connect to Google Photos using the Picker API:
   *  1) POST /photos/picker/session -> get { sessionId, pickerUri }
   *  2) Open pickerUri so user can pick photos in Google Photos
   *  3) Poll /photos/picker/media until the user finishes picking
   *  4) Auto-analyze the picked photo(s)
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

    let pickerWindow: Window | null = null;

    try {
      setIsLoadingPhotos(true);
      
      // Track Google Photos connection attempt
      trackEvent("Google Photos", "Connect Clicked");

      // 1) Create a Picker session via backend
      const sessionRes = await fetch(`${API_BASE_URL}/photos/picker/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // backend resolves this via Firestore; email works as user identifier
          userId: user.email,
        }),
      });

      const sessionData = await sessionRes.json();
      // const startTime = performance.now();
      // const analyzeDuration = performance.now() - startTime;
      if (!sessionRes.ok) {
        // trackApiCall("Google Photos", "/photos/list-recent", "error", Math.round(duration));
        throw new Error(
          typeof sessionData.error === "string"
            ? sessionData.error
            : `HTTP ${sessionRes.status}`
        );
      }

      const { sessionId, pickerUri } = sessionData as {
        sessionId: string;
        pickerUri: string;
      };

      if (!sessionId || !pickerUri) {
        throw new Error("Missing sessionId or pickerUri from Picker session.");
      }

      console.log("[Google Photos] Picker session:", sessionId, pickerUri);

      // 2) Open the Picker UI in a new tab (browser usually handles this as a tab)
      pickerWindow = window.open(pickerUri, "_blank", "noopener,noreferrer");

      // 3) Poll backend until user has finished selecting media
      const pollIntervalMs = 3000; // 3 seconds
      const maxAttempts = 40; // ~2 minutes max

      let pickedItems: GooglePhotoItem[] | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        const pollUrl = `${API_BASE_URL}/photos/picker/media?userId=${encodeURIComponent(
          user.email
        )}&sessionId=${encodeURIComponent(sessionId)}`;

        console.log("[Google Photos] polling:", pollUrl);

        const pollRes = await fetch(pollUrl);
        const pollData = await pollRes.json();

        if (!pollRes.ok) {
          throw new Error(
            typeof pollData.error === "string"
              ? pollData.error
              : `HTTP ${pollRes.status}`
          );
        }

        // Backend returns { status: "pending", mediaItemsSet: false } while waiting
        if (pollData.status === "pending" || pollData.mediaItemsSet === false) {
          console.log("[Google Photos] Picker still pending…");
          continue;
        }

        // User has finished picking; pollData.items is the picked media
        const items = (pollData.items ?? []) as any[];

        const mapped: GooglePhotoItem[] = items
          .map((item) => {
            const mediaFile = item.mediaFile || {};
            return {
              id: item.id as string,
              baseUrl: (mediaFile.baseUrl as string) || "",
              filename: mediaFile.filename as string | undefined,
              mimeType: mediaFile.mimeType as string | undefined,
            };
          })
          .filter((p) => p.baseUrl);

        pickedItems = mapped;
        setPhotos(mapped);
        setPhotosNextPageToken(pollData.nextPageToken || null);
        setHasConnectedPhotos(true);

        console.log(
          "[Google Photos] Picker returned",
          mapped.length,
          "item(s)"
        );

        // Close the Google Photos tab once we have the selection
        if (pickerWindow && !pickerWindow.closed) {
          pickerWindow.close();
        }

        // If exactly one photo was picked, mirror the "Upload from Device" flow:
        // auto-analyze and navigate to Analysis page.
        if (mapped.length === 1) {
          toast({
            title: "Analyzing selected photo…",
            description: "Please wait while we process your image.",
          });
          await handleAnalyzeGooglePhoto(mapped[0]);
        } else if (mapped.length > 1) {
          toast({
            title: "Google Photos Connected",
            description: `You selected ${mapped.length} photo(s).`,
          });
        }

        break;
      }

      if (!pickedItems || pickedItems.length === 0) {
        throw new Error(
          "No photos were selected in Google Photos for this session."
        );
      }
    } catch (err: any) {
      trackEvent("Google Photos", "Connection Failed", err?.message ?? "Unknown error");
      console.error("Google Photos connect error:", err);
      toast({
        title: "Google Photos error",
        description:
          err?.message ?? "Failed to connect to Google Photos Picker.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  /**
   * Optional: load the next page of Google Photos (if available).
   * (Currently unused because we auto-analyze the first selection.)
   */
  const handleLoadMorePhotos = async () => {
    if (!user || !photosNextPageToken) return;

    try {
      setIsLoadingPhotos(true);
      
      // Track load more action
      trackEvent("Google Photos", "Load More Photos");

      const url = `${API_BASE_URL}/photos/list-recent?userId=${encodeURIComponent(
        user.email
      )}&pageToken=${encodeURIComponent(photosNextPageToken)}`;

      console.log("[Google Photos] requesting next page:", url);

      const startTime = performance.now();
      const res = await fetch(url);
      const duration = performance.now() - startTime;
      const data = await res.json();
      console.log("[Google Photos] next page raw:", data);

      if (!res.ok) {
        trackApiCall("Google Photos", "/photos/list-recent (paginated)", "error", Math.round(duration));
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

      // Track successful pagination
      trackApiCall("Google Photos", "/photos/list-recent (paginated)", "success", Math.round(duration));
      trackEvent("Google Photos", "Loaded More Photos", `Added ${mapped.length} photos`);

      toast({
        title: "Loaded more photos",
        description: `Added ${mapped.length} photo(s).`,
      });
    } catch (err: any) {
      trackEvent("Google Photos", "Load More Failed", err?.message ?? "Unknown error");
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
   * Analyze a Google Photos image:
   *  1) /photos/picker/download -> get base64 + metadata
   *  2) /analyze                 -> run your detector
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
      
      // Track analysis from Google Photos started
      trackImageUpload("started", 0, "google-photos");

      toast({
        title: "Analyzing Google photo…",
        description: "Processing the selected image.",
      });

      // 1) Download image bytes as base64 from backend using Picker baseUrl
      const downloadRes = await fetch(
        `${API_BASE_URL}/photos/picker/download`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // backend resolves user by email in Firestore
            userId: user.email,
            baseUrl: photo.baseUrl,
            filename: photo.filename,
            mimeType: photo.mimeType,
          }),
        }
      );

      const downloadData = await downloadRes.json();

      if (!downloadRes.ok) {
        trackApiCall("Google Photos", "/photos/download", "error");
        throw new Error(
          typeof downloadData.error === "string"
            ? downloadData.error
            : `HTTP ${downloadRes.status}`
        );
      }

      trackApiCall("Google Photos", "/photos/download", "success");

      const filename: string =
        downloadData.filename || photo.filename || "google-photo.jpg";
      const mimeType: string =
        downloadData.mimeType || photo.mimeType || "image/jpeg";
      let imageBase64: string = downloadData.imageBase64;

      // 🔹 New: shrink/compress very large images so Firestore field size isn’t exceeded
      imageBase64 = await downscaleBase64IfNeeded(imageBase64, mimeType);

      const imageId = generateImageId();

      // 2) Send to /analyze, same as local upload
      const startTime = performance.now();
      const analyzeRes = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          imageId,
          // Use same source value as upload so dashboard cards stay consistent
          source: "upload",
          filename,
          mimeType,
          imageBase64,
        }),
      });
      const analyzeDuration = performance.now() - startTime;

      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) {
        trackApiCall("Backend", "/analyze", "error", Math.round(analyzeDuration));
        throw new Error(
          typeof analyzeData.error === "string"
            ? analyzeData.error
            : JSON.stringify(analyzeData.error ?? analyzeData)
        );
      }

      // Track successful analysis
      trackApiCall("Backend", "/analyze", "success", Math.round(analyzeDuration));
      trackImageUpload("completed", imageBase64.length, "google-photos");

      // Track Gemini & Vision results returned from backend for Google Photos flow
      if (analyzeData.gemini) {
        trackEvent(
          "Gemini",
          "Analysis Result",
          `Risk: ${analyzeData.gemini?.risk ?? 0}% - ${analyzeData.gemini?.reason ?? ""}`,
          typeof analyzeData.gemini?.risk === "number" ? Math.round(analyzeData.gemini.risk) : undefined
        );
      }

      if (analyzeData.vision) {
        const facesCount = analyzeData.vision?.facesCount ?? (analyzeData.vision?.faces?.length ?? 0);
        trackEvent("Vision", "Vision Result", `Faces: ${facesCount}`, facesCount);
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
      // Track failed Google Photos analysis
      trackImageUpload("failed", 0, "google-photos");
      
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
                  {isLoadingPhotos ? "Analyzing…" : "Connect Account"}
                </Button>

                <div className="mt-2 mb-4 p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                  <strong>Read-only access:</strong> PhishLens will only read
                  your photos, never modify or delete them. Your privacy is
                  protected with industry-standard encryption.
                </div>

                {/* Grid is commented out because we now auto-analyze the selected photo.
                    Leaving this here in case you want a manual selection grid later. */}
                {/* {photos.length > 0 && (
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
                )} */}

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
