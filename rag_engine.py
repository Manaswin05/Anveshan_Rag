import sys
import os
import re
import shutil
import tempfile
import requests
from functools import partial
from typing import TypedDict, List, Literal, Optional, Tuple, Dict, Any
from pydantic import BaseModel, Field

# Bypass corrupted global metadata on disk
sys.modules["transformers"] = None
sys.modules["huggingface_hub"] = None

from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_community.document_loaders import (
    PyMuPDFLoader, 
    Docx2txtLoader, 
    TextLoader, 
    CSVLoader
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt

# FlashRank Cross-Encoder Reranking Setup
try:
    from flashrank import Ranker, RerankRequest
    FLASHRANK_AVAILABLE = True
    ranker = Ranker(model_name="ms-marco-TinyBERT-L-2-v2")
except Exception:
    FLASHRANK_AVAILABLE = False
    ranker = None


# ============================================================================
# MODEL CONFIGURATION & LLM FACTORY
# ============================================================================

class ModelConfig(TypedDict, total=False):
    """
    Configuration for LLM provider selection.
    
    Attributes:
        provider: The LLM provider ("gemini", "ollama", "lmstudio", "localai")
        model_name: The specific model identifier (e.g., "gemini-1.5-flash", "llama3.2")
        api_key: API key for cloud providers (required for Gemini, optional for local)
        base_url: Base URL for local LLM servers (required for ollama/lmstudio/localai)
    """
    provider: str
    model_name: str
    api_key: str
    base_url: str


def create_llm(model_config: ModelConfig, fallback: bool = False):
    """
    Factory function to create LLM instances based on provider configuration.
    
    This function centralizes LLM instantiation logic and supports multiple providers:
    - Gemini: Google's Generative AI models with automatic fallback support
    - Ollama: Local LLM inference server
    - LM Studio: Local model runtime with OpenAI-compatible API
    - LocalAI: Self-hosted OpenAI alternative
    
    Args:
        model_config: Dictionary containing provider, model_name, api_key, and base_url
        fallback: If True and provider is "gemini", adds fallback to gemini-1.5-flash
        
    Returns:
        A LangChain chat model instance ready for inference
        
    Raises:
        ValueError: If provider is unsupported or required config is missing
        
    Examples:
        >>> # Gemini with fallback
        >>> llm = create_llm({
        ...     "provider": "gemini",
        ...     "model_name": "gemini-2.0-flash-exp",
        ...     "api_key": "your-api-key"
        ... }, fallback=True)
        
        >>> # Ollama local model
        >>> llm = create_llm({
        ...     "provider": "ollama",
        ...     "model_name": "llama3.2",
        ...     "base_url": "http://localhost:11434"
        ... })
    """
    provider = model_config.get("provider", "gemini").lower()
    model_name = model_config.get("model_name", "gemini-1.5-flash")
    api_key = model_config.get("api_key", "")
    base_url = model_config.get("base_url", "")
    
    try:
        if provider == "gemini":
            if not api_key:
                raise ValueError("Gemini provider requires an API key")
            
            primary_llm = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=api_key,
                temperature=0,
                max_retries=1
            )
            
            # Add fallback to gemini-1.5-flash if requested
            if fallback and model_name != "gemini-1.5-flash":
                fallback_llm = ChatGoogleGenerativeAI(
                    model="gemini-1.5-flash",
                    google_api_key=api_key,
                    temperature=0
                )
                return primary_llm.with_fallbacks([fallback_llm])
            
            return primary_llm
            
        elif provider == "ollama":
            from langchain_ollama import ChatOllama
            
            if not base_url:
                base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
            
            return ChatOllama(
                model=model_name,
                base_url=base_url,
                temperature=0
            )
            
        elif provider == "lmstudio":
            from langchain_openai import ChatOpenAI
            
            if not base_url:
                base_url = os.environ.get("LMSTUDIO_BASE_URL", "http://localhost:1234/v1")
            
            return ChatOpenAI(
                model=model_name,
                base_url=base_url,
                api_key="lm-studio",  # LM Studio doesn't validate API keys
                temperature=0
            )
            
        elif provider == "localai":
            from langchain_openai import ChatOpenAI
            
            if not base_url:
                base_url = os.environ.get("LOCALAI_BASE_URL", "http://localhost:8080/v1")
            
            return ChatOpenAI(
                model=model_name,
                base_url=base_url,
                api_key="localai",  # LocalAI placeholder key
                temperature=0
            )
            
        else:
            raise ValueError(
                f"Unsupported LLM provider: {provider}. "
                f"Supported providers: gemini, ollama, lmstudio, localai"
            )
            
    except Exception as e:
        raise ValueError(f"Failed to create LLM for provider '{provider}': {str(e)}")


