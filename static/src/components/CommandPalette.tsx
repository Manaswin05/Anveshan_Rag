import React, { useState, useEffect } from "react";
import { Search, X, Zap, RefreshCw, FileText, Shield, Sparkles } from "lucide-react";
import { RAGTabId } from "../types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: RAGTabId) => void;
  onOpenHitl: () => void;
  onOpenImageAnalysis: () => void;
  onReindex: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onOpenHitl,
  onOpenImageAnalysis,
  onReindex,
}) => {
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    {
      id: "tab-workspace",
      title: "Navigate to Workspace",
      category: "Navigation",
      icon: <Zap className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onSelectTab("workspace");
        onClose();
      },
    },
    {
      id: "tab-documents",
      title: "View Indexed Documents (12 Files)",
      category: "Navigation",
      icon: <FileText className="w-4 h-4 text-cyan-400" />,
      action: () => {
        onSelectTab("documents");
        onClose();
      },
    },
    {
      id: "tab-pipeline",
      title: "Inspect 9-Stage Hybrid Pipeline",
      category: "Telemetry",
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      action: () => {
        onSelectTab("pipeline");
        onClose();
      },
    },
    {
      id: "tab-retrieval",
      title: "View Deep Candidate Inspector Matrix",
      category: "Inspection",
      icon: <FileText className="w-4 h-4 text-purple-400" />,
      action: () => {
        onSelectTab("retrieval");
        onClose();
      },
    },
    {
      id: "tab-audit",
      title: "Audit Trail & Cryptographic Verifications",
      category: "Security",
      icon: <Shield className="w-4 h-4 text-slate-400" />,
      action: () => {
        onSelectTab("audit");
        onClose();
      },
    },
    {
      id: "action-hitl",
      title: "Simulate Human-in-the-Loop Escalation",
      category: "Supervisor Action",
      icon: <Shield className="w-4 h-4 text-amber-400" />,
      action: () => {
        onClose();
        onOpenHitl();
      },
    },
    {
      id: "action-multimodal",
      title: "Analyze Image / Document Scan with Gemini 3.1 Pro",
      category: "Gemini Intelligence",
      icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
      action: () => {
        onClose();
        onOpenImageAnalysis();
      },
    },
    {
      id: "action-reindex",
      title: "Trigger Instant Corpus Re-indexing",
      category: "System Action",
      icon: <RefreshCw className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onClose();
        onReindex();
      },
    },
  ];

  const filteredCommands = commands.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="tactile-card w-full max-w-xl rounded-2xl p-5 border-white/20 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 pb-3 px-2">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search tabs, documents, models..."
            className="w-full bg-transparent text-base font-mono text-white placeholder-slate-500 focus:outline-none"
          />
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-2.5 max-h-80 overflow-y-auto space-y-1.5">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-6 text-slate-400 font-mono text-sm">
              No matching commands found for "{search}"
            </div>
          ) : (
            filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.06] text-left font-mono text-sm transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded bg-black/40 border border-white/10">
                    {cmd.icon}
                  </div>
                  <span className="text-slate-200 group-hover:text-emerald-300 font-medium">
                    {cmd.title}
                  </span>
                </div>
                <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                  {cmd.category}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-white/10 pt-3 px-2 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Obsidian Command v2.4</span>
          <span>
            Press <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-slate-300">ESC</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
};
