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
import { RobotModel } from "./RobotModel";


import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
  const [activeTab, setActiveTab] = useState<string>("workspace");
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
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleHighlightEvidence = (chunkId: number) => {
    setHighlightedChunkId(chunkId);
    const element = document.getElementById(`chunk-card-${chunkId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => setHighlightedChunkId(null), 2000);
  };

  const handleReindex = () => {
    setIsReindexing(true);
    setTimeout(() => {
      setIsReindexing(false);
      showToast("Corpus re-indexed: 386 dense vectors refreshed");
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

  const tabsItems = [
    { id: "workspace", label: "WORKSPACE" },
    { id: "documents", label: "DOCUMENTS", count: documents.length },
    { id: "pipeline", label: "PIPELINE" },
    { id: "retrieval", label: "RETRIEVAL" },
    { id: "audit", label: "AUDIT" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HEADER */}
      <header className="header-glow sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b-0 bg-background/95 backdrop-blur-sm px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-surface-1">
            <Zap className="h-5 w-5 text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium uppercase tracking-[0.08em] text-accent">
                ANVESHAN RAG
              </span>
              <span className="pip pip-online pip-pulse" />
            </div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mt-0.5">
              Obsidian Command · v2.4
            </p>
          </div>
        </div>

        {/* Center: Navigation Tabs (using Shadcn Tabs structure for header) */}
        <div className="hidden md:flex h-full items-center">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList variant="line" className="h-full">
              {tabsItems.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="h-full text-xs font-mono uppercase tracking-wider rounded-none data-[state=active]:border-b-2 data-[state=active]:border-accent">
                  <div className="flex items-center gap-2">
                    {activeTab === tab.id && <span className="pip pip-online" style={{ width: 6, height: 6 }} />}
                    {tab.label}
                    {tab.count !== undefined && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px] rounded-sm">{tab.count}</Badge>
                    )}
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-2 rounded-md border bg-surface-1 px-3 py-1.5">
            <span className="pip pip-success" />
            <span className="font-mono text-[11px] font-medium uppercase text-foreground">
              {enableHighThinking ? "GEMINI 3.1 PRO (HIGH)" : selectedModel.toUpperCase()}
            </span>
            <span className="ml-2 border-l pl-2 font-mono text-[11px] font-medium text-muted-foreground">14ms</span>
          </div>

          <Button variant="ghost" size="sm" onClick={onOpenCommandPalette} className="hidden sm:flex">
            <kbd className="rounded-sm border bg-surface-0 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </Button>

          <Button variant="ghost" size="sm" onClick={onOpenImageAnalysis} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline font-mono text-[11px] font-medium">ANALYZE</span>
          </Button>

          <Button variant="ghost" size="icon" onClick={() => showToast("All corpora synchronized")}>
            <div className="relative">
              <Bell className="h-4 w-4" />
              <span className="pip pip-warning absolute -right-1 -top-1 h-1.5 w-1.5" />
            </div>
          </Button>

          <div className="flex items-center gap-2.5 rounded-md border bg-surface-1 px-3 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-mono text-[11px] font-bold text-background">
              SV
            </div>
            <div className="hidden xl:block">
              <p className="font-mono text-xs font-medium text-foreground">SV-402</p>
              <p className="font-mono text-[10px] font-medium tracking-wider text-muted-foreground">ADMIN TIER 3</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-6">
        <Tabs value={activeTab} className="w-full">
          {/* VIEW 1: WORKSPACE */}
          <TabsContent value="workspace" className="flex flex-col gap-6 mt-0 animate-tab-content">
            <section className="flex flex-wrap items-center justify-between gap-4 border-b pb-5 animate-fade-in-up">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-sans text-2xl font-semibold text-accent">RAG Intelligence Workstation</h1>
                  <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/10 text-success">
                    <span className="pip pip-success h-1.5 w-1.5" /> PIPELINE READY
                  </Badge>
                </div>
                <p className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground mt-2">
                  Hybrid Retrieval (BM25 + Dense Vectors) · Cross-Encoder Reranking · HITL Supervision
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Button variant="ghost" onClick={onOpenHitl} className="gap-2">
                  <span className="pip pip-warning pip-pulse" /> SIMULATE HITL
                </Button>
                <Button variant="ghost" onClick={handleReindex} disabled={isReindexing} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${isReindexing ? "animate-spin" : ""}`} />
                  {isReindexing ? "RE-INDEXING..." : "RE-INDEX"}
                </Button>
              </div>
            </section>

            <Card className="bg-surface-1 p-6 animate-fade-in-up stagger-1">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md border bg-surface-0 font-mono text-xs font-bold text-destructive">
                    PDF
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-medium text-accent">employee_handbook_2026.pdf</span>
                      <Badge variant="secondary" className="font-mono text-[10px] tracking-wider">ACTIVE INDEX</Badge>
                    </div>
                    <p className="mt-1 max-w-[500px] font-mono text-[10px] tracking-wider text-muted-foreground">
                      SHA-256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="pip pip-success" />
                  <span className="font-mono text-xs font-medium text-foreground">Last Embedded: Today 13:04:18 UTC (100%)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "PAGES", value: "42", sub: "✓ Annotated & OCR Verified", subColor: 'text-success' },
                  { label: "CHUNKS", value: "386", sub: "1,000 token target chunk size" },
                  { label: "DENSITY / SIZE", value: "4.8", unit: "MB", sub: "Dense 1536-dim vectors (Float32)" },
                  { label: "OVERLAP", value: "100", unit: "tok", sub: "10% sliding semantic window", subColor: 'text-info' },
                ].map((m) => (
                  <div key={m.label} className="rounded-md border bg-surface-0 p-4 hover-lift">
                    <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{m.label}</div>
                    <div className="mt-1 font-mono text-4xl font-bold text-accent">
                      {m.value}
                      {m.unit && <span className="ml-1 text-sm text-muted-foreground">{m.unit}</span>}
                    </div>
                    <div className={`mt-1.5 font-mono text-[10px] font-medium ${m.subColor || 'text-muted-foreground'}`}>
                      {m.sub}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-surface-1 p-6 animate-fade-in-up stagger-2">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Cpu className="h-4 w-4 text-accent" /> PIPELINE EXECUTION MONITOR · 9-STAGE
                </span>
                <span className="font-mono text-xs font-medium text-accent">TOTAL: 1.28s</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-9">
                {stages.map((stg) => (
                  <div key={stg.id} className={`flex flex-col items-center justify-center rounded-md border bg-surface-0 p-2.5 text-center border-l-4 hover-lift ${stg.name === "HITL" ? 'border-l-warning' : stg.isAccent ? 'border-l-info' : 'border-l-accent'}`}>
                    <div className={`font-mono text-[10px] font-medium tracking-wider ${stg.name === "HITL" ? 'text-warning' : stg.isAccent ? 'text-info' : 'text-foreground'}`}>
                      {stg.num}. {stg.name}
                    </div>
                    <div className={`mt-0.5 font-mono text-sm font-bold ${stg.name === "HITL" ? 'text-warning' : 'text-accent'}`}>
                      {stg.name === "HITL" ? "ONLINE" : `${stg.latencyMs}ms`}
                    </div>
                    <div className={`mt-0.5 font-mono text-[9px] font-medium tracking-wider ${stg.isAccent ? 'text-info' : stg.name === "HITL" ? 'text-warning' : 'text-muted-foreground'}`}>
                      {stg.badge}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              <div className="lg:col-span-8">
                <Card className="flex h-[calc(100vh-240px)] min-h-[500px] flex-col bg-surface-1 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <span className="pip pip-online" />
                      <span className="font-mono text-xs font-medium uppercase tracking-wider text-foreground">DOCUMENT INTELLIGENCE CONSOLE</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Button 
                        variant={enableHighThinking ? "secondary" : "outline"} 
                        size="sm" 
                        onClick={() => setEnableHighThinking(!enableHighThinking)}
                        className={`h-7 px-2.5 font-mono text-[11px] ${enableHighThinking ? 'bg-info/10 text-info border-info/40' : ''}`}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> High Thinking: {enableHighThinking ? "ON" : "OFF"}
                      </Button>
                      <span className="font-mono text-[10px] font-medium tracking-wider text-muted-foreground">
                        Session: <span className="text-foreground">#WKST-982</span>
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 font-mono text-[11px]" onClick={() => {
                        setMessages([{ id: "m-reset", role: "assistant", content: "Session buffer cleared. Active index: employee_handbook_2026.pdf ready for new inquiries.", timestamp: new Date().toISOString().substring(11, 19) + " UTC" }]);
                      }}>CLEAR</Button>
                    </div>
                  </div>

                  <div className="relative flex-1 overflow-hidden">
                    <RobotModel isThinking={isSending} />
                    <ScrollArea className="h-full pr-4" ref={chatScrollRef}>
                      <div className="flex flex-col gap-5 py-4 relative z-10">
                        {messages.map((msg) => (
                          <div key={msg.id} className={`flex items-start gap-3 animate-message-in ${msg.role === "assistant" ? 'justify-start' : 'justify-end'}`}>
                            {msg.role === "assistant" && (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-surface-1 font-mono text-[11px] font-bold text-accent">RAG</div>
                            )}
                            <div className="max-w-[90%]">
                              <div className={`rounded-xl border p-5 text-sm leading-[22px] text-foreground ${msg.role === "assistant" ? 'bg-surface-0/90' : 'bg-surface-1/90 border-accent/20'} backdrop-blur-sm`}>
                                {msg.attachment?.url && (
                                  <div className="mb-2.5 max-w-[260px] rounded-md border bg-surface-0 p-2">
                                    <img src={msg.attachment.url} alt="Attached" className="max-h-32 rounded-sm object-contain" />
                                  <span className="mt-1 block font-mono text-[10px] text-info">[Analyzed via gemini-3.1-pro-preview]</span>
                                </div>
                              )}
                              <div className="whitespace-pre-wrap">{msg.content}</div>

                              {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                                  <span className="font-mono text-[10px] font-medium text-foreground">Sources:</span>
                                  {msg.citations.map((cit, idx) => (
                                    <Badge key={idx} variant="secondary" className="cursor-pointer gap-1 px-2 font-mono text-[10px] hover:bg-muted" onClick={() => handleHighlightEvidence(cit.chunkId)}>
                                      [{cit.source} — Pg {cit.page}] <ExternalLink className="h-2.5 w-2.5" />
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              {msg.retrievalTrace && (
                                <div className="mt-3 border-t pt-3">
                                  <button onClick={() => setIsTraceOpen(!isTraceOpen)} className="flex w-full items-center justify-between text-left">
                                    <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-foreground">
                                      {isTraceOpen ? "▾" : "▸"} RETRIEVAL TRACE
                                    </span>
                                    <span className="font-mono text-[10px] font-medium text-accent">Confidence: {msg.retrievalTrace.confidence}%</span>
                                  </button>
                                  {isTraceOpen && (
                                    <div className="mt-2 flex flex-col gap-1.5 rounded-md border bg-surface-0 p-3">
                                      <div className="flex justify-between font-mono text-[10px] font-medium"><span className="text-muted-foreground">Hybrid Search Pool:</span><span className="text-foreground">{msg.retrievalTrace.candidatePool} Candidates (BM25: 11, Dense: 12)</span></div>
                                      <div className="flex justify-between font-mono text-[10px] font-medium"><span className="text-muted-foreground">Cross-Encoder Threshold:</span><span className="text-foreground">&gt; {msg.retrievalTrace.threshold} Score cutoff (Top 5)</span></div>
                                      <div className="flex justify-between font-mono text-[10px] font-medium"><span className="text-muted-foreground">Dedup & Rerank:</span><span className="text-accent">{msg.retrievalTrace.bm25Score} BM25 · {msg.retrievalTrace.cosineScore} Cosine</span></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {msg.role === "user" && (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-surface-interactive font-mono text-[11px] font-bold text-accent">SV</div>
                          )}
                        </div>
                      ))}
                      {isSending && (
                        <div className="flex items-start gap-3 relative z-10">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-surface-1 font-mono text-[11px] font-bold text-accent">RAG</div>
                          <div className="flex items-center gap-2.5 rounded-xl border bg-surface-0/90 p-4 backdrop-blur-sm">
                            <RefreshCw className="h-4 w-4 animate-spin text-accent" />
                            <span className="font-mono text-xs font-medium text-accent">Generating with {enableHighThinking ? "gemini-3.1-pro" : selectedModel}...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                  <div className="flex flex-wrap gap-2 border-t py-2.5">
                    {["Summarize Key Leave Requirements", "Explain Section 4.2 Severance", "Compare Medical vs Dental Coverage"].map((prompt) => (
                      <Badge key={prompt} variant="secondary" className="cursor-pointer gap-1.5 px-3 py-1 font-mono text-[10px] hover:bg-muted" onClick={() => handleSendMessage(prompt)}>
                        <Zap className="h-3.5 w-3.5 text-accent" /> {prompt}
                      </Badge>
                    ))}
                  </div>

                  <div className="border-t pt-2">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="rounded-md border bg-surface-0 px-2.5 py-1 font-mono text-[11px] font-medium text-foreground outline-none"
                        >
                          <option value="gemini-3.5-flash">Model: Gemini 3.5 Flash</option>
                          <option value="gemini-3.1-pro-preview">Model: Gemini 3.1 Pro Preview</option>
                        </select>
                        <Badge variant="outline" className="gap-1 font-mono text-[9px] tracking-wider">
                          <span className="pip pip-info h-1.5 w-1.5" /> Hybrid (BM25 + ADA-002)
                        </Badge>
                      </div>
                      <span className="font-mono text-[10px] font-medium text-muted-foreground">
                        Press <kbd className="rounded-sm border bg-surface-0 px-1.5 py-0.5 text-foreground">Enter ↵</kbd>
                      </span>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative flex items-center">
                      <Input
                        value={inputQuery}
                        onChange={(e) => setInputQuery(e.target.value)}
                        placeholder="Ask a question against employee_handbook_2026.pdf..."
                        className="h-12 w-full font-mono text-sm pr-[140px]"
                      />
                      <div className="absolute right-2 flex items-center gap-2">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenImageAnalysis}>
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Button type="submit" disabled={!inputQuery.trim() || isSending} className="h-8 px-4 font-mono text-xs font-bold tracking-widest">
                          TRANSMIT ↵
                        </Button>
                      </div>
                    </form>
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-4">
                <Card className="flex h-[calc(100vh-240px)] min-h-[500px] flex-col bg-surface-1 p-5">
                  <div className="mb-4 flex items-center justify-between border-b pb-3">
                    <span className="font-mono text-xs font-medium uppercase tracking-wider text-foreground">RETRIEVAL EVIDENCE</span>
                    <Badge variant="outline" className="border-success/30 bg-success/10 font-mono text-[9px] font-medium tracking-wider text-success">TOP 3 CHUNKS</Badge>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="flex flex-col gap-3 pr-3">
                      {chunks.slice(0, 3).map((chunk) => {
                        const isTargeted = highlightedChunkId === chunk.id;
                        return (
                          <div key={chunk.id} id={`chunk-card-${chunk.id}`} className={`rounded-lg border bg-surface-0 p-4 transition-all duration-300 ${isTargeted ? 'ring-2 ring-accent' : ''}`} style={{ borderLeftWidth: 3, borderLeftColor: chunk.id === 184 ? 'var(--accent)' : chunk.id === 185 ? 'var(--accent-dim)' : 'var(--foreground-dim)' }}>
                            <div className="mb-2 flex items-center justify-between font-mono text-xs font-medium">
                              <span className="text-foreground">CHUNK #{chunk.id}</span>
                              <span className="text-accent">Score: {chunk.score.toFixed(3)}</span>
                            </div>
                            <div className="mb-3 grid grid-cols-3 gap-1 rounded-md border bg-surface-1 p-2 font-mono text-[10px] font-medium">
                              <span className="text-muted-foreground">BM25: <span className="text-foreground">{chunk.bm25}</span></span>
                              <span className="text-muted-foreground">Cosine: <span className="text-foreground">{chunk.cosine}</span></span>
                              <span className="text-muted-foreground">Page: <span className="text-accent">{chunk.page}</span></span>
                            </div>
                            <Progress value={chunk.score * 100} className="mb-3 h-1" />
                            <p className="rounded-md border bg-surface-1 p-3 text-[13px] leading-5 text-foreground">{chunk.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  <div className="mt-3 flex items-center justify-between border-t pt-3 font-mono text-[10px] font-medium">
                    <span className="text-muted-foreground">Embedding: Text-Embedding-3-Large</span>
                    <button onClick={() => setActiveTab("retrieval")} className="text-accent underline">Inspect Matrix →</button>
                  </div>
                </Card>
              </div>
            </section>
          </TabsContent>

          {/* VIEW 2: DOCUMENTS */}
          <TabsContent value="documents" className="mt-0 animate-tab-content">
            <Card className="bg-surface-1 p-8 animate-fade-in-up">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-sans text-xl font-semibold text-accent">Indexed Knowledge Repositories</h2>
                  <p className="mt-1.5 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">{documents.length} documents · 14,280 chunks · Vector + Inverted index</p>
                </div>
                <Button onClick={onOpenImageAnalysis} className="font-mono text-xs font-bold tracking-widest">+ UPLOAD & ANALYZE NEW CORPUS</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Pages</TableHead>
                    <TableHead>Chunks</TableHead>
                    <TableHead>Index Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium text-accent">
                        <span className={`mr-2 font-bold ${doc.type === "PDF" ? 'text-destructive' : doc.type === "DOCX" ? 'text-blue-500' : doc.type === "MD" ? 'text-warning' : 'text-success'}`}>{doc.type}</span>
                        {doc.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{doc.category}</TableCell>
                      <TableCell>{doc.pages}</TableCell>
                      <TableCell>{doc.chunks}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-success">
                          <span className="pip pip-success h-1.5 w-1.5" /> Synced ({doc.syncPercentage}%)
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab("workspace")} className="font-mono text-[11px]">INSPECT</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* VIEW 3: PIPELINE */}
          <TabsContent value="pipeline" className="mt-0 animate-tab-content">
            <Card className="bg-surface-1 p-8 animate-fade-in-up">
              <div className="mb-6">
                <h2 className="font-sans text-xl font-semibold text-accent">Detailed Hybrid Execution Topology</h2>
                <p className="mt-1.5 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Real-time trace telemetry for multimodal embedding and reranker orchestration.</p>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {[
                  { title: "1. DENSE VECTOR BRANCH", time: "280ms", desc: "Embedding: Text-Embedding-3-Large (1536 dim). Cosine similarity index over HNSW graph index with M=16, efConstruction=64.", result: "Top-K Candidate Pool:", value: "12 matches" },
                  { title: "2. SPARSE BM25 BRANCH", time: "14ms", desc: "Exact token overlap match using Okapi BM25 (k1=1.2, b=0.75). Filtered for stop-words with morphological lemmatization.", result: "Top-K Candidate Pool:", value: "11 matches" },
                  { title: "3. CROSS-ENCODER RERANK", time: "92ms", desc: "Reciprocal Rank Fusion (RRF k=60) fed into BAAI/bge-reranker-large. Cutoff score strictly pegged at >= 0.80.", result: "Final Injected Chunks:", value: "5 matches" },
                ].map((item) => (
                  <Card key={item.title} className="bg-surface-0 p-5 hover-lift">
                    <div className="mb-3 flex items-center justify-between font-mono text-xs font-medium">
                      <span className="text-foreground">{item.title}</span>
                      <span className="text-accent">{item.time}</span>
                    </div>
                    <p className="mb-3 text-[13px] leading-5 text-muted-foreground">{item.desc}</p>
                    <div className="font-mono text-xs font-medium text-foreground">{item.result} <span className="font-bold text-accent">{item.value}</span></div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* VIEW 4: RETRIEVAL */}
          <TabsContent value="retrieval" className="mt-0 animate-tab-content">
            <Card className="bg-surface-1 p-8 animate-fade-in-up">
              <div className="mb-6">
                <h2 className="font-sans text-xl font-semibold text-accent">Deep Candidate Inspector Matrix</h2>
                <p className="mt-1.5 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Cross-correlation between Sparse Lexical (BM25) and Semantic Dense Cosine scores.</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chunk ID</TableHead>
                    <TableHead>BM25 Lexical</TableHead>
                    <TableHead>Dense Cosine</TableHead>
                    <TableHead>RRF Score</TableHead>
                    <TableHead>Cross-Encoder</TableHead>
                    <TableHead>Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chunks.map((c) => (
                    <TableRow key={c.id} className={c.injected ? "" : "opacity-50"}>
                      <TableCell className="font-bold text-accent">#{c.id} (Page {c.page})</TableCell>
                      <TableCell className="text-info">{c.bm25}</TableCell>
                      <TableCell className="text-accent">{c.cosine}</TableCell>
                      <TableCell>{c.rrfScore}</TableCell>
                      <TableCell className="font-bold text-accent">{c.score.toFixed(3)}</TableCell>
                      <TableCell>
                        {c.injected ? (
                          <Badge variant="outline" className="border-success/30 bg-success/10 font-mono text-[11px] text-success">INJECTED</Badge>
                        ) : (
                          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 font-mono text-[11px] text-destructive">DROPPED (&lt;0.80)</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* VIEW 5: AUDIT */}
          <TabsContent value="audit" className="mt-0 animate-tab-content">
            <Card className="bg-surface-1 p-8 animate-fade-in-up">
              <div className="mb-6">
                <h2 className="font-sans text-xl font-semibold text-accent">Chronological System Audit Trail</h2>
                <p className="mt-1.5 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Cryptographically verified execution events for compliance and security.</p>
              </div>
              <div className="flex flex-col gap-2.5">
                {auditLogs.map((log) => (
                  <Card key={log.id} className="flex flex-wrap items-center justify-between gap-2.5 bg-surface-0 p-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-medium text-accent">[{log.timestamp}]</span>
                      <span className="font-mono text-xs font-medium text-foreground">{log.eventType}</span>
                      <span className="font-mono text-[10px] font-medium text-muted-foreground">{log.details}</span>
                    </div>
                    <span className="font-mono text-[10px] font-medium text-foreground">{log.userOrWorker}</span>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Toast */}
      {toastMessage && (
        <div className="toast z-50 flex items-center gap-2.5 rounded-md border bg-surface-1 px-5 py-3 shadow-lg">
          <span className="pip pip-online pip-pulse h-2 w-2" />
          <span className="font-mono text-xs font-medium text-foreground">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