def check_local_llm_connectivity(base_url: str, provider: str = "ollama") -> Dict[str, Any]:
    """
    Test connectivity to a local LLM server.
    
    Args:
        base_url: The base URL of the local LLM server
        provider: The provider type ("ollama", "lmstudio", "localai")
        
    Returns:
        Dictionary with keys:
            - ok: Boolean indicating if server is reachable
            - message: Human-readable status message
            - latency_ms: Response time in milliseconds (if successful)
            - models: List of available models (for Ollama)
    """
    import time
    
    try:
        start_time = time.time()
        
        if provider == "ollama":
            # Ollama has a tags endpoint that lists available models
            response = requests.get(f"{base_url}/api/tags", timeout=5)
            latency_ms = int((time.time() - start_time) * 1000)
            
            if response.status_code == 200:
                models = [m["name"] for m in response.json().get("models", [])]
                return {
                    "ok": True,
                    "message": f"Ollama server is running with {len(models)} model(s)",
                    "latency_ms": latency_ms,
                    "models": models
                }
            else:
                return {
                    "ok": False,
                    "message": f"Ollama server responded with status {response.status_code}",
                    "latency_ms": latency_ms
                }
        
        else:
            # For LM Studio and LocalAI, test the /v1/models endpoint
            response = requests.get(f"{base_url}/models", timeout=5)
            latency_ms = int((time.time() - start_time) * 1000)
            
            if response.status_code == 200:
                return {
                    "ok": True,
                    "message": f"{provider.upper()} server is running",
                    "latency_ms": latency_ms
                }
            else:
                return {
                    "ok": False,
                    "message": f"Server responded with status {response.status_code}",
                    "latency_ms": latency_ms
                }
                
    except requests.exceptions.Timeout:
        return {
            "ok": False,
            "message": "Connection timeout - server may not be running"
        }
    except requests.exceptions.ConnectionError:
        return {
            "ok": False,
            "message": "Connection refused - ensure server is started"
        }
    except Exception as e:
        return {
            "ok": False,
            "message": f"Error: {str(e)}"
        }


# ============================================================================
# RETRIEVER & DOCUMENT PROCESSING
# ============================================================================



class CustomHybridRetriever(BaseRetriever):
    """Combines Dense Vector search and BM25 Sparse Keyword search."""
    vector_retriever: BaseRetriever
    bm25_retriever: BaseRetriever

    def _get_relevant_documents(
        self, query: str, *, run_manager: Optional[CallbackManagerForRetrieverRun] = None
    ) -> List[Document]:
        vec_docs = self.vector_retriever.invoke(query)
        bm25_docs = self.bm25_retriever.invoke(query)
        
        combined = []
        seen = set()
        for doc in vec_docs + bm25_docs:
            doc_id = doc.page_content.strip()[:100]
            if doc_id not in seen:
                seen.add(doc_id)
                combined.append(doc)
        return combined[:6]


SENSITIVE_KEYWORDS = {
    "refund", "faulty", "exchange", "repair", 
    "replacement", "damaged", "lawsuit", "cancel"
}

INJECTION_PATTERNS = [
    r"ignore (all|previous|above) (instructions|prompts|rules)",
    r"system prompt",
    r"you are now (an unrestricted|a developer)",
    r"jailbreak"
]


