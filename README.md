# Anveshan RAG (Deep Exploration & Research)
> **Meaning:** *Anveshan* means "systematic investigation" or "deep search."

An enterprise-grade, multi-format Retrieval-Augmented Generation (RAG) platform powered by a **React/Vite Frontend**, **Flask Backend**, **LangGraph**, and the **Google Gemini API**. This application combines hybrid search (dense vector + sparse BM25), cross-encoder reranking, dynamic document chunking, automated context confidence evaluation, human-in-the-loop (HITL) supervisor overrides, and automatic LLM failover handling.

## ⚡ Key Features
1. **Multi-LLM Provider Support:** Choose from Google Gemini, Ollama, LM Studio, or LocalAI models via an intuitive dropdown selector with connection testing.
2. **Multi-Format Document Ingestion:** Supports `.pdf`, `.docx`, `.txt`, and `.csv` files.  
3. **Dynamic Chunking:** Automatically calculates chunk size (350 to 900 characters) and overlap (12%) based on total length and paragraph density.  
4. **Hybrid Search Retrieval:** Merges dense semantic vector search via Chroma DB (gemini-embedding-001) with sparse keyword matching via BM25.
5. **Cross-Encoder Reranking:** Re-orders retrieved passages using FlashRank (ms-marco-TinyBERT-L-2-v2) to prioritize relevant context.

## 🧠 LangGraph Orchestration
1. **Policy & Security Checking:** Detects prompt injection patterns and flags sensitive keywords.
2. **Query Rewriting:** Rephrases conversational follow-up questions into standalone queries.
3. **Automated Confidence Evaluation:** Uses structured output grading (0.0 to 1.0) to verify retrieved context relevance.
4. **Human-in-The-Loop (HITL):** Interrupts graph execution when context confidence falls below 0.60 or safety triggers fire, allowing supervisor review and direct policy overrides via a React modal.
5. **Automatic LLM Failover:** Uses `.with_fallbacks()` to seamlessly switch from `gemini-3.7-flash` to `gemini-3.6-flash` if API quotas or rate limits are exceeded.
6. **Interactive Workspace UI:** A beautiful React-based dashboard with real-time SSE streaming for chat, complete with KPI cards and one-click quick-start prompt suggestions.

---

## 📁 Repository Structure
```plaintext
├── server.py             # Main Flask REST API and SSE streaming backend
├── rag_engine.py         # Core RAG functions, document loaders, and LangGraph workflow
├── static/               # React + Vite frontend application
│   ├── src/              # React components and logic
│   ├── package.json      # Frontend dependencies
│   └── vite.config.ts    # Vite configuration (proxies /api to Flask)
├── requirements.txt      # Python backend dependencies
├── package.json          # Root package.json for concurrently running dev servers
├── Dockerfile            # Multi-stage Docker configuration for cloud deployment
├── .env                  # Environment variables (API keys)
└── README.md             # Project documentation
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 20+**
- A Google Gemini API Key from Google AI Studio.

### 2. Environment Setup
Create a `.env` file in the root directory and add your configuration:
```env
# Required for Gemini models and embeddings
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Local LLM servers (defaults shown)
OLLAMA_BASE_URL=http://localhost:11434
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LOCALAI_BASE_URL=http://localhost:8080/v1

# Optional: Observability
LANGSMITH_KEY=your_langsmith_key_here
```

### 3. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/hybrid-rag-workstation.git
cd hybrid-rag-workstation

# Install backend dependencies (using a virtual environment is recommended)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Install frontend and root dependencies
npm install
npm install --prefix static
```

### 4. Running the Application
We use `concurrently` to run both the Flask backend and the React frontend simultaneously. 
Run the following command from the root directory:
```bash
npm run dev
```
- **React Frontend**: [http://localhost:5173](http://localhost:5173)
- **Flask Backend**: [http://localhost:5000](http://localhost:5000)

Open **http://localhost:5173** in your web browser. The Vite development server automatically proxies `/api` requests to the Flask backend!

---

## 🤖 Multi-LLM Provider Support

Anveshan RAG now supports multiple LLM providers, giving you flexibility to choose between cloud and local inference:

### Supported Providers

| Provider | Type | Setup Time | Privacy | Cost |
|----------|------|------------|---------|------|
| **Google Gemini** | Cloud | < 1 min | Shared with Google | Pay-per-use |
| **Ollama** | Local | 5-10 min | 100% Local | Free (your hardware) |
| **LM Studio** | Local | 5-10 min | 100% Local | Free (your hardware) |
| **LocalAI** | Local | 10-20 min | 100% Local | Free (your hardware) |

### Quick Start by Provider

#### Google Gemini (Recommended for Getting Started)
```bash
# 1. Get API key from https://aistudio.google.com/
# 2. Add to .env file
echo "GEMINI_API_KEY=your_key_here" >> .env
# 3. Select model from dropdown in UI
```

#### Ollama (Best for Local Privacy)
```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a model
ollama pull llama3.2

# 3. Select from dropdown in UI (auto-detected)
```

#### LM Studio (Most User-Friendly Local)
1. Download from [lmstudio.ai](https://lmstudio.ai)
2. Download and load a model (e.g., Llama 3.2 8B)
3. Start the local server (⚡ Local Server tab)
4. Configure in UI: "LM Studio: Configure..."

#### LocalAI (Self-Hosted Production)
```bash
# Using Docker
docker run -p 8080:8080 -v $PWD/models:/models \
  quay.io/go-skynet/local-ai:latest
```

📚 **Full Setup Guide**: See [LLM_PROVIDERS.md](./LLM_PROVIDERS.md) for detailed instructions, troubleshooting, and performance comparisons.

---

## 📖 User Guide
- **Model Selection**: Choose your LLM provider from the dropdown. Test local connections before use.
- **API Configuration**: The app will automatically load your `GEMINI_API_KEY` from the `.env` file. You can also configure it in the UI's sidebar.
- **Document Ingestion**: Upload a PDF, DOCX, TXT, or CSV file and click **Process**.
- **Interactive Chat**: Use quick-suggestion prompt chips or enter custom questions in the chat box. The LangGraph backend streams responses in real-time.
- **Supervisor Interventions**: If a query contains sensitive keywords or yields low-confidence retrieval context, the workspace pauses and triggers the HITL modal. A supervisor can inspect retrieved passages and submit custom guidance or overrides to resume execution.

---

## 🐳 Deployment Guide (Render.com)
The project includes a multi-stage `Dockerfile` tailored for seamless deployment on platforms like Render.com.

1. Push your code to a GitHub repository.
2. Log into Render.com and create a new **Web Service**.
3. Connect your GitHub repository.
4. Render will automatically detect the `Dockerfile` and build both the React frontend and Python backend.
5. **Critical**: In the Render dashboard, go to the **Environment** tab and add your `GEMINI_API_KEY`!
6. Click Deploy. Render will serve the fully built React app through the `gunicorn` Flask server automatically.
