# API Architecture — Enterprise RAG Workstation

> **Base URL:** `http://localhost:5000`  
> **Server:** Flask (Python) — `server.py`  
> **RAG Engine:** `rag_engine.py` (LangGraph + LangChain)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                            │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ API Key  │  │  Doc Upload  │  │   Chat    │  │  Escalation  │  │
│  │  Config  │  │  & Process   │  │ Interface │  │    Modal     │  │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  └──────┬───────┘  │
└───────┼───────────────┼────────────────┼───────────────┼───────────┘
        │               │                │               │
   POST /api/      POST /api/       POST /api/      POST /api/
   configure       upload           chat (SSE)      escalation/resume
        │               │                │               │
┌───────┼───────────────┼────────────────┼───────────────┼───────────┐
│       ▼               ▼                ▼               ▼           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  FLASK SERVER (server.py)                   │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │          In-Memory Session Store (_sessions)         │   │   │
│  │  │  • compiled graph app    • messages history          │   │   │
│  │  │  • checkpointer          • pending escalation        │   │   │
│  │  │  • thread_id             • API keys                  │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └────────────────────────┬────────────────────────────────────┘   │
│                           │                                        │
│                    imports directly                                 │
│                           │                                        │
│  ┌────────────────────────▼────────────────────────────────────┐   │
│  │                RAG ENGINE (rag_engine.py)                   │   │
│  │                                                             │   │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │ Document │  │  Hybrid   │  │ LangGraph│  │  Gemini  │  │   │
│  │  │  Parser  │  │ Retriever │  │  Graph   │  │   LLM    │  │   │
│  │  └──────────┘  └───────────┘  └──────────┘  └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                         BACKEND                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Operation Flows

### Flow 1 — API Key Configuration

```
Client                          Server
  │                               │
  │  POST /api/configure          │
  │  { "api_key": "...",          │
  │    "langsmith_key": "..." }   │
  │──────────────────────────────►│
  │                               │── Store in session
  │                               │── Set LangSmith env vars (if provided)
  │  { "status": "ok",            │
  │    "observability": true }    │
  │◄──────────────────────────────│
```

**Must be called before any other API operation.**

---

### Flow 2 — Document Upload & Processing

```
Client                          Server                          RAG Engine
  │                               │                               │
  │  POST /api/upload             │                               │
  │  FormData { file: ... }       │                               │
  │──────────────────────────────►│                               │
  │                               │  process_document(bytes,      │
  │                               │    filename, api_key)         │
  │                               │──────────────────────────────►│
  │                               │                               │── Parse doc (PDF/DOCX/TXT/CSV)
  │                               │                               │── Calculate dynamic chunk params
  │                               │                               │── Split into chunks
  │                               │                               │── Generate embeddings (Gemini)
  │                               │                               │── Store in ChromaDB
  │                               │                               │── Build BM25 index
  │                               │                               │── Create Hybrid Retriever
  │                               │                               │── Generate executive summary
  │                               │  ◄── (retriever, metadata)   │
  │                               │◄──────────────────────────────│
  │                               │                               │
  │                               │  build_rag_graph(retriever,   │
  │                               │    api_key)                   │
  │                               │──────────────────────────────►│
  │                               │                               │── Build StateGraph
  │                               │                               │── Add nodes & edges
  │                               │                               │── Configure LLM failover
  │                               │  ◄── graph_builder            │
  │                               │◄──────────────────────────────│
  │                               │                               │
  │                               │── Compile graph with          │
  │                               │   MemorySaver checkpointer   │
  │                               │── Store in session            │
  │                               │                               │
  │  { "status": "ok",            │                               │
  │    "metadata": {              │                               │
  │      "filename": "...",       │                               │
  │      "page_count": N,         │                               │
  │      "chunk_count": N,        │                               │
  │      "chunk_size": N,         │                               │
  │      "chunk_overlap": N,      │                               │
  │      "summary": "..."        │                               │
  │    }                          │                               │
  │  }                            │                               │
  │◄──────────────────────────────│                               │
```

---

### Flow 3 — Chat Query (Normal Response)