class GradeConfidence(BaseModel):
    """Structured output schema for LLM-based context relevance evaluation."""
    score: float = Field(
        description="Confidence score from 0.0 to 1.0 indicating if context answers the query adequately."
    )


class SupportState(TypedDict):
    messages: List[BaseMessage]
    retrieved_docs: List[Document]
    confidence_score: float
    escalation_reason: Optional[str]
    supervisor_review: Optional[str]


def load_any_document(file_path: str, filename: str) -> List[Document]:
    """Dynamically parses documents using PyMuPDF for PDFs."""
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        return PyMuPDFLoader(file_path).load()
    elif ext == ".docx":
        return Docx2txtLoader(file_path).load()
    elif ext == ".txt":
        return TextLoader(file_path, encoding="utf-8").load()
    elif ext == ".csv":
        return CSVLoader(file_path).load()
    else:
        raise ValueError(f"Unsupported file format extension: {ext}")


def calculate_dynamic_chunk_params(documents: List[Document]) -> Tuple[int, int]:
    """Calculates dynamic chunk size and overlap based on length and paragraph structure."""
    total_chars = sum(len(doc.page_content) for doc in documents)
    page_count = len(documents)

    if total_chars < 8000 or page_count <= 3:
        chunk_size = 400
    elif page_count > 40 or total_chars > 120000:
        chunk_size = 1000
    else:
        paragraphs = [
            p.strip() for doc in documents 
            for p in doc.page_content.split("\n\n") 
            if len(p.strip()) > 30
        ]
        if paragraphs:
            avg_p_len = sum(len(p) for p in paragraphs) / len(paragraphs)
            chunk_size = int(avg_p_len * 1.7)
            chunk_size = max(350, min(chunk_size, 900))
        else:
            chunk_size = 512

    chunk_overlap = int(chunk_size * 0.12)
    return chunk_size, chunk_overlap


def generate_document_summary(documents: List[Document], model_config: ModelConfig) -> str:
    """
    Generates a summary sampling key text snippets to conserve quota.
    
    Args:
        documents: List of Document objects to summarize
        model_config: LLM configuration dict with provider, model_name, api_key, base_url
        
    Returns:
        A concise summary string (2 bullet points)
    """
    if not documents:
        return "• Document processed successfully."
    
    sample_text = documents[0].page_content[:500]
    try:
        llm = create_llm(model_config, fallback=False)
        prompt = f"Summarize key topic in 2 concise bullet points:\n{sample_text}"
        res = llm.invoke([HumanMessage(content=prompt)])
        return res.content
    except Exception:
        return f"• Document loaded ({len(documents)} pages/rows indexed successfully)."


def rerank_documents(query: str, docs: List[Document], top_n: int = 3) -> List[Document]:
    """Applies FlashRank cross-encoder reranking to retrieved passages."""
    if not docs or not FLASHRANK_AVAILABLE or not ranker:
        return docs[:top_n]
        
    passages = [{"id": i, "text": doc.page_content, "meta": doc.metadata} for i, doc in enumerate(docs)]
    rerank_req = RerankRequest(query=query, passages=passages)
    results = ranker.rerank(rerank_req)
    
    reranked_docs = []
    for res in results[:top_n]:
        orig_doc = docs[res["id"]]
        reranked_docs.append(orig_doc)
        
    return reranked_docs


