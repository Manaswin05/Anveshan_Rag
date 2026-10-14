import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  File,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader,
} from "lucide-react";
import type { IndexedDocument } from "../types";
import { initialDocuments } from "../data/mockCorpus";

const fileTypeIcon = (type: string) => {
  switch (type) {
    case "PDF":  return <File className="h-5 w-5 text-red-400" />;
    case "DOCX": return <FileText className="h-5 w-5 text-blue-400" />;
    case "CSV":  return <FileSpreadsheet className="h-5 w-5 text-green-400" />;
    default:     return <FileText className="h-5 w-5 text-muted-foreground" />;
  }
};

interface UploadState {
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
  progress?: number;
}

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<IndexedDocument[]>(initialDocuments);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const allowed = [".pdf", ".docx", ".txt", ".csv"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadState({ status: "error", message: `Unsupported type: ${ext}. Use PDF, DOCX, TXT, or CSV.` });
      return;
    }

    setUploadState({ status: "uploading", message: "Processing document…", progress: 0 });

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadState((prev) => ({
          ...prev,
          progress: Math.min((prev.progress || 0) + 15, 85),
        }));
      }, 300);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      setUploadState({ status: "success", message: "Document indexed successfully!", progress: 100 });

      // Add to list
      const newDoc: IndexedDocument = {
        id: `doc-${Date.now()}`,
        title: file.name,
        type: ext.replace(".", "").toUpperCase() as IndexedDocument["type"],
        category: "Uploaded",
        pages: data.metadata?.page_count ?? 0,
        chunks: data.metadata?.chunk_count ?? 0,
        densityMb: +(file.size / 1048576).toFixed(2),
        syncPercentage: 100,
        sha256: "—",
        lastEmbedded: "Just now",
      };
      setDocuments((prev) => [newDoc, ...prev]);
      showToast(`✓ ${file.name} indexed — ${newDoc.chunks} chunks`);

      setTimeout(() => setUploadState({ status: "idle" }), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadState({ status: "error", message: msg });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    showToast("Document removed");
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Documents</h1>
          <p className="page-subtitle">
            {documents.length} documents indexed · Hybrid vector + BM25 index
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <div
        className={`upload-zone ${dragging ? "upload-zone-active" : ""} ${
          uploadState.status === "error" ? "upload-zone-error" : ""
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload document"
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.csv"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {uploadState.status === "uploading" ? (
          <div className="upload-progress">
            <Loader className="h-8 w-8 animate-spin text-accent" />
            <p className="upload-status-text">{uploadState.message}</p>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${uploadState.progress}%` }} />
            </div>
          </div>
        ) : uploadState.status === "success" ? (
          <div className="upload-success">
            <CheckCircle className="h-8 w-8 text-success" />
            <p className="upload-status-text text-success">{uploadState.message}</p>
          </div>
        ) : uploadState.status === "error" ? (
          <div className="upload-error-state">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="upload-status-text text-destructive">{uploadState.message}</p>
            <span className="upload-hint">Click to try again</span>
          </div>
        ) : (
          <div className="upload-idle">
            <div className="upload-icon-ring">
              <Upload className="h-6 w-6 text-accent" />
            </div>
            <p className="upload-title">Drop a document here</p>
            <p className="upload-subtitle">or click to browse · PDF, DOCX, TXT, CSV</p>
          </div>
        )}
      </div>

      {/* Documents list */}
      <div className="doc-list">
        <div className="doc-list-header">
          <span>Document</span>
          <span>Pages</span>
          <span>Chunks</span>
          <span>Size</span>
          <span>Status</span>
          <span />
        </div>

        {documents.length === 0 ? (
          <div className="doc-list-empty">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p>No documents indexed yet. Upload one above.</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="doc-row">
              <div className="doc-name">
                {fileTypeIcon(doc.type)}
                <div>
                  <p className="doc-title">{doc.title}</p>
                  <p className="doc-category">{doc.category}</p>
                </div>
              </div>
              <span className="doc-stat">{doc.pages}</span>
              <span className="doc-stat">{doc.chunks}</span>
              <span className="doc-stat">{doc.densityMb} MB</span>
              <div className="doc-status">
                <span className="pip pip-success" />
                <span>{doc.syncPercentage}%</span>
              </div>
              <div className="doc-actions">
                <button
                  className="doc-action-btn"
                  title="Re-index document"
                  onClick={() => showToast(`Re-indexing ${doc.title}…`)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  className="doc-action-btn doc-action-delete"
                  title="Remove document"
                  onClick={() => handleDelete(doc.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {toastMessage && (
        <div className="toast" role="status">
          <span className="pip pip-success pip-pulse" />
          {toastMessage}
        </div>
      )}
    </div>
  );
};