```
Client                          Server                    LangGraph Pipeline
  │                               │                               │
  │  POST /api/chat               │                               │
  │  { "query": "..." }           │                               │
  │──────────────────────────────►│                               │
  │                               │── Create HumanMessage         │
  │                               │── Append to messages          │
  │                               │                               │
  │       SSE Stream Begins       │  graph.stream(payload,        │
  │                               │    stream_mode="messages")    │
  │                               │──────────────────────────────►│
  │                               │                               │
  │                               │          ┌────────────────────┤
  │                               │          │ PIPELINE EXECUTION │
  │                               │          │                    │
  │                               │          │ 1. inspect_policy  │
  │                               │          │    └─► No threat   │
  │                               │          │                    │
  │                               │          │ 2. rewrite_query   │
  │                               │          │    └─► Standalone  │
  │                               │          │        query       │
  │                               │          │                    │
  │                               │          │ 3. retrieve        │
  │                               │          │    ├─► Dense (k=5) │
  │                               │          │    ├─► BM25 (k=5)  │
  │                               │          │    └─► Rerank (3)  │
  │                               │          │                    │
  │                               │          │ 4. evaluate_       │
  │                               │          │    confidence      │
  │                               │          │    └─► score ≥ 0.6 │
  │                               │          │                    │
  │                               │          │ 5. generate_answer │
  │                               │          │    └─► Stream      │
  │                               │          │        tokens ──┐  │
  │                               │          └─────────────────┤  │
  │                               │                            │  │
  │  data: {"type":"token",       │◄───────────────────────────┘  │
  │         "content":"The"}      │                               │
  │◄──────────────────────────────│                               │
  │  data: {"type":"token",       │                               │
  │         "content":" answer"}  │                               │
  │◄──────────────────────────────│                               │
  │  ...more tokens...            │                               │
  │                               │                               │
  │  data: {"type":"done",        │── Store AIMessage             │
  │         "content":"full..."}  │                               │
  │◄──────────────────────────────│                               │
```

---

### Flow 4 — Chat Query (Escalation Triggered)

Escalation occurs when: **policy violation detected** OR **confidence score < 0.60**

```
Client                          Server                    LangGraph Pipeline
  │                               │                               │
  │  POST /api/chat               │                               │
  │  { "query": "I want a         │                               │
  │    refund for the item" }     │                               │
  │──────────────────────────────►│                               │
  │                               │──────────────────────────────►│
  │                               │                               │
  │                               │          ┌────────────────────┤
  │                               │          │ 1. inspect_policy  │
  │                               │          │    └─► SENSITIVE   │
  │                               │          │      keyword found │
  │                               │          │      ("refund")    │
  │                               │          │                    │
  │                               │          │ ─── GRAPH PAUSES ──│
  │                               │          │    (interrupt())   │
  │                               │          └────────────────────┤
  │                               │                               │
  │                               │── Store escalation data       │
  │                               │                               │
  │  data: {"type":"escalation",  │                               │
  │    "data": {                  │                               │
  │      "reason": "Policy...",   │                               │
  │      "confidence": 0.0,       │                               │
  │      "query": "...",          │                               │
  │      "docs": [...]            │                               │
  │    }                          │                               │
  │  }                            │                               │
  │◄──────────────────────────────│                               │
  │                               │                               │
  │  ┌─────────────────────┐      │                               │
  │  │ SHOW ESCALATION     │      │                               │
  │  │ MODAL TO SUPERVISOR │      │                               │
  │  │                     │      │                               │
  │  │ Supervisor types    │      │                               │
  │  │ guidance...         │      │                               │
  │  └─────────┬───────────┘      │                               │
  │            │                  │                               │
  │  POST /api/escalation/resume  │                               │
  │  { "guidance": "Approve the   │                               │
  │    refund per policy X" }     │                               │
  │──────────────────────────────►│                               │
  │                               │  Command(resume=guidance)     │
  │                               │──────────────────────────────►│
  │                               │          ┌────────────────────┤
  │                               │          │ ── GRAPH RESUMES ──│
  │                               │          │                    │
  │                               │          │ 5. generate_answer │
  │                               │          │    (with supervisor │
  │                               │          │     context added) │
  │                               │          └────────────────────┤
  │                               │                               │
  │  { "status": "ok",            │── Store AIMessage             │
  │    "response": "Based on      │── Clear escalation            │
  │     policy X, your refund..." │                               │
  │  }                            │                               │
  │◄──────────────────────────────│                               │
```

---

## API Reference

### `POST /api/configure`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `api_key` | string | ✅ | Google Gemini API key |
| `langsmith_key` | string | ❌ | LangSmith API key for observability |

**Response:** `{ "status": "ok", "observability": bool }`

---

### `POST /api/upload`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | FormData | ✅ | Document file (.pdf, .docx, .txt, .csv) |

**Response:**
```json
{
  "status": "ok",
  "metadata": {
    "filename": "report.pdf",
    "page_count": 12,
    "chunk_count": 47,
    "chunk_size": 512,
    "chunk_overlap": 61,
    "summary": "• Key topics covered..."
  }
}
```

---

### `POST /api/chat`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | ✅ | User's question about the document |

**Response:** Server-Sent Events stream

| Event Type | Payload | Meaning |
|------------|---------|---------|
| `token` | `{ "type": "token", "content": "..." }` | Incremental text chunk from the LLM |
| `done` | `{ "type": "done", "content": "..." }` | Full response complete |
| `escalation` | `{ "type": "escalation", "data": {...} }` | Graph paused — supervisor needed |
| `error` | `{ "type": "error", "content": "..." }` | Pipeline error |

---

