/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { RAGTabId } from "./types";
import { RAGWorkstation } from "./components/RAGWorkstation";
import { HitlModal } from "./components/HitlModal";
import { ImageAnalysisModal } from "./components/ImageAnalysisModal";
import { CommandPalette } from "./components/CommandPalette";

export default function App() {
  const [isHitlOpen, setIsHitlOpen] = useState<boolean>(false);
  const [isImageAnalysisOpen, setIsImageAnalysisOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Global keydown handler for ⌘K or Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const handleApplyHitlOverride = (directive: string, query: string) => {
    console.log("HITL Override applied:", { directive, query });
  };

  const handleInjectImageAnalysis = (analysisText: string, imagePreviewUrl?: string) => {
    console.log("Image analysis injected:", { analysisText, imagePreviewUrl });
  };

  return (
    <div className="min-h-screen bg-[#090d10]">
      <RAGWorkstation
        onOpenHitl={() => setIsHitlOpen(true)}
        onOpenImageAnalysis={() => setIsImageAnalysisOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Modals */}
      <HitlModal
        isOpen={isHitlOpen}
        onClose={() => setIsHitlOpen(false)}
        onApplyOverride={handleApplyHitlOverride}
      />

      <ImageAnalysisModal
        isOpen={isImageAnalysisOpen}
        onClose={() => setIsImageAnalysisOpen(false)}
        onInjectAnalysis={handleInjectImageAnalysis}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={(tab: RAGTabId) => {}}
        onOpenHitl={() => setIsHitlOpen(true)}
        onOpenImageAnalysis={() => setIsImageAnalysisOpen(true)}
        onReindex={() => {}}
      />
    </div>
  );
}

