/**
 * SettingsPage — API configuration, model selection, RAG tuning, audit logs.
 * All advanced/technical controls moved here from the main workspace.
 */
import React, { useState } from "react";
import {
  Key,
  Cpu,
  Sliders,
  ClipboardList,
  Save,
  CheckCircle,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { AuditLogEntry } from "../types";
import { initialAuditLogs } from "../data/mockCorpus";

type SettingsTab = "api" | "model" | "rag" | "audit";

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "api",   label: "API Keys",    icon: <Key size={15} /> },
  { id: "model", label: "Models",      icon: <Cpu size={15} /> },
  { id: "rag",   label: "RAG Config",  icon: <Sliders size={15} /> },
  { id: "audit", label: "Audit Log",   icon: <ClipboardList size={15} /> },
];

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("api");

  // API keys state
  const [geminiKey, setGeminiKey] = useState("");
  const [langsmithKey, setLangsmithKey] = useState("");
  const [showGemini, setShowGemini] = useState(false);
  const [showLangsmith, setShowLangsmith] = useState(false);
  const [apiSaved, setApiSaved] = useState(false);

  // Model state
  const [selectedProvider, setSelectedProvider] = useState<"gemini" | "ollama" | "lmstudio">("gemini");
  const [geminiModel, setGeminiModel] = useState("gemini-2.0-flash-exp");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.2:latest");
  const [lmstudioUrl, setLmstudioUrl] = useState("http://localhost:1234");
  const [lmstudioModel, setLmstudioModel] = useState("local-model");

  // RAG config state
  const [hybridSearch, setHybridSearch] = useState(true);
  const [reranking, setReranking] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(60);
  const [chunkSize, setChunkSize] = useState(512);
  const [topK, setTopK] = useState(5);

  const [toast, setToast] = useState<string | null>(null);
  const [auditLogs] = useState<AuditLogEntry[]>(initialAuditLogs);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveApiKeys = async () => {
    try {
      const res = await fetch("/api/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: geminiKey, langsmith_key: langsmithKey }),
      });
      if (!res.ok) throw new Error("Save failed");
      setApiSaved(true);
      setTimeout(() => setApiSaved(false), 3000);
      showToast("API keys saved");
    } catch {
      showToast("Failed to save API keys");
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure API keys, models, and retrieval behaviour.</p>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-body">
        {/* ── API Keys ── */}
        {activeTab === "api" && (
          <div className="settings-section">
            <h2 className="settings-section-title">API Keys</h2>

            <div className="field-group">
              <label className="field-label">
                Gemini API Key
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="field-link"
                  aria-label="Get Gemini API key (opens in new tab)"
                >
                  Get key <ExternalLink size={11} />
                </a>
              </label>
              <div className="field-input-wrap">
                <input
                  type={showGemini ? "text" : "password"}
                  className="field-input"
                  placeholder="AIza…"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  autoComplete="off"
                  aria-label="Gemini API key"
                />
                <button
                  className="field-eye-btn"
                  onClick={() => setShowGemini((v) => !v)}
                  aria-label={showGemini ? "Hide key" : "Show key"}
                >
                  {showGemini ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">
                LangSmith API Key
                <span className="field-optional">(optional — enables tracing)</span>
              </label>
              <div className="field-input-wrap">
                <input
                  type={showLangsmith ? "text" : "password"}
                  className="field-input"
                  placeholder="ls__…"
                  value={langsmithKey}
                  onChange={(e) => setLangsmithKey(e.target.value)}
                  autoComplete="off"
                  aria-label="LangSmith API key"
                />
                <button
                  className="field-eye-btn"
                  onClick={() => setShowLangsmith((v) => !v)}
                  aria-label={showLangsmith ? "Hide key" : "Show key"}
                >
                  {showLangsmith ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button className="save-btn" onClick={handleSaveApiKeys}>
              {apiSaved ? (
                <><CheckCircle size={14} /> Saved</>
              ) : (
                <><Save size={14} /> Save Keys</>
              )}
            </button>
          </div>
        )}

        {/* ── Model Selection ── */}
        {activeTab === "model" && (
          <div className="settings-section">
            <h2 className="settings-section-title">LLM Provider</h2>

            <div className="provider-tabs">
              {(["gemini", "ollama", "lmstudio"] as const).map((p) => (
                <button
                  key={p}
                  className={`provider-tab ${selectedProvider === p ? "active" : ""}`}
                  onClick={() => setSelectedProvider(p)}
                >
                  {p === "gemini" && "☁️ Google Gemini"}
                  {p === "ollama" && "🦙 Ollama (Local)"}
                  {p === "lmstudio" && "🖥️ LM Studio (Local)"}
                </button>
              ))}
            </div>

            {selectedProvider === "gemini" && (
              <div className="field-group">
                <label className="field-label">Gemini Model</label>
                <select
                  className="field-input field-select"
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  aria-label="Select Gemini model"
                >
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
                </select>
              </div>
            )}

            {selectedProvider === "ollama" && (
              <>
                <div className="info-box">
                  Make sure Ollama is running: <code>ollama serve</code>
                </div>
                <div className="field-group">
                  <label className="field-label">Ollama Base URL</label>
                  <input
                    type="text"
                    className="field-input"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    aria-label="Ollama base URL"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Model Name</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="llama3.2:latest"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    aria-label="Ollama model name"
                  />
                  <p className="field-hint">
                    Pull a model first: <code>ollama pull llama3.2</code>
                  </p>
                </div>
              </>
            )}

            {selectedProvider === "lmstudio" && (
              <>
                <div className="info-box">
                  Start LM Studio and enable the local server (port 1234).
                </div>
                <div className="field-group">
                  <label className="field-label">LM Studio Base URL</label>
                  <input
                    type="text"
                    className="field-input"
                    value={lmstudioUrl}
                    onChange={(e) => setLmstudioUrl(e.target.value)}
                    aria-label="LM Studio base URL"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Model Identifier</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="local-model"
                    value={lmstudioModel}
                    onChange={(e) => setLmstudioModel(e.target.value)}
                    aria-label="LM Studio model identifier"
                  />
                </div>
              </>
            )}

            <button className="save-btn" onClick={() => showToast("Model configuration saved")}>
              <Save size={14} /> Apply Configuration
            </button>
          </div>
        )}

        {/* ── RAG Config ── */}
        {activeTab === "rag" && (
          <div className="settings-section">
            <h2 className="settings-section-title">Retrieval Configuration</h2>

            <div className="toggle-row">
              <div>
                <span className="toggle-label">Hybrid Search</span>
                <span className="toggle-desc">BM25 + Dense Vector retrieval combined</span>
              </div>
              <button
                role="switch"
                aria-checked={hybridSearch}
                className={`toggle ${hybridSearch ? "on" : "off"}`}
                onClick={() => setHybridSearch((v) => !v)}
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="toggle-row">
              <div>
                <span className="toggle-label">Cross-Encoder Reranking</span>
                <span className="toggle-desc">FlashRank ms-marco-TinyBERT reranker</span>
              </div>
              <button
                role="switch"
                aria-checked={reranking}
                className={`toggle ${reranking ? "on" : "off"}`}
                onClick={() => setReranking((v) => !v)}
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="field-group">
              <label className="field-label">
                Confidence Threshold — {confidenceThreshold}%
              </label>
              <input
                type="range"
                min={10}
                max={95}
                step={5}
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="range-input"
                aria-label="Confidence threshold"
              />
              <p className="field-hint">Queries below this score trigger HITL escalation.</p>
            </div>

            <div className="field-group">
              <label className="field-label">Chunk Size — {chunkSize} tokens</label>
              <input
                type="range"
                min={256}
                max={1024}
                step={64}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="range-input"
                aria-label="Chunk size"
              />
            </div>

            <div className="field-group">
              <label className="field-label">Top-K Retrieval — {topK} chunks</label>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="range-input"
                aria-label="Top-K retrieval count"
              />
            </div>

            <button className="save-btn" onClick={() => showToast("RAG configuration saved")}>
              <Save size={14} /> Apply Settings
            </button>
          </div>
        )}

        {/* ── Audit Log ── */}
        {activeTab === "audit" && (
          <div className="settings-section">
            <h2 className="settings-section-title">Audit Trail</h2>
            <div className="audit-list">
              {auditLogs.map((log) => (
                <div key={log.id} className="audit-row">
                  <div className="audit-left">
                    <span className={`audit-dot ${log.status}`} aria-hidden />
                    <div className="audit-info">
                      <span className="audit-event">{log.eventType}</span>
                      <span className="audit-details">{log.details}</span>
                    </div>
                  </div>
                  <div className="audit-right">
                    <span className="audit-ts">{log.timestamp}</span>
                    <span className="audit-worker">{log.userOrWorker}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && <div className="toast" role="alert">{toast}</div>}
    </div>
  );
};