def process_document(file_bytes: bytes, filename: str, model_config: ModelConfig):
    """
    Parses document, clears stale local Chroma indexes, and populates store.
    
    Args:
        file_bytes: Raw file content as bytes
        filename: Original filename with extension
        model_config: LLM configuration dict for summarization
        
    Returns:
        Tuple of (retriever, metadata_dict)
    """
    suffix = os.path.splitext(filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        tmp_file.write(file_bytes)
        tmp_path = tmp_file.name

    try:
        documents = load_any_document(tmp_path, filename)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    chunk_size, chunk_overlap = calculate_dynamic_chunk_params(documents)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, 
        chunk_overlap=chunk_overlap
    )
    chunks = text_splitter.split_documents(documents)

    for chunk in chunks:
        chunk.metadata["source"] = filename

    # Clear stale Chroma DB to align with single active document session
    if os.path.exists("./chroma_db"):
        shutil.rmtree("./chroma_db")

    # NOTE: Embeddings remain Gemini-only for now. Future enhancement could add
    # support for local embedding models (e.g., sentence-transformers).
    api_key = model_config.get("api_key", os.environ.get("GEMINI_API_KEY", ""))
    if not api_key and model_config.get("provider") == "gemini":
        raise ValueError("Gemini API key required for embeddings")
    
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=api_key
    )
    vectorstore = Chroma.from_documents(
        documents=chunks, 
        embedding=embeddings,
        persist_directory="./chroma_db"
    )
    dense_retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

    try:
        from langchain_community.retrievers import BM25Retriever
        bm25_retriever = BM25Retriever.from_documents(chunks)
        bm25_retriever.k = 5
        hybrid_retriever = CustomHybridRetriever(
            vector_retriever=dense_retriever,
            bm25_retriever=bm25_retriever
        )
    except Exception:
        hybrid_retriever = dense_retriever

    doc_summary = generate_document_summary(documents, model_config)

    metadata = {
        "page_count": len(documents),
        "chunk_count": len(chunks),
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "summary": doc_summary,
        "filename": filename
    }

    return hybrid_retriever, metadata


# --- Top-Level Graph Nodes ---

def inspect_policy_node(state: SupportState):
    user_query = state["messages"][-1].content.lower()
    
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, user_query):
            return {"escalation_reason": "Security Trigger: Potential Prompt Injection attempt detected."}

    matched = [w for w in SENSITIVE_KEYWORDS if w in user_query]
    if matched:
        return {"escalation_reason": f"Policy Trigger: Query contains sensitive keywords ({', '.join(matched)})"}
        
    return {"escalation_reason": None}


def rewrite_query_node(state: SupportState, llm):
    messages = state["messages"]
    if len(messages) <= 1:
        return {"messages": messages}
        
    history = [f"{'User' if isinstance(m, HumanMessage) else 'Assistant'}: {m.content}" for m in messages[:-1]]
    history_str = "\n".join(history)
    current_query = messages[-1].content
    
    prompt = (
        f"Given conversation history and follow-up question, rephrase follow-up to be a standalone query.\n\n"
        f"History:\n{history_str}\n\nFollow-up: {current_query}\n\nStandalone Query:"
    )
    rewritten = llm.invoke([HumanMessage(content=prompt)])
    return {"messages": messages[:-1] + [HumanMessage(content=rewritten.content)]}


def retrieve_node(state: SupportState, retriever):
    user_query = state["messages"][-1].content
    raw_docs = retriever.invoke(user_query)
    final_docs = rerank_documents(user_query, raw_docs, top_n=3)
    return {"retrieved_docs": final_docs}


def evaluate_confidence_node(state: SupportState, llm):
    """
    Dynamically grades context relevance using GradeConfidence schema.
    
    Falls back to simple text parsing if structured output is not supported
    (common with smaller local LLMs).
    """
    existing_reason = state.get("escalation_reason")
    if existing_reason:
        return {"confidence_score": 0.0, "escalation_reason": existing_reason}

    docs = state.get("retrieved_docs", [])
    if not docs:
        return {
            "confidence_score": 0.0, 
            "escalation_reason": "Low Confidence Trigger: No relevant context chunks retrieved."
        }

    user_query = state["messages"][-1].content
    context_text = "\n\n".join([doc.page_content for doc in docs])

    prompt = (
        f"You are a grading assistant assessing whether retrieved document context is relevant "
        f"and sufficient to answer a user query.\n\n"
        f"Context:\n{context_text}\n\n"
        f"User Query: {user_query}\n\n"
        f"Grade context relevance on a floating-point scale between 0.0 and 1.0."
    )

    try:
        structured_llm = llm.with_structured_output(GradeConfidence)
        result = structured_llm.invoke([HumanMessage(content=prompt)])
        score = result.score
    except Exception as e:
        # Fallback for local LLMs that don't support structured output
        try:
            fallback_prompt = (
                f"{prompt}\n\n"
                f"Reply ONLY with a number between 0.0 and 1.0, nothing else."
            )
            response = llm.invoke([HumanMessage(content=fallback_prompt)])
            # Extract first float from response
            import re
            match = re.search(r'\b[0-1]\.?\d*\b', str(response.content))
            score = float(match.group()) if match else 1.0
        except Exception:
            # If all fails, assume confidence is acceptable
            score = 1.0

    escalation = None
    if score < 0.60:
        escalation = f"Low Confidence Trigger: Context relevance score ({score:.2f}) is below the required 0.60 threshold."

    return {
        "confidence_score": score,
        "escalation_reason": escalation
    }


