export type ActiveSystemMode = 'rag-workstation' | 'forgeml';

export type RAGTabId = 'workspace' | 'documents' | 'pipeline' | 'retrieval' | 'audit';

export interface RetrievedChunk {
  id: number;
  score: number;
  bm25: number;
  cosine: number;
  rrfScore: number;
  page: number;
  content: string;
  sourceDoc: string;
  injected: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  thinkingLevel?: 'HIGH' | 'NONE' | 'STANDARD';
  citations?: Array<{ source: string; page: number; chunkId: number; score: number }>;
  retrievalTrace?: {
    candidatePool: number;
    threshold: number;
    bm25Score: number;
    cosineScore: number;
    confidence: number;
  };
  attachment?: {
    name: string;
    type: string;
    url?: string;
  };
}

export interface IndexedDocument {
  id: string;
  title: string;
  type: 'PDF' | 'DOCX' | 'MD' | 'CSV';
  category: string;
  pages: number;
  chunks: number;
  densityMb: number;
  syncPercentage: number;
  sha256: string;
  lastEmbedded: string;
}

export interface PipelineStage {
  id: string;
  num: string;
  name: string;
  latencyMs: number;
  badge: string;
  isAccent?: boolean;
  status: 'completed' | 'active' | 'pending';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  details: string;
  userOrWorker: string;
  status: 'success' | 'warning' | 'info';
}

// ForgeML Types
export interface ForgeMLConfig {
  targetColumn: string;
  selectedFeatures: string[];
  missingValues: 'drop' | 'impute' | 'ignore';
  standardScale: boolean;
  oneHotEncode: boolean;
  smote: boolean;
  testSetSize: number;
  algorithm: 'Random Forest' | 'KNN' | 'Log Reg' | 'Linear Reg' | 'Naive Bayes';
  datasetName?: string;
  hasDataset: boolean;
}
