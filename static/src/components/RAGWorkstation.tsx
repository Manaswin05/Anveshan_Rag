import React, { useState, useRef, useEffect } from "react";
import {
  Zap,
  FileText,
  Shield,
  RefreshCw,
  Bell,
  Search,
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Paperclip,
  Send,
  AlertCircle,
  ExternalLink,
  Layers,
  Cpu,
  Eye,
  Sliders
} from "lucide-react";
import {
  RAGTabId,
  ChatMessage,
  RetrievedChunk,
  IndexedDocument,
  PipelineStage,
  AuditLogEntry
} from "../types";
import {
  initialChunks,
  initialDocuments,
  initialStages,
  initialAuditLogs
} from "../data/mockCorpus";

interface RAGWorkstationProps {
  onOpenHitl: () => void;
  onOpenImageAnalysis: () => void;
  onOpenCommandPalette: () => void;
}

export const RAGWorkstation: React.FC<RAGWorkstationProps> = ({
  onOpenHitl,
  onOpenImageAnalysis,
  onOpenCommandPalette,
}) => {
  const [activeTab, setActiveTab] = useState<RAGTabId>("workspace");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.5-flash");
  const [enableHighThinking, setEnableHighThinking] = useState<boolean>(false);
  const [chunks, setChunks] = useState<RetrievedChunk[]>(initialChunks);
  const [documents, setDocuments] = useState<IndexedDocument[]>(initialDocuments);
  const [stages, setStages] = useState<PipelineStage[]>(initialStages);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initialAuditLogs);
  const [highlightedChunkId, setHighlightedChunkId] = useState<number | null>(null);
  const [isTraceOpen, setIsTraceOpen] = useState<boolean>(true);
  const [isReindexing, setIsReindexing] = useState<boolean>(false);
  const [inputQuery, setInputQuery] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Initial rich conversation stream
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m-0",
      role: "assistant",
      content: `Hello SV-402. Active corpus: **employee_handbook_2026.pdf** (386 chunks). All retrieval pathways are active. Select a quick starter prompt or specify custom analytical criteria:`,
      timestamp: "13:04:18 UTC",
      model: "gemini-3.5-flash",
    },
    {
      id: "m-1",
      role: "user",
      content:
        "What are the specific requirements and waiting periods for employee sabbatical leave, and does it require VP-level approval?",
      timestamp: "13:04:45 UTC",
    },
    {
      id: "m-2",
      role: "assistant",
      content: `Based on rigorous verification against \`employee_handbook_2026.pdf\`, the sabbatical leave framework is governed by the following provisions:

• **Minimum Tenure:** Employees must complete a minimum of **four (4) consecutive years** of full-time service before becoming eligible [SOURCE 01 - Page 18].
• **Duration & Compensation:** Sabbaticals span between 30 to 90 consecutive calendar days, compensated at 75% of base salary while preserving healthcare vesting.
• **Approval Hierarchy:** Explicit written approval from the departmental **Vice President (VP) and People Operations** is mandatory at least 90 days in advance [SOURCE 02 - Page 19].`,
      timestamp: "13:04:50 UTC",
      model: "gemini-3.5-flash",
      citations: [
        { source: "SOURCE 01", page: 18, chunkId: 184, score: 0.942 },
        { source: "SOURCE 02", page: 19, chunkId: 185, score: 0.887 },
      ],
      retrievalTrace: {
        candidatePool: 23,
        threshold: 0.82,
        bm25Score: 14.8,
        cosineScore: 0.89,
        confidence: 94.2,
      },
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleHighlightEvidence = (chunkId: number) => {
    setHighlightedChunkId(chunkId);
    const element = document.getElementById(`chunk-card-${chunkId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => {
      setHighlightedChunkId(null);
    }, 2000);
  };

  const handleReindex = () => {
    setIsReindexing(true);
    setTimeout(() => {
      setIsReindexing(false);
      showToast("Corpus re-indexed: 386 dense vectors refreshed (ADA-002 / Text-Embedding-3-Large)");
      setAuditLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString().substring(11, 19) + " UTC",
          eventType: "CORPUS_REINDEX_COMPLETED",
          details: "Refreshed 386 vectors with M=16 HNSW index",
          userOrWorker: "Worker: indexer-core-01",
          status: "success",
        },
        ...prev,
      ]);
    }, 1200);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputQuery.trim();
    if (!textToSend || isSending) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString().substring(11, 19) + " UTC",
    };

    const assistantId = `msg-${Date.now() + 1}`;
    setMessages((prev) => [...prev, userMessage]);
    
    if (!customPrompt) setInputQuery("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSend }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      if (!response.body) throw new Error("No readable stream available");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      // Initialize empty assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString().substring(11, 19) + " UTC",
          model: selectedModel,
        }
      ]);

      let doneReading = false;
      let buffer = "";

      while (!doneReading) {
        const { value, done } = await reader.read();
        doneReading = done;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.type === "token") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: m.content + data.content } : m
                    )
                  );
                } else if (data.type === "escalation") {
                  showToast("Supervisor Escalation Triggered!");
                  // Mock showing escalation
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: m.content + "\n\n[ERROR: Policy violation detected. Escalated to human supervisor.]" } : m
                    )
                  );
                } else if (data.type === "error") {
                  showToast("Pipeline error: " + data.content);
                }
              } catch (e) {
                console.error("Failed to parse SSE line", line, e);
              }
            }
          }
        }
      }

      setAuditLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString().substring(11, 19) + " UTC",
          eventType: "QUERY_GENERATION_SUCCESS",
          details: `Stream completed for query`,
          userOrWorker: "User: SV-402",
          status: "success",
        },
        ...prev,
      ]);
    } catch (err: any) {
      console.warn("Synthesis fallback:", err);
      showToast(err.message || "Error connecting to RAG backend");
    } finally {
      setIsSending(false);
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d10] text-slate-300 font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* BEGIN: TopNavigationBar (Obsidian Command) */}
      <header className="sticky top-0 z-40 h-[72px] w-full border-b border-white/[0.07] bg-[#0b0f12]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shadow-2xl">
        {/* Left: Brand + Identity */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-b from-[#182127] to-[#0f1418] border border-emerald-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            <Zap className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-wider text-slate-100">
                RAG WORKSTATION
              </span>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 led-pulse"></span>
            </div>
            <p className="font-mono text-xs uppercase tracking-widest text-slate-400 mt-0.5">
              Enterprise Intelligence · v2.4
            </p>
          </div>
        </div>

        {/* Center: Physical Tactile Navigation Tabs */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-1.5 rounded-xl bg-[#07090b]/80 p-1 border border-white/[0.05] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]"
        >
          <button
            onClick={() => setActiveTab("workspace")}
            className={`${
              activeTab === "workspace"
                ? "nav-tab-active"
                : "text-slate-400 hover:text-slate-200"
            } flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm font-semibold tracking-wide transition-all`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
            WORKSPACE
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`${
              activeTab === "documents"
                ? "nav-tab-active"
                : "text-slate-400 hover:text-slate-200"
            } flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm font-semibold tracking-wide transition-all`}
          >
            DOCUMENTS
            <span className="rounded bg-[#182127] px-2 py-0.5 text-xs text-slate-300 border border-white/[0.06]">
              {documents.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`${
              activeTab === "pipeline"
                ? "nav-tab-active"
                : "text-slate-400 hover:text-slate-200"
            } flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm font-semibold tracking-wide transition-all`}
          >
            PIPELINE
            <span className="h-2 w-2 rounded-full bg-cyan-400/80"></span>
          </button>
          <button
            onClick={() => setActiveTab("retrieval")}
            className={`${
              activeTab === "retrieval"
                ? "nav-tab-active"
                : "text-slate-400 hover:text-slate-200"
            } flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm font-semibold tracking-wide transition-all`}
          >
            RETRIEVAL
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`${
              activeTab === "audit"
                ? "nav-tab-active"
                : "text-slate-400 hover:text-slate-200"
            } flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm font-semibold tracking-wide transition-all`}
          >
            AUDIT
          </button>
        </nav>

        {/* Right: Controls, Palette, Switcher & Profile */}
        <div className="flex items-center gap-3">

          {/* Model Status Pill */}
          <div className="hidden lg:flex items-center gap-2.5 rounded-lg bg-[#0f1418] border border-white/[0.06] px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 led-pulse"></span>
            <span className="font-mono text-sm font-medium text-slate-200 uppercase">
              {enableHighThinking ? "GEMINI 3.1 PRO (HIGH THINKING)" : selectedModel}
            </span>
            <span className="border-l border-white/10 pl-2 font-mono text-xs text-emerald-400 font-semibold">
              14ms
            </span>
          </div>

          {/* Quick Command Trigger (⌘K) */}
          <button
            onClick={onOpenCommandPalette}
            className="tactile-raised-btn hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-300"
            title="Global Command Palette (⌘K)"
          >
            <kbd className="font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded border border-white/10 text-slate-300">
              ⌘K
            </kbd>
          </button>

          {/* Image Analysis Trigger */}
          <button
            onClick={onOpenImageAnalysis}
            className="tactile-raised-btn flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-cyan-300 border-cyan-500/30 hover:border-cyan-400"
            title="Multimodal Image Analysis (gemini-3.1-pro-preview)"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline font-mono font-medium">Analyze Image</span>
          </button>

          {/* Notification Bell */}
          <button
            onClick={() => showToast("All 12 corpora synchronized with SHA-256 hashes")}
            className="tactile-raised-btn relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-400"></span>
          </button>

          {/* Supervisor Profile Badge */}
          <div className="flex items-center gap-2.5 rounded-lg bg-[#141b20] border border-white/[0.08] px-3 py-1.5">
            <div className="h-7 w-7 rounded bg-gradient-to-tr from-emerald-600 to-teal-400 text-xs font-mono font-bold text-black flex items-center justify-center">
              SV
            </div>
            <div className="hidden xl:block text-left">
              <p className="font-mono text-sm font-semibold text-slate-200 leading-tight">
                SV-402
              </p>
              <p className="text-xs font-mono uppercase text-emerald-400 leading-tight">
                Admin Tier 3
              </p>
            </div>
          </div>
        </div>
      </header>
      {/* END: TopNavigationBar */}

      {/* BEGIN: Main Content Area */}
      <main className="w-full min-h-[calc(100vh-72px)] max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
        {/* VIEW 1: WORKSPACE (Default Active Tab) */}
        {activeTab === "workspace" && (
          <div className="space-y-6 block">
            {/* Subheader with Title & Live Controls */}
            <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5 font-sans">
                    RAG INTELLIGENCE WORKSTATION
                  </h1>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-mono text-emerald-400 font-semibold">
                    ● PIPELINE READY
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-sm text-slate-400">
                  Hybrid Retrieval (BM25 + Dense Vectors) · Cross-Encoder Reranking · Human-in-the-Loop Supervision
                </p>
              </div>

              {/* Action Control Group */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onOpenHitl}
                  className="tactile-raised-btn flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-mono text-amber-300 border-amber-500/30 hover:border-amber-400/50"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-400 led-pulse"></span>
                  SIMULATE HITL ESCALATION
                </button>
                <button
                  onClick={handleReindex}
                  disabled={isReindexing}
                  className="tactile-raised-btn flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-mono text-slate-200"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-400 ${isReindexing ? "animate-spin" : ""}`} />
                  <span>{isReindexing ? "RE-INDEXING..." : "RE-INDEX"}</span>
                </button>
              </div>
            </section>

            {/* BEGIN: TactileDocumentIntelligenceModule */}
            <section className="tactile-card rounded-xl p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.06] pb-4 mb-4">
                {/* Active File Descriptor */}
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-mono font-bold text-sm">
                    PDF
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-semibold text-slate-100 font-mono">
                        employee_handbook_2026.pdf
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-300 border border-white/[0.06]">
                        ACTIVE INDEX
                      </span>
                    </div>
                    <p className="text-sm font-mono text-slate-400 truncate max-w-lg mt-0.5">
                      SHA-256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
                    </p>
                  </div>
                </div>

                {/* Synchronized indicator */}
                <div className="flex items-center gap-2 font-mono text-sm text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                  Last Embedded: Today 13:04:18 UTC (100% synchronized)
                </div>
              </div>

              {/* 4 Tactile Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="tactile-recessed rounded-lg p-4 relative overflow-hidden">
                  <div className="text-xs font-mono text-slate-300 font-semibold uppercase tracking-wider">
                    PAGES
                  </div>
                  <div className="mt-1 text-3xl font-bold font-mono text-white">42</div>
                  <div className="text-xs font-mono text-emerald-400/90 mt-1 flex items-center gap-1 font-medium">
                    ✓ Annotated & OCR Verified
                  </div>
                </div>

                <div className="tactile-recessed rounded-lg p-4 relative overflow-hidden">
                  <div className="text-xs font-mono text-slate-300 font-semibold uppercase tracking-wider">
                    CHUNKS
                  </div>
                  <div className="mt-1 text-3xl font-bold font-mono text-white">386</div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    1,000 token target chunk size
                  </div>
                </div>

                <div className="tactile-recessed rounded-lg p-4 relative overflow-hidden">
                  <div className="text-xs font-mono text-slate-300 font-semibold uppercase tracking-wider">
                    DENSITY / SIZE
                  </div>
                  <div className="mt-1 text-3xl font-bold font-mono text-white">
                    4.8 <span className="text-sm text-slate-400">MB</span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    Dense 1536-dim vectors (Float32)
                  </div>
                </div>

                <div className="tactile-recessed rounded-lg p-4 relative overflow-hidden">
                  <div className="text-xs font-mono text-slate-300 font-semibold uppercase tracking-wider">
                    OVERLAP
                  </div>
                  <div className="mt-1 text-3xl font-bold font-mono text-white">
                    100 <span className="text-sm text-slate-400">tok</span>
                  </div>
                  <div className="text-xs font-mono text-cyan-400/90 mt-1">
                    10% sliding semantic window
                  </div>
                </div>
              </div>
            </section>
            {/* END: TactileDocumentIntelligenceModule */}

            {/* BEGIN: HighPrecisionPipelineStepper (9 Stages) */}
            <section className="tactile-card rounded-xl p-5 sm:p-6 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  PIPELINE EXECUTION MONITOR · 9-STAGE HYBRID PIPELINE
                </span>
                <span className="font-mono text-sm text-emerald-400 font-semibold">
                  TOTAL LATENCY: 1.28s
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2.5">
                {stages.map((stg) => {
                  const isAccent = stg.isAccent;
                  return (
                    <div
                      key={stg.id}
                      className={`tactile-recessed rounded-md p-2.5 text-center border-l-2 ${
                        isAccent
                          ? "border-cyan-400 ring-1 ring-cyan-500/30"
                          : stg.name === "HITL"
                          ? "border-amber-500"
                          : "border-emerald-500"
                      }`}
                    >
                      <div
                        className={`text-xs font-mono font-medium ${
                          isAccent ? "text-cyan-300 font-semibold" : stg.name === "HITL" ? "text-amber-300" : "text-slate-300"
                        }`}
                      >
                        {stg.num}. {stg.name}
                      </div>
                      <div
                        className={`font-mono text-sm font-bold mt-0.5 ${
                          stg.name === "HITL" ? "text-amber-400" : "text-white"
                        }`}
                      >
                        {stg.name === "HITL" ? "ONLINE" : `${stg.latencyMs}ms`}
                      </div>
                      <div
                        className={`text-xs font-mono ${
                          isAccent
                            ? "text-cyan-400"
                            : stg.name === "HITL"
                            ? "text-amber-400/80"
                            : "text-emerald-400"
                        }`}
                      >
                        {stg.badge}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            {/* END: HighPrecisionPipelineStepper */}

            {/* BEGIN: DualColumnAnalystConsole (Left Chat & Right Evidence) */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Primary Chat & Reasoning Console (65%) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="tactile-card rounded-xl p-4 sm:p-6 flex flex-col h-[740px]">
                  {/* Console Header with Model Switcher & High Thinking */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
                      <span className="font-mono text-sm font-bold tracking-wider text-slate-200 uppercase">
                        DOCUMENT INTELLIGENCE CONSOLE · ACTIVE SESSION
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* High Thinking Toggle */}
                      <button
                        onClick={() => {
                          const next = !enableHighThinking;
                          setEnableHighThinking(next);
                          showToast(
                            next
                              ? "Enabled High Thinking with gemini-3.1-pro-preview"
                              : "Switched to standard reasoning mode"
                          );
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-all ${
                          enableHighThinking
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                            : "bg-[#141b20] text-slate-400 border border-white/10 hover:text-slate-200"
                        }`}
                        title="Enable deep thinking mode using ThinkingLevel.HIGH (gemini-3.1-pro-preview)"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>High Thinking: {enableHighThinking ? "ON" : "OFF"}</span>
                      </button>

                      <span className="font-mono text-xs text-slate-400">
                        Session: <span className="text-slate-200">#WKST-982</span>
                      </span>

                      <button
                        onClick={() => {
                          setMessages([
                            {
                              id: "m-reset",
                              role: "assistant",
                              content:
                                "Session buffer cleared. Active index: employee_handbook_2026.pdf ready for new inquiries.",
                              timestamp: new Date().toISOString().substring(11, 19) + " UTC",
                            },
                          ]);
                          showToast("Chat context and active buffers cleared");
                        }}
                        className="tactile-raised-btn px-2.5 py-1 rounded text-xs font-mono text-slate-400 hover:text-slate-200"
                        title="Clear Context"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Chat Stream Box */}
                  <div
                    ref={chatScrollRef}
                    className="flex-1 overflow-y-auto pr-2 py-4 space-y-5"
                    id="chat-stream-box"
                  >
                    {messages.map((msg) => {
                      const isAssistant = msg.role === "assistant";
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-3.5 ${
                            isAssistant ? "" : "justify-end"
                          }`}
                        >
                          {isAssistant && (
                            <div className="h-9 w-9 rounded-lg bg-[#182127] border border-white/10 flex items-center justify-center font-mono text-emerald-400 text-sm font-bold shrink-0">
                              RAG
                            </div>
                          )}

                          <div
                            className={`space-y-2.5 ${
                              isAssistant ? "max-w-[92%]" : "max-w-[85%]"
                            }`}
                          >
                            <div
                              className={`${
                                isAssistant
                                  ? "tactile-recessed p-5 rounded-xl text-sm sm:text-base text-slate-100 leading-relaxed space-y-3"
                                  : "tactile-raised-btn bg-[#141b20] p-4 rounded-xl text-sm sm:text-base text-slate-100 border-emerald-500/20 leading-relaxed"
                              }`}
                            >
                              {/* Attached image preview if present */}
                              {msg.attachment?.url && (
                                <div className="mb-2 p-2 rounded bg-black/50 border border-white/10 max-w-xs">
                                  <img
                                    src={msg.attachment.url}
                                    alt="Attached"
                                    className="rounded max-h-32 object-contain"
                                  />
                                  <span className="text-xs font-mono text-cyan-400 block mt-1">
                                    [Analyzed via gemini-3.1-pro-preview]
                                  </span>
                                </div>
                              )}

                              <div className="whitespace-pre-wrap">{msg.content}</div>

                              {/* Interactive Citation Badges */}
                              {msg.citations && msg.citations.length > 0 && (
                                <div className="pt-2.5 flex flex-wrap items-center gap-2 border-t border-white/[0.06]">
                                  <span className="text-xs font-mono text-slate-300 font-semibold">
                                    Verified Sources:
                                  </span>
                                  {msg.citations.map((cit, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleHighlightEvidence(cit.chunkId)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/40 text-xs font-mono hover:bg-emerald-500/30 transition-colors"
                                    >
                                      <span>[{cit.source} - Page {cit.page}]</span>
                                      <ExternalLink className="w-3 h-3 text-emerald-400" />
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Expandable Retrieval Trace Accordion */}
                              {msg.retrievalTrace && (
                                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                                  <button
                                    onClick={() => setIsTraceOpen(!isTraceOpen)}
                                    className="flex items-center justify-between w-full text-left font-mono text-xs sm:text-sm text-slate-300 hover:text-slate-100 py-1"
                                  >
                                    <span className="flex items-center gap-1.5 font-semibold">
                                      {isTraceOpen ? "▼" : "▶"} RETRIEVAL TRACE & COGNITIVE GROUNDING
                                    </span>
                                    <span className="text-emerald-400 font-bold">
                                      Confidence: {msg.retrievalTrace.confidence}%
                                    </span>
                                  </button>

                                  {isTraceOpen && (
                                    <div className="mt-2.5 p-3.5 rounded-lg bg-[#07090b]/70 border border-white/[0.05] space-y-2 text-xs sm:text-sm font-mono">
                                      <div className="flex justify-between text-slate-400">
                                        <span>Hybrid Search Pool:</span>
                                        <span className="text-slate-200">
                                          {msg.retrievalTrace.candidatePool} Candidates (BM25: 11, Dense Vector: 12)
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-slate-400">
                                        <span>Cross-Encoder Threshold:</span>
                                        <span className="text-slate-200">
                                          &gt; {msg.retrievalTrace.threshold} Score cutoff (Top 5 selected)
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-slate-400">
                                        <span>Deduplication & Rerank:</span>
                                        <span className="text-emerald-400 font-bold">
                                          {msg.retrievalTrace.bm25Score} BM25 · {msg.retrievalTrace.cosineScore} Cosine Alignment
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {!isAssistant && (
                            <div className="h-9 w-9 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center font-mono text-emerald-300 text-sm font-bold shrink-0">
                              SV
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {isSending && (
                      <div className="flex items-start gap-3.5">
                        <div className="h-9 w-9 rounded-lg bg-[#182127] border border-white/10 flex items-center justify-center font-mono text-emerald-400 text-sm font-bold shrink-0">
                          RAG
                        </div>
                        <div className="tactile-recessed p-4 rounded-xl text-sm font-mono text-emerald-400 flex items-center gap-2.5">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generating hybrid synthesis with {enableHighThinking ? "gemini-3.1-pro-preview (High Thinking)" : selectedModel}...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recommendation Prompt Chips */}
                  <div className="pt-2.5 pb-1 border-t border-white/[0.04] flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        handleSendMessage("Summarize Key Leave Requirements & Sabbatical Rules")
                      }
                      className="tactile-raised-btn px-3 py-1.5 rounded-md text-xs sm:text-sm font-mono text-slate-300 hover:text-emerald-300 flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4 text-emerald-400" /> Summarize Leave Requirements
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage(
                          "Explain Section 4.2 Severance calculations and non-compete covenants"
                        )
                      }
                      className="tactile-raised-btn px-3 py-1.5 rounded-md text-xs sm:text-sm font-mono text-slate-300 hover:text-emerald-300 flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4 text-emerald-400" /> Explain Section 4.2 Severance
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage("Compare Medical vs Dental Coverage maximums and deductibles")
                      }
                      className="tactile-raised-btn px-3 py-1.5 rounded-md text-xs sm:text-sm font-mono text-slate-300 hover:text-emerald-300 flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4 text-emerald-400" /> Compare Medical vs Dental Coverage
                    </button>
                  </div>

                  {/* Input Bar with Micro-chips and TRANSMIT */}
                  <div className="mt-2 pt-2 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between pb-2">
                      <div className="flex items-center gap-2.5">
                        {/* Model Dropdown */}
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="tactile-raised-btn px-2.5 py-1 rounded text-xs font-mono text-slate-200 bg-transparent border-0 focus:ring-0 cursor-pointer"
                        >
                          <option value="gemini-3.5-flash" className="bg-[#0b0f12]">
                            Model: Gemini 3.5 Flash
                          </option>
                          <option value="gemini-3.1-pro-preview" className="bg-[#0b0f12]">
                            Model: Gemini 3.1 Pro Preview
                          </option>
                          <option value="gemini-3.1-flash-lite" className="bg-[#0b0f12]">
                            Model: Gemini 3.1 Flash Lite
                          </option>
                        </select>

                        <span className="tactile-raised-btn px-2.5 py-1 rounded text-xs font-mono text-slate-300 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-cyan-400"></span> Retrieval: Hybrid (BM25 + ADA-002)
                        </span>
                      </div>

                      <span className="text-xs font-mono text-slate-400">
                        Press <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/10 text-slate-300">Enter ↵</kbd>
                      </span>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                      }}
                      className="relative flex items-center"
                    >
                      <input
                        type="text"
                        value={inputQuery}
                        onChange={(e) => setInputQuery(e.target.value)}
                        placeholder="Ask a question against employee_handbook_2026.pdf (e.g. sabbatical, severance, leave)..."
                        className="w-full rounded-xl bg-[#07090b] py-4 pl-4 pr-36 text-sm sm:text-base font-mono text-slate-100 placeholder-slate-500 border border-white/[0.08] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)]"
                      />

                      <div className="absolute right-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onOpenImageAnalysis}
                          className="p-2.5 text-slate-400 hover:text-cyan-300 rounded-lg hover:bg-white/5"
                          title="Attach Document Image / Scan"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <button
                          type="submit"
                          disabled={!inputQuery.trim() || isSending}
                          className="tactile-emerald-btn flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono font-bold text-white tracking-wide disabled:opacity-50"
                        >
                          <span>TRANSMIT</span>
                          <span>↵</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Evidence & Retrieval Inspector (35%) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="tactile-card rounded-xl p-4 sm:p-5 flex flex-col h-[740px]">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold tracking-wider text-slate-200 uppercase">
                        RETRIEVAL EVIDENCE & RERANK SCORE
                      </span>
                    </div>
                    <span className="font-mono text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded font-semibold">
                      TOP 3 CHUNKS
                    </span>
                  </div>

                  {/* Scrollable Evidence List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {chunks.slice(0, 3).map((chunk) => {
                      const isTargeted = highlightedChunkId === chunk.id;
                      return (
                        <article
                          key={chunk.id}
                          id={`chunk-card-${chunk.id}`}
                          className={`tactile-recessed rounded-xl p-4 border-l-4 transition-all duration-300 ${
                            chunk.id === 184
                              ? "border-emerald-400"
                              : chunk.id === 185
                              ? "border-emerald-500/70"
                              : "border-slate-600"
                          } ${
                            isTargeted
                              ? "ring-2 ring-emerald-400 bg-[#141b20] scale-[1.01]"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs sm:text-sm font-mono mb-2">
                            <span className="font-bold text-slate-200">
                              CHUNK #{chunk.id}
                            </span>
                            <span className="text-emerald-400 font-bold">
                              Score: {chunk.score.toFixed(3)}
                            </span>
                          </div>

                          {/* Metrics Bar */}
                          <div className="grid grid-cols-3 gap-1.5 mb-3 font-mono text-xs text-slate-300 bg-black/40 p-2 rounded border border-white/[0.04]">
                            <div>
                              BM25: <span className="text-slate-100 font-semibold">{chunk.bm25}</span>
                            </div>
                            <div>
                              Cosine: <span className="text-slate-100 font-semibold">{chunk.cosine}</span>
                            </div>
                            <div>
                              Page:{" "}
                              <span className="text-emerald-300 font-bold">
                                {chunk.page}
                              </span>
                            </div>
                          </div>

                          {/* Score Bar */}
                          <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden mb-3">
                            <div
                              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                              style={{ width: `${Math.round(chunk.score * 100)}%` }}
                            ></div>
                          </div>

                          <p className="text-sm text-slate-200 leading-relaxed font-sans bg-[#0b0f12]/60 p-3 rounded border border-white/[0.04]">
                            {chunk.content}
                          </p>
                        </article>
                      );
                    })}
                  </div>

                  {/* Inspector Footer Action */}
                  <div className="pt-3 border-t border-white/[0.08] flex justify-between items-center text-sm font-mono">
                    <span className="text-slate-400">Embedding: Text-Embedding-3-Large</span>
                    <button
                      onClick={() => setActiveTab("retrieval")}
                      className="text-emerald-400 hover:text-emerald-300 underline font-semibold flex items-center gap-1.5"
                    >
                      <span>Inspect Matrix</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
            {/* END: DualColumnAnalystConsole */}
          </div>
        )}

        {/* VIEW 2: DOCUMENTS */}
        {activeTab === "documents" && (
          <div className="tactile-card rounded-xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white font-mono uppercase">
                  Indexed Knowledge Repositories
                </h2>
                <p className="text-sm text-slate-300 font-mono mt-1">
                  {documents.length} total documents · 14,280 chunks indexed with Vector + Inverted index
                </p>
              </div>

              <button
                onClick={onOpenImageAnalysis}
                className="tactile-emerald-btn px-4 py-2.5 rounded-lg text-sm font-mono font-bold flex items-center gap-2"
              >
                <span>+ UPLOAD & ANALYZE NEW CORPUS</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-300 uppercase text-xs font-semibold">
                    <th className="py-3.5 px-4">Document Title</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Pages</th>
                    <th className="py-3.5 px-4">Chunks</th>
                    <th className="py-3.5 px-4">Index Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-slate-200">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-white/[0.02]">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2.5">
                        <span
                          className={`font-bold ${
                            doc.type === "PDF"
                              ? "text-red-400"
                              : doc.type === "DOCX"
                              ? "text-blue-400"
                              : doc.type === "MD"
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {doc.type}
                        </span>
                        <span>{doc.title}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{doc.category}</td>
                      <td className="py-3.5 px-4">{doc.pages}</td>
                      <td className="py-3.5 px-4">{doc.chunks}</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">
                        ● Synced ({doc.syncPercentage}%)
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setActiveTab("workspace")}
                          className="tactile-raised-btn px-3 py-1.5 rounded text-xs font-semibold text-slate-200"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: PIPELINE */}
        {activeTab === "pipeline" && (
          <div className="tactile-card rounded-xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white font-mono uppercase mb-1">
                Detailed Hybrid Execution Topology
              </h2>
              <p className="text-sm text-slate-300 font-mono">
                Real-time trace telemetry for multimodal embedding and reranker orchestration.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="tactile-recessed p-5 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between font-mono text-sm">
                  <span className="text-slate-100 font-bold">1. DENSE VECTOR BRANCH</span>
                  <span className="text-emerald-400 font-bold">280ms</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Embedding: Text-Embedding-3-Large (1536 dim). Cosine similarity index over HNSW graph index with M=16, efConstruction=64.
                </p>
                <div className="font-mono text-xs sm:text-sm text-slate-200 pt-1">
                  Top-K Candidate Pool: <strong className="text-emerald-400">12 matches</strong>
                </div>
              </div>

              <div className="tactile-recessed p-5 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between font-mono text-sm">
                  <span className="text-slate-100 font-bold">2. SPARSE BM25 BRANCH</span>
                  <span className="text-emerald-400 font-bold">14ms</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Exact token overlap match using Okapi BM25 (k1=1.2, b=0.75). Filtered for stop-words with morphological lemmatization.
                </p>
                <div className="font-mono text-xs sm:text-sm text-slate-200 pt-1">
                  Top-K Candidate Pool: <strong className="text-emerald-400">11 matches</strong>
                </div>
              </div>

              <div className="tactile-recessed p-5 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between font-mono text-sm">
                  <span className="text-slate-100 font-bold">3. CROSS-ENCODER RERANK</span>
                  <span className="text-emerald-400 font-bold">92ms</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Reciprocal Rank Fusion (RRF k=60) fed into BAAI/bge-reranker-large. Cutoff score strictly pegged at &gt;= 0.80.
                </p>
                <div className="font-mono text-xs sm:text-sm text-slate-200 pt-1">
                  Final Injected Chunks: <strong className="text-emerald-400">5 matches</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: RETRIEVAL */}
        {activeTab === "retrieval" && (
          <div className="tactile-card rounded-xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white font-mono uppercase mb-1">
                Deep Candidate Inspector Matrix
              </h2>
              <p className="text-sm text-slate-300 font-mono">
                Cross-correlation between Sparse Lexical (BM25) and Semantic Dense Cosine scores.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-300 uppercase text-xs font-semibold">
                    <th className="py-3 px-3.5">Chunk ID</th>
                    <th className="py-3 px-3.5">BM25 Lexical</th>
                    <th className="py-3 px-3.5">Dense Cosine</th>
                    <th className="py-3 px-3.5">RRF Score</th>
                    <th className="py-3 px-3.5">Cross-Encoder</th>
                    <th className="py-3 px-3.5">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-slate-200">
                  {chunks.map((c) => (
                    <tr
                      key={c.id}
                      className={`hover:bg-white/[0.02] ${
                        !c.injected ? "opacity-60" : ""
                      }`}
                    >
                      <td className="py-3 px-3.5 text-white font-bold">
                        #{c.id} (Page {c.page})
                      </td>
                      <td className="py-3 px-3.5 text-cyan-400 font-medium">{c.bm25}</td>
                      <td className="py-3 px-3.5 text-emerald-400 font-medium">{c.cosine}</td>
                      <td className="py-3 px-3.5">{c.rrfScore}</td>
                      <td className="py-3 px-3.5 font-bold text-emerald-300">
                        {c.score.toFixed(3)}
                      </td>
                      <td className="py-3 px-3.5">
                        {c.injected ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs font-medium">
                            INJECTED
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded bg-red-500/20 text-red-300 text-xs font-medium">
                            DROPPED (&lt;0.80)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 5: AUDIT */}
        {activeTab === "audit" && (
          <div className="tactile-card rounded-xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white font-mono uppercase mb-1">
                Chronological System Audit Trail
              </h2>
              <p className="text-sm text-slate-300 font-mono">
                Cryptographically verified execution events for compliance and security.
              </p>
            </div>

            <div className="space-y-3 font-mono text-sm">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="tactile-recessed p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold">[{log.timestamp}]</span>
                    <span className="text-slate-100 font-semibold">{log.eventType}</span>
                    <span className="text-slate-300">{log.details}</span>
                  </div>
                  <span className="text-slate-400 text-xs shrink-0 font-medium">
                    {log.userOrWorker}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 tactile-card border-emerald-500/40 px-4 py-3 rounded-xl font-mono text-sm text-emerald-300 flex items-center gap-2.5 shadow-2xl animate-in slide-in-from-bottom-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 led-pulse"></span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
