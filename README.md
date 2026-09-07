# Multi-Format Hybrid RAG Workstation: LangGraph, Gemini & Streamlit

An enterprise-grade, multi-format Retrieval-Augmented Generation (RAG) platform powered by Streamlit, LangGraph, and Google Gemini API. This application combines hybrid search (dense vector + sparse BM25), cross-encoder reranking, dynamic document chunking, automated context confidence evaluation, human-in-the-loop (HITL) supervisor overrides, and automatic LLM failover handling.  

# ⚡ Key Features
1. Multi-Format Document Ingestion: Supports .pdf, .docx, .txt, and .csv files.  
2. Dynamic Chunking: Automatically calculates chunk size ($350$ to $900$ characters) and overlap ($12\%$) based on total length and paragraph density.  
3. Hybrid Search Retrieval: Merges dense semantic vector search via Chroma DB (gemini-embedding-001) with sparse keyword matching via BM25.
4. Cross-Encoder Reranking: Re-orders retrieved passages using FlashRank (ms-marco-TinyBERT-L-2-v2) to prioritize relevant context.

# LangGraph Orchestration: 
1. Policy & Security Checking: Detects prompt injection patterns and flags sensitive keywords.
2. Query Rewriting: Rephrases conversational follow-up questions into standalone queries.
3. Automated Confidence Evaluation: Uses structured output grading ($0.0$ to $1.0$) to verify retrieved context relevance.
4. Human-in-The-Loop (HITL): Interrupts graph execution when context confidence falls below $0.60$ or safety triggers fire, allowing supervisor review and direct policy overrides.
5. Automatic LLM Failover: Uses .with_fallbacks() to seamlessly switch from gemini-3.7-flash to gemini-3.6-flash if API quotas or rate limits are exceeded.
6. Interactive Workspace UI: Streamlit dashboard complete with KPI cards, document summary expanders, one-click quick-start prompt suggestions, response streaming, and session exports.

# 🏗️ System Architecture & Workflow

<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/f294116a-cd1e-4076-a6df-4a5191929125" />


# 📁 Repository Structure Plaintext.
├── app.py              # Main Streamlit application UI and chat workstation

├── rag_engine.py       # Core RAG functions, document loaders, and LangGraph workflow

├── requirements.txt    # Python dependency manifest

├── Dockerfile          # Container configuration for cloud deployment

└── README.md           # Project documentation


# 🚀 Quick Start
1. Prerequisites
   Python 3.10 or higher
   A Google Gemini API Key from Google AI Studio2.
2.Installation
Clone the repository:
Bash
git clone https://github.com/your-username/hybrid-rag-workstation.git
cd hybrid-rag-workstation
Create and activate a virtual environment:
Bash
python -m venv venv

# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies:
Bash
pip install -r requirements.txt

3. Launching the App
4. Run the Streamlit application:
   Bash
   streamlit run app.py
Open http://localhost:8501 in your web browser.


  # 📖 User GuideAPI Configuration: 
  Enter your Gemini API Key in the left sidebar control panel. 
  Optionally provide a LangSmith key for pipeline tracing.  
  Document Ingestion: Upload a PDF, DOCX, TXT, or CSV file and click 🚀 Process.  
  Workspace Analysis: View dynamic metadata metrics (pages/rows, chunk count, chunk size, overlap).  
  Expand the Executive Summary tab to review key topics.  
  Interactive Chat: Use quick-suggestion prompt chips or enter custom questions in the chat box.  
  Answers include explicit source citations (File Name, Page/Row Number).  
  Supervisor Interventions: If a query contains sensitive keywords or yields low-confidence retrieval context, the workspace pauses. A supervisor can inspect retrieved passages and submit custom guidance or overrides to resume execution.  
  Export Chat: Download session chat logs in JSON format via the sidebar.  
  
  # 🐳 Deployment Guide
  Deploying to Streamlit Community Cloud
  Push your code (app.py, rag_engine.py, requirements.txt) to GitHub.  Go to share.streamlit.io.
  Connect your repository, set the main file path to app.py, and click Deploy.
  Deploying via Docker
  Build Docker Image:
  Bash
  docker build -t hybrid-rag-workstation.
  Run Container:
  Bash
  docker run -p 8501:8501 hybrid-rag-workstation
