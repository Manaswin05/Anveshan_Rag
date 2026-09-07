import os
import uuid
import json
import streamlit as st
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from rag_engine import process_document, build_rag_graph

def extract_text(content) -> str:
    if isinstance(str, str):
        return content
    elif isinstance(content, list):
        return "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        )
    return str(content)

st.set_page_config(
    page_title="Enterprise RAG Workstation",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS Styling
st.markdown("""
<style>
    .stApp { background-color: #dcdcdc; }
    .status-badge {
        background-color: #10b981;
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.85rem;
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)

# Session State Initialization
if "messages" not in st.session_state:
    st.session_state.messages = []
if "app" not in st.session_state:
    st.session_state.app = None
if "doc_meta" not in st.session_state:
    st.session_state.doc_meta = None
if "thread_id" not in st.session_state:
    st.session_state.thread_id = str(uuid.uuid4())
if "pending_escalation" not in st.session_state:
    st.session_state.pending_escalation = None
if "checkpointer" not in st.session_state:
    st.session_state.checkpointer = MemorySaver()
if "active_prompt" not in st.session_state:
    st.session_state.active_prompt = None

# Sidebar Controls
with st.sidebar:
    st.title("⚙️ Control Panel")
    
    st.subheader("1. API Configuration")
    api_key = st.text_input("Gemini API Key", type="password", help="Pass your Google AI Studio API key.")
    
    langsmith_key = st.text_input("LangSmith Key (Optional)", type="password")
    if langsmith_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"
        os.environ["LANGCHAIN_API_KEY"] = langsmith_key
        os.environ["LANGCHAIN_PROJECT"] = "Advanced-RAG-Assistant"
        st.success("⚡ Observability Active")

    st.divider()
    st.subheader("2. Knowledge Ingestion")
    uploaded_file = st.file_uploader("Upload Document", type=["pdf", "docx", "txt", "csv"])
    
    col_proc, col_reset = st.columns([2, 1])
    with col_proc:
        process_btn = st.button("🚀 Process", use_container_width=True)
    with col_reset:
        if st.button("🔄 Reset", use_container_width=True):
            st.session_state.messages = []
            st.session_state.app = None
            st.session_state.doc_meta = None
            st.session_state.pending_escalation = None
            st.rerun()

    st.divider()
    if st.session_state.messages:
        st.subheader("3. Export Session")
        chat_export = [
            {"role": "user" if isinstance(m, HumanMessage) else "assistant", "content": extract_text(m.content)}
            for m in st.session_state.messages
        ]
        st.download_button(
            label="📥 Download Chat Log",
            data=json.dumps(chat_export, indent=2),
            file_name=f"chat_history_{st.session_state.thread_id[:8]}.json",
            mime="application/json",
            use_container_width=True
        )

# Main Application Tabs
tab_workstation, tab_guide = st.tabs(["💬 Workstation", "📖 User Guide & Documentation"])

with tab_workstation:
    col_head1, col_head2 = st.columns([3, 1])
    with col_head1:
        st.title("💬 RAG Intelligence Workstation")
        st.caption("Hybrid Search + Cross-Encoder Reranking + Human-in-the-Loop Supervision")
    with col_head2:
        if st.session_state.app:
            st.markdown("<br><span class='status-badge'>🟢 Pipeline Ready</span>", unsafe_allow_html=True)
        else:
            st.markdown("<br><span class='status-badge' style='background-color:#6b7280;'>⚪ Awaiting Document</span>", unsafe_allow_html=True)

    st.divider()

    # Process Document Action
    if process_btn:
        if not api_key:
            st.error("⚠️ Please enter your Gemini API Key in the sidebar.")
        elif not uploaded_file:
            st.error("⚠️ Please upload a document to proceed.")
        else:
            with st.status("⚙️ Building Index & Orchestrating Graph...", expanded=True) as status:
                st.write("📄 Parsing document structures...")
                retriever, metadata = process_document(uploaded_file.getvalue(), uploaded_file.name, api_key)
                
                st.write("🕸️ Compiling LangGraph state machine with automatic failover...")
                graph_builder = build_rag_graph(retriever, api_key)
                
                st.session_state.app = graph_builder.compile(checkpointer=st.session_state.checkpointer)
                st.session_state.doc_meta = metadata
                st.session_state.messages = []
                st.session_state.pending_escalation = None
                
                status.update(label="✅ Knowledge Base Ready!", state="complete", expanded=False)

    # Document Overview KPIs & Summary
    if st.session_state.doc_meta:
        meta = st.session_state.doc_meta
        st.subheader(f"📊 Active Source: `{meta['filename']}`")
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Pages / Rows", meta["page_count"])
        m2.metric("Total Chunks", meta["chunk_count"])
        m3.metric("Chunk Size", f"{meta['chunk_size']} chars")
        m4.metric("Overlap", f"{meta['chunk_overlap']} chars")

        with st.expander("📌 **Executive Summary**", expanded=False):
            st.markdown(extract_text(meta["summary"]))

        st.divider()

    # Chat History
    for msg in st.session_state.messages:
        role = "user" if isinstance(msg, HumanMessage) else "assistant"
        with st.chat_message(role):
            st.write(extract_text(msg.content))

    # Human Intervention Interface
    if st.session_state.pending_escalation:
        esc_data = st.session_state.pending_escalation
        st.error("🚨 **Supervisor Intervention Required**")
        st.info(f"**Escalation Cause:** `{esc_data.get('reason')}`")
        
        tab_overview, tab_chunks = st.tabs(["📋 Review Context", "🔍 Retrieved Passages"])
        with tab_overview:
            st.markdown(f"**User Query:** {esc_data.get('query')}")
            st.markdown(f"**Confidence Grade:** `{esc_data.get('confidence', 0.0):.2f} / 1.00`")
        with tab_chunks:
            for i, doc_text in enumerate(esc_data.get("docs", []), 1):
                st.text_area(f"Chunk {i}", value=doc_text, height=120, disabled=True)

        supervisor_input = st.text_area("✍️ Supervisor Guidance / Policy Override Directive:", placeholder="Provide guidance or custom answer...")
        if st.button("✅ Resume Execution", type="primary"):
            config = {"configurable": {"thread_id": st.session_state.thread_id}}
            app = st.session_state.app
            with st.spinner("Resuming processing..."):
                for _ in app.stream(Command(resume=supervisor_input), config=config, stream_mode="values"):
                    pass
                final_state = app.get_state(config)
                bot_response = final_state.values["messages"][-1]
                st.session_state.messages.append(bot_response)
                st.session_state.pending_escalation = None
                st.rerun()

    # Interactive Sample Question Chips
    elif st.session_state.app and not st.session_state.messages:
        st.markdown("##### 💡 Quick Start Suggestions:")
        q_cols = st.columns(3)
        if q_cols[0].button("📝 Summarize key topics", use_container_width=True):
            st.session_state.active_prompt = "Summarize the primary topics covered in this document."
            st.rerun()
        if q_cols[1].button("🎯 List main requirements", use_container_width=True):
            st.session_state.active_prompt = "What are the core requirements or guidelines stated?"
            st.rerun()
        if q_cols[2].button("❓ Find key takeaways", use_container_width=True):
            st.session_state.active_prompt = "Extract the top 3 key takeaways from this document."
            st.rerun()

    # Chat Input Logic
    user_query = st.chat_input("Ask a question about the document...")
    if st.session_state.active_prompt and not user_query:
        user_query = st.session_state.active_prompt
        st.session_state.active_prompt = None

    if user_query:
        if not st.session_state.app:
            st.error("Please upload and process a document before submitting questions.")
        else:
            user_msg = HumanMessage(content=user_query)
            st.session_state.messages.append(user_msg)
            
            with st.chat_message("user"):
                st.write(user_query)

            config = {"configurable": {"thread_id": st.session_state.thread_id}}
            app = st.session_state.app
            input_payload = {"messages": [user_msg]}

            with st.chat_message("assistant"):
                def stream_graph_tokens():
                    for chunk, metadata in app.stream(input_payload, config=config, stream_mode="messages"):
                        if metadata.get("langgraph_node") == "generate_answer" and chunk.content:
                            yield extract_text(chunk.content)

                full_response = st.write_stream(stream_graph_tokens)

            state = app.get_state(config)
            if state.next and state.next[0] == "human_escalation":
                st.session_state.pending_escalation = state.tasks[0].interrupts[0].value
                st.rerun()
            else:
                if full_response:
                    st.session_state.messages.append(AIMessage(content=full_response))

# User Guide Tab Content
with tab_guide:
    st.header("📖 Application User Manual & Architecture Overview")
    st.markdown("""
    Welcome to the **Advanced Enterprise RAG Assistant**. This workstation combines state-of-the-art information retrieval with dynamic AI graph workflows.

    ---

    ### 🚀 Getting Started
    1. **Provide Your API Key**: Enter your Google Gemini API Key in the sidebar control panel.
    2. **Upload Knowledge File**: Choose a `.pdf`, `.docx`, `.txt`, or `.csv` document.
    3. **Process Document**: Click **🚀 Process** to trigger parsing, dynamic chunking, summary generation, and vector indexing.
    4. **Interact**: Query the document via the chat workspace or click quick suggestion chips.

    ---

    ### ⚙️ Core System Architecture
    
    * **Hybrid Information Retrieval**:
      * **Dense Search**: Chroma DB using Google Generative AI Embeddings (`gemini-embedding-001`).
      * **Sparse Search**: BM25 keyword matching for exact lexical terms.
      * **Cross-Encoder Reranking**: FlashRank (`TinyBERT-L-2-v2`) re-orders retrieved chunks by relevance before LLM context synthesis.
    
    * **Dynamic Parameter Calculation**:
      * Document length and paragraph counts automatically adjust chunk size ($350$ to $900$ characters) and overlap ($12\%$) on the fly.

    * **Automatic Model Switching (Failover)**:
      * **Primary Model**: `gemini-3.7-flash` (Fast execution).
      * **Fallback Model**: `gemini-3.6-flash` (Automatically invoked if primary hits rate limits or quota errors via `.with_fallbacks()`).

    ---

    ### 🛡️ Guardrails & Human-in-the-Loop Supervision
    The system routes requests through automated safety nodes before generating an answer:
    
    * **Policy & Security Check (`inspect_policy`)**: Blocks direct prompt injection attacks (`ignore previous rules`) and flags sensitive operational keywords.
    * **Confidence Evaluation (`evaluate_confidence`)**: An automated grading node scores context relevance. If relevance falls below $0.60$, the system triggers a **Human Escalation Pause**.
    * **Supervisor Override**: Supervisors can inject direct guidance or custom context into the state graph before execution resumes.
    """)