### `POST /api/escalation/resume`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `guidance` | string | ✅ | Supervisor's directive or override |

**Response:** `{ "status": "ok", "response": "..." }`

---

### `POST /api/session/reset`

No body required. Clears all state and reinitializes the session.

**Response:** `{ "status": "ok" }`

---

### `GET /api/session/export`

Returns the chat history as a downloadable JSON file.

---

### `GET /api/session/status`

Returns the current session state for frontend hydration on page load.

```json
{
  "configured": false,
  "document_loaded": false,
  "doc_meta": null,
  "messages": [],
  "pending_escalation": null,
  "thread_id": "uuid-..."
}
```

---

## LangGraph Pipeline Architecture

```
                    ┌─────────────────┐
                    │      START      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ inspect_policy  │
                    │                 │
                    │ • Injection     │
                    │   detection     │
                    │ • Sensitive     │
                    │   keyword scan  │
                    └────────┬────────┘
                             │
                     ┌───────┴───────┐
                     │   Threat?     │
                 YES │               │ NO
                     ▼               ▼
          ┌──────────────┐  ┌─────────────────┐
          │    human     │  │  rewrite_query  │
          │  escalation  │  │                 │
          │              │  │ Contextualizes  │
          │  interrupt() │  │ follow-up Qs    │
          │  ── PAUSE ── │  │ into standalone │
          └──────┬───────┘  └────────┬────────┘
                 │                   │
                 │                   ▼
                 │          ┌─────────────────┐
                 │          │    retrieve     │
                 │          │                 │
                 │          │ Dense (Chroma)  │
                 │          │ + BM25 Sparse   │
                 │          │ + FlashRank     │
                 │          │   Reranking     │
                 │          └────────┬────────┘
                 │                   │
                 │                   ▼
                 │          ┌─────────────────┐
                 │          │   evaluate      │
                 │          │   confidence    │
                 │          │                 │
                 │          │ LLM grades      │
                 │          │ context vs      │
                 │          │ query (0-1)     │
                 │          └────────┬────────┘
                 │                   │
                 │           ┌───────┴───────┐
                 │           │ Score < 0.60? │
                 │       YES │               │ NO
                 │           ▼               ▼
                 │  ┌──────────────┐  ┌─────────────────┐
                 │  │    human     │  │                 │
                 │  │  escalation  │  │                 │
                 │  │  ── PAUSE ── │  │                 │
                 │  └──────┬───────┘  │                 │
                 │         │          │                 │
                 └─────────┼──────────┤                 │
                           │          │                 │
                           ▼          ▼                 │
                    ┌─────────────────┐                 │
                    │ generate_answer │◄────────────────┘
                    │                 │
                    │ • System prompt │
                    │   with context  │
                    │ • Supervisor    │
                    │   override      │
                    │   (if present)  │
                    │ • Citations     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │      END       │
                    └─────────────────┘
```

---

## Model Failover Strategy

```
┌──────────────────────────────┐
│    Primary: gemini-3.7-flash │
│    (max_retries=1)           │
│              │               │
│         on failure           │
│              │               │
│              ▼               │
│   Fallback: gemini-3.6-flash │
│   (.with_fallbacks())        │
└──────────────────────────────┘
```

Automatic failover is triggered on rate limit or quota errors. No manual intervention required.

---

## Session Architecture

```
Flask Cookie Session              Server Memory (_sessions dict)
┌──────────────┐                 ┌─────────────────────────────┐
│  sid: uuid   │────────────────►│  Key: sid                   │
└──────────────┘                 │  ┌─────────────────────────┐│
                                 │  │ app (compiled graph)    ││
  Lightweight cookie             │  │ checkpointer            ││
  stores only the                │  │ thread_id               ││
  session identifier             │  │ messages[]              ││
                                 │  │ doc_meta                ││
                                 │  │ pending_escalation      ││
                                 │  │ api_key                 ││
                                 │  │ langsmith_key           ││
                                 │  └─────────────────────────┘│
                                 └─────────────────────────────┘
```

> **Note:** Session data lives in memory. Restarting the server clears all sessions.

---

## Error Handling

| HTTP Code | Scenario | Response |
|-----------|----------|----------|
| `400` | Missing API key, empty query, unsupported file type | `{ "error": "..." }` |
| `500` | Document processing failure, graph execution error | `{ "error": "..." }` |
| SSE `error` | Mid-stream pipeline failure | `{ "type": "error", "content": "..." }` |

---

## File Structure

```
project/
├── server.py              # Flask backend (REST API + SSE)
├── rag_engine.py          # RAG pipeline (LangGraph + LangChain)
├── requirements.txt       # Python dependencies
├── static/
│   ├── index.html         # Frontend UI (placeholder)
│   ├── style.css          # Styles (to be added)
│   └── app.js             # Client logic (to be added)
├── chroma_db/             # ChromaDB vector store (auto-created)
└── README.md              # Project documentation
```