def human_escalation_node(state: SupportState):
    supervisor_guidance = interrupt({
        "reason": state.get("escalation_reason"),
        "confidence": state.get("confidence_score", 0.0),
        "query": state["messages"][-1].content,
        "docs": [doc.page_content for doc in state.get("retrieved_docs", [])]
    })
    return {"supervisor_review": supervisor_guidance}


def generate_answer_node(state: SupportState, llm):
    docs = state.get("retrieved_docs", [])
    
    formatted_context = [
        f"[Source {i} | File: {os.path.basename(doc.metadata.get('source', 'Document'))} | "
        f"Page/Row: {doc.metadata.get('page', doc.metadata.get('row', 'N/A'))}]\n{doc.page_content}"
        for i, doc in enumerate(docs, 1)
    ]

    context_str = "\n\n".join(formatted_context)
    supervisor_note = state.get("supervisor_review", "")

    sys_prompt = (
        f"Answer the user query accurately using ONLY the context provided below.\n"
        f"At the end of your answer, include a '📌 Sources & Citations' section explicitly citing "
        f"the Source ID, File name, and Page/Row number used for your facts.\n\n"
        f"Context:\n{context_str}"
    )
    if supervisor_note:
        sys_prompt += f"\n\nSUPERVISOR OVERRIDE/GUIDANCE: {supervisor_note}"

    messages = [SystemMessage(content=sys_prompt)] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}


def route_initial_policy(state: SupportState) -> Literal["human_escalation", "rewrite_query"]:
    return "human_escalation" if state.get("escalation_reason") else "rewrite_query"


def route_confidence(state: SupportState) -> Literal["human_escalation", "generate_answer"]:
    return "human_escalation" if state.get("escalation_reason") else "generate_answer"


# --- Clean Graph Orchestrator with Native Fallbacks ---

def build_rag_graph(retriever, model_config: ModelConfig):
    """
    Constructs LangGraph machine with configurable LLM provider support.
    
    Supports Gemini (with automatic failover), Ollama, LM Studio, and LocalAI.
    
    Args:
        retriever: A LangChain retriever instance (hybrid or standard)
        model_config: Configuration dict with provider, model_name, api_key, base_url
        
    Returns:
        A StateGraph builder ready to be compiled with a checkpointer
    """
    # Create LLM instance with fallback support for Gemini
    llm = create_llm(model_config, fallback=(model_config.get("provider") == "gemini"))

    builder = StateGraph(SupportState)

    builder.add_node("inspect_policy", inspect_policy_node)
    builder.add_node("rewrite_query", partial(rewrite_query_node, llm=llm))
    builder.add_node("retrieve", partial(retrieve_node, retriever=retriever))
    builder.add_node("evaluate_confidence", partial(evaluate_confidence_node, llm=llm))
    builder.add_node("human_escalation", human_escalation_node)
    builder.add_node("generate_answer", partial(generate_answer_node, llm=llm))

    builder.add_edge(START, "inspect_policy")
    builder.add_conditional_edges("inspect_policy", route_initial_policy)
    builder.add_edge("rewrite_query", "retrieve")
    builder.add_edge("retrieve", "evaluate_confidence")
    builder.add_conditional_edges("evaluate_confidence", route_confidence)
    builder.add_edge("human_escalation", "generate_answer")
    builder.add_edge("generate_answer", END)

    return builder