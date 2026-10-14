/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { Sidebar, Page } from "./components/Sidebar";
import { ChatPage } from "./pages/ChatPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HitlModal } from "./components/HitlModal";
import { ImageAnalysisModal } from "./components/ImageAnalysisModal";
import { CommandPalette } from "./components/CommandPalette";
import { RAGTabId } from "./types";

export default function App() {
  const [activePage, setActivePage]       = useState<Page>("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [clearChatTrigger, setClearChatTrigger] = useState(0);

  // Modals
  const [isHitlOpen, setIsHitlOpen]       = useState(false);
  const [isImageOpen, setIsImageOpen]     = useState(false);
  const [isCmdOpen, setIsCmdOpen]         = useState(false);

  // ⌘K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCmdOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleNewChat = () => {
    setActivePage("chat");
    setClearChatTrigger((n) => n + 1);
  };

  return (
    <ThemeProvider>
      <div className="app-shell">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onNewChat={handleNewChat}
        />

        <main className="app-main" id="main-content">
          {activePage === "chat" && (
            <ChatPage
              onOpenImageAnalysis={() => setIsImageOpen(true)}
              onOpenHitl={() => setIsHitlOpen(true)}
              clearTrigger={clearChatTrigger}
            />
          )}
          {activePage === "documents" && <DocumentsPage />}
          {activePage === "settings"  && <SettingsPage />}
        </main>

        {/* ── Modals ── */}
        <HitlModal
          isOpen={isHitlOpen}
          onClose={() => setIsHitlOpen(false)}
          onApplyOverride={(directive, query) =>
            console.log("HITL override:", { directive, query })
          }
        />
        <ImageAnalysisModal
          isOpen={isImageOpen}
          onClose={() => setIsImageOpen(false)}
          onInjectAnalysis={(text, url) =>
            console.log("Image analysis:", { text, url })
          }
        />
        <CommandPalette
          isOpen={isCmdOpen}
          onClose={() => setIsCmdOpen(false)}
          onSelectTab={(tab: RAGTabId) => {
            if (tab === "documents") setActivePage("documents");
            else if (tab === "audit" || tab === "pipeline") setActivePage("settings");
            else setActivePage("chat");
          }}
          onOpenHitl={() => setIsHitlOpen(true)}
          onOpenImageAnalysis={() => setIsImageOpen(true)}
          onReindex={() => {}}
        />
      </div>
    </ThemeProvider>
  );
}
