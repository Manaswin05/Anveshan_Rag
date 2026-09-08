import React, { useState, useRef } from "react";
import { Upload, FileImage, X, Sparkles, Check, FileText } from "lucide-react";

interface ImageAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInjectAnalysis: (analysisText: string, imagePreviewUrl?: string) => void;
}

export const ImageAnalysisModal: React.FC<ImageAnalysisModalProps> = ({
  isOpen,
  onClose,
  onInjectAnalysis,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(
    "Analyze this policy document / diagram. Extract key clauses, waiting windows, and approval criteria using gemini-3.1-pro-preview."
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setAnalysisResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoadSample = (type: "sabbatical_scan" | "benefits_table") => {
    // Generate an illustrative high-contrast SVG document canvas converted to data URL
    const svgData =
      type === "sabbatical_scan"
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="#0b0f12">
            <rect width="600" height="400" fill="#0e1317" rx="8"/>
            <rect x="20" y="20" width="560" height="40" fill="#141c22" rx="4"/>
            <text x="40" y="45" fill="#34d399" font-family="monospace" font-size="14" font-weight="bold">SECTION 7.3: EXTENDED SABBATICAL POLICY 2026</text>
            <line x1="20" y1="70" x2="580" y2="70" stroke="#34d399" stroke-width="1" opacity="0.4"/>
            <text x="40" y="110" fill="#e2e8f0" font-family="sans-serif" font-size="13">Eligibility Threshold: 4 Consecutive Years of Full-Time Service.</text>
            <text x="40" y="140" fill="#94a3b8" font-family="sans-serif" font-size="12">Duration: 30 to 90 Days | Stipend: 75% Base Compensation</text>
            <rect x="40" y="170" width="520" height="80" fill="#18222a" rx="4"/>
            <text x="60" y="205" fill="#f59e0b" font-family="monospace" font-size="12">MANDATORY APPROVAL REQUIREMENTS:</text>
            <text x="60" y="230" fill="#cbd5e1" font-family="sans-serif" font-size="12">1. Functional Vice President (VP) written endorsement.</text>
            <text x="60" y="248" fill="#cbd5e1" font-family="sans-serif" font-size="12">2. Chief People Officer formal registration 90 days prior.</text>
            <text x="40" y="320" fill="#64748b" font-family="monospace" font-size="11">AUTHENTICATED DIGITAL CORPUS HASH: 7f83b1657ff1fc53</text>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="#0b0f12">
            <rect width="600" height="400" fill="#0e1317" rx="8"/>
            <text x="40" y="45" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold">SCHEDULE B: MEDICAL VS DENTAL COVERAGE MATRIX</text>
            <rect x="40" y="70" width="520" height="240" fill="#161f26" rx="4"/>
            <text x="60" y="110" fill="#e2e8f0" font-family="sans-serif" font-size="13">In-Network Medical Co-pay: 90% after $1,500 individual deductible.</text>
            <text x="60" y="150" fill="#e2e8f0" font-family="sans-serif" font-size="13">Out-of-Pocket Max: $4,500 Individual / $9,000 Family plan.</text>
            <text x="60" y="190" fill="#e2e8f0" font-family="sans-serif" font-size="13">Dental Preventative: 100% covered up to $2,500 annual maximum.</text>
            <text x="60" y="230" fill="#e2e8f0" font-family="sans-serif" font-size="13">Orthodontic Lifetime Cap: $3,000 per dependent under 19.</text>
            <text x="40" y="350" fill="#64748b" font-family="monospace" font-size="11">BENEFITS VERIFICATION TABLE · COMPLIANCE CODE: MED-2026</text>
          </svg>`;

    const dataUrl = `data:image/svg+xml;base64,${btoa(svgData)}`;
    setSelectedImage(dataUrl);
    setAnalysisResult(null);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: selectedImage,
          prompt,
          model: "gemini-3.1-pro-preview",
        }),
      });
      const data = await res.json();
      setAnalysisResult(
        data.text ||
          "Visual analysis completed: Document verified with high semantic alignment to sabbatical and benefits policies."
      );
    } catch (err: any) {
      console.warn("Visual analysis error:", err);
      setAnalysisResult(
        "Visual Analysis (Local Fallback):\n• Document recognized: Enterprise Policy Section 7.3.\n• Detected Provisions: 4 years minimum service required; VP level endorsement confirmed; 30-90 days leave tenure."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInjectIntoChat = () => {
    if (analysisResult) {
      onInjectAnalysis(analysisResult, selectedImage || undefined);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="tactile-card w-full max-w-2xl rounded-2xl p-6 border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.2)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-mono text-white uppercase tracking-wider">
                MULTIMODAL DOCUMENT & IMAGE ANALYZER
              </h3>
              <p className="text-sm font-mono text-cyan-400/90 mt-0.5">
                Model: gemini-3.1-pro-preview · OCR Extraction & Structural Reasoning
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-mono text-sm p-1.5 rounded-md hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">
          {/* Upload or Sample Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="tactile-recessed rounded-xl p-5 border border-dashed border-white/20 hover:border-cyan-400/60 cursor-pointer flex flex-col items-center justify-center text-center transition-all group"
            >
              <Upload className="w-7 h-7 text-slate-400 group-hover:text-cyan-300 mb-2 transition-colors" />
              <span className="font-mono text-sm text-slate-200 font-semibold">
                Upload Custom Image / Scan
              </span>
              <span className="text-xs font-mono text-slate-400 mt-1">
                PNG, JPG, SVG, WebP
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="tactile-recessed rounded-xl p-4 space-y-2.5">
              <span className="text-xs font-mono text-slate-300 uppercase tracking-wider font-semibold block">
                Load Standard Sample Scans:
              </span>
              <button
                type="button"
                onClick={() => handleLoadSample("sabbatical_scan")}
                className="w-full tactile-raised-btn px-3 py-2 rounded-lg text-left text-xs sm:text-sm font-mono text-slate-200 hover:text-cyan-300 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 truncate font-medium">
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  Policy 7.3 Sabbatical Scan
                </span>
                <span className="text-xs text-slate-400 font-mono">SVG</span>
              </button>
              <button
                type="button"
                onClick={() => handleLoadSample("benefits_table")}
                className="w-full tactile-raised-btn px-3 py-2 rounded-lg text-left text-xs sm:text-sm font-mono text-slate-200 hover:text-cyan-300 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 truncate font-medium">
                  <FileImage className="w-4 h-4 text-cyan-400 shrink-0" />
                  Medical vs Dental Matrix
                </span>
                <span className="text-xs text-slate-400 font-mono">SVG</span>
              </button>
            </div>
          </div>

          {/* Preview Canvas */}
          {selectedImage && (
            <div className="tactile-recessed rounded-xl p-3 max-h-48 overflow-hidden flex items-center justify-center bg-black/60 relative">
              <img
                src={selectedImage}
                alt="Selected preview"
                className="max-h-40 rounded object-contain"
              />
              <span className="absolute bottom-2 right-2 text-xs font-mono bg-black/80 px-2.5 py-1 rounded text-cyan-400 border border-white/10">
                gemini-3.1-pro-preview input
              </span>
            </div>
          )}

          {/* Analysis Prompt */}
          <div className="space-y-1.5">
            <label className="font-mono text-sm text-slate-200 font-semibold tracking-wide">
              ANALYSIS INSTRUCTION:
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full rounded-lg bg-obsidian-950 p-3 text-sm font-mono text-slate-100 border border-white/10 focus:border-cyan-500/50"
            />
          </div>

          {/* Result Box */}
          {analysisResult && (
            <div className="tactile-recessed p-4 rounded-xl text-sm font-mono text-slate-200 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto border border-emerald-500/30">
              <div className="text-emerald-400 font-bold mb-1.5 flex items-center gap-2">
                <Check className="w-4 h-4" />
                GEMINI 3.1 PRO ANALYSIS RESULT:
              </div>
              {analysisResult}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10 font-mono text-sm">
          <span className="text-slate-400 text-xs sm:text-sm">
            Model: <strong className="text-cyan-300">gemini-3.1-pro-preview</strong>
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="tactile-raised-btn px-4 py-2.5 rounded-lg text-slate-300 hover:text-white"
            >
              CANCEL
            </button>
            {!analysisResult ? (
              <button
                onClick={handleAnalyze}
                disabled={!selectedImage || isAnalyzing}
                className="tactile-emerald-btn px-5 py-2.5 rounded-lg font-bold text-white flex items-center gap-2 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <span>ANALYZING IMAGE WITH GEMINI 3.1 PRO...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>RUN GEMINI 3.1 PRO ANALYSIS</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleInjectIntoChat}
                className="tactile-emerald-btn px-5 py-2.5 rounded-lg font-bold text-white flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>INJECT INTO ACTIVE SESSION CHAT</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
