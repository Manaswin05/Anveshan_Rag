import streamlit as st
import requests
import json
from datetime import datetime
from ingestion import process_pdf, build_indices
from retriever import retrieve_and_rerank
from guardrails import check_policy

st.set_page_config(page_title="Anveshan AI Workstation", layout="wide")

OLLAMA_BASE_URL = "http://127.0.0.1:11434"

if "chat_history" not in st.session_state:
    st.session_state.chat_history = []
if "faiss_index" not in st.session_state:
    st.session_state.faiss_index = None
if "bm25_index" not in st.session_state:
    st.session_state.bm25_index = None
if "chunks" not in st.session_state:
    st.session_state.chunks = []
if "metadata" not in st.session_state:
    st.session_state.metadata = []
if "extracted_images" not in st.session_state:
    st.session_state.extracted_images = []
if "doc_stats" not in st.session_state:
    st.session_state.doc_stats = []
if "processed_filenames" not in st.session_state:
    st.session_state.processed_filenames = set()

def unload_model(model_name: str):
    """Forces Ollama to immediately unload a specific model from RAM by sending keep_alive: 0 with an empty prompt."""
    try:
        requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": model_name, "prompt": "", "keep_alive": 0},
            timeout=10
        )
    except Exception:
        pass

def generate_answer(query: str, context: str) -> str:
    unload_model("moondream")

    prompt = f"""You are Anveshan AI, an enterprise RAG assistant.
Answer the user's question using ONLY the provided context blocks.
Every time you state a fact from a context block, cite its exact chunk ID tag inline (e.g., [doc_P1_C1] or [IMG_doc_P2_1]).
If the context does not contain enough information to answer the question, output 'CONFIDENCE_LOW' and stop.

Context Blocks:
{context}

Question: {query}
Answer:"""

    payload = {
        "model": "llama3.2:3b",
        "prompt": prompt,
        "stream": False,
        "keep_alive": "5m", 
        "options": {
            "num_gpu": 0,         # Force CPU mapping
            "use_mmap": False,    # Stop contiguous allocation
            "num_thread": 6,   
            "num_ctx": 2048,   
            "temperature": 0.1
        }
    }
    
    try:
        response = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=180)
        if response.status_code == 200:
            return response.json().get("response", "Error: Empty response from model.")
        else:
            try:
                err_detail = response.json().get("error", response.text)
            except Exception:
                err_detail = response.text
            return f"⚠️ **Ollama Server Error (HTTP {response.status_code}):** `{err_detail}`"
    except requests.exceptions.ConnectionError:
        return "⚠️ **LLM Connection Error:** Cannot connect to Ollama at `127.0.0.1:11434`. Make sure Ollama is running (`ollama serve`)."
    except Exception as e:
        return f"⚠️ **LLM Error:** `{str(e)}`"

def format_chat_for_download() -> str:
    lines = [
        "# Anveshan AI Workstation — Chat Transcript",
        f"**Exported:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n",
        "---\n"
    ]
    for msg in st.session_state.chat_history:
        role_label = "User" if msg["role"] == "user" else "Anveshan AI"
        lines.append(f"### {role_label}")
        if "target_doc" in msg:
            lines.append(f"*Target Filter: `{msg['target_doc']}`*")
        if "confidence" in msg:
            lines.append(f"*Confidence Score: `{int(msg['confidence'] * 100)}%`*")
        lines.append(f"\n{msg['content']}\n")
        if msg.get("citations"):
            lines.append("**Retrieved Evidence Citations:**")
            for c in msg["citations"]:
                lines.append(f"- `[{c['chunk_id']}]` | {c['source']} (Page {c['page']}) — Confidence: {int(c['confidence']*100)}%")
        lines.append("\n---\n")
    return "\n".join(lines)

with st.sidebar:
    st.title("Anveshan Controls")
    
    st.subheader("1. Upload Documents")
    uploaded_files = st.file_uploader(
        "Upload PDFs (Max 5 files per session)", 
        type=["pdf"], 
        accept_multiple_files=True
    )
    
    if st.button("Process & Index Documents", use_container_width=True):
        if not uploaded_files:
            st.warning("Please select at least one PDF file.")
        elif len(st.session_state.processed_filenames) + len(uploaded_files) > 5:
            st.error("RAM Shield: Maximum 5 documents allowed per session. Reset workspace to clear.")
        else:
            unload_model("llama3.2:3b")
            
            new_files_processed = 0
            for file in uploaded_files:
                if file.name in st.session_state.processed_filenames:
                    st.info(f"Skipping '{file.name}' (already indexed).")
                    continue
                
                with st.spinner(f"Parsing '{file.name}' & analyzing visuals with Moondream..."):
                    file_bytes = file.read()
                    start_idx = len(st.session_state.chunks)
                    chunks, meta, images, stats = process_pdf(file_bytes, file.name, start_idx)
                    
                    if chunks:
                        st.session_state.chunks.extend(chunks)
                        st.session_state.metadata.extend(meta)
                        st.session_state.extracted_images.extend(images)
                        st.session_state.doc_stats.append(stats)
                        st.session_state.processed_filenames.add(file.name)
                        new_files_processed += 1
            
            if new_files_processed > 0:
                with st.spinner("Updating in-memory FAISS & BM25 indices..."):
                    st.session_state.faiss_index, st.session_state.bm25_index = build_indices(st.session_state.chunks)
                st.success(f"Indexed {new_files_processed} new document(s)!")

    st.divider()

    st.subheader("2. Document Scope Filter")
    doc_options = ["All Documents"] + sorted(list(st.session_state.processed_filenames))
    selected_doc_filter = st.selectbox(
        "Restrict search & Q&A to:",
        options=doc_options,
        help="Choose a specific file to query only that document, or 'All Documents' to search across everything."
    )

    st.divider()

    st.subheader("3. Session Management")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Clear Chat", use_container_width=True):
            st.session_state.chat_history = []
            st.rerun()
    with col2:
        if st.button("Full Reset", use_container_width=True):
            unload_model("llama3.2:3b")
            unload_model("moondream")
            st.session_state.clear()
            st.rerun()

    if st.session_state.chat_history:
        st.download_button(
            label="Download Chat (.md)",
            data=format_chat_for_download(),
            file_name=f"anveshan_chat_{datetime.now().strftime('%Y%m%d_%H%M')}.md",
            mime="text/markdown",
            use_container_width=True
        )
        st.download_button(
            label="Download Raw Log (.json)",
            data=json.dumps(st.session_state.chat_history, indent=2),
            file_name=f"anveshan_chat_{datetime.now().strftime('%Y%m%d_%H%M')}.json",
            mime="application/json",
            use_container_width=True
        )

st.title("Anveshan AI Workstation")

if st.session_state.doc_stats:
    with st.expander("📊 Document Indexing, Chunking & Page Telemetry", expanded=True):
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Documents Indexed", f"{len(st.session_state.processed_filenames)} / 5")
        m2.metric("Total Pages Parsed", sum(d["Total Pages"] for d in st.session_state.doc_stats))
        m3.metric("Total Active Chunks", len(st.session_state.chunks))
        m4.metric("Visual Assets Extracted", len(st.session_state.extracted_images))
        
        st.dataframe(st.session_state.doc_stats, use_container_width=True, hide_index=True)

    with st.expander(f"🖼️ Extracted Visual Assets Catalog ({len(st.session_state.extracted_images)} Images) — Use ID in Prompt", expanded=False):
        if not st.session_state.extracted_images:
            st.info("No embedded charts or diagrams (>80x80px) were detected in the uploaded PDFs.")
        else:
            st.caption("Tip: Copy any **Promptable Image ID** below and mention it in your chat question (e.g., *'Explain the trends shown in IMG_report_P2_1'*).")
            for img_item in st.session_state.extracted_images:
                img_col, desc_col = st.columns([1, 3])
                with img_col:
                    st.image(img_item["image_bytes"], caption=img_item["id"], use_container_width=True)
                with desc_col:
                    st.markdown(f"**Promptable Image ID:** `{img_item['id']}`")
                    st.markdown(f"**Location:** `{img_item['source']}` — Page `{img_item['page']}`")
                    st.markdown(f"**Moondream VLM Analysis:**\n> {img_item['description']}")
                st.divider()

for chat in st.session_state.chat_history:
    with st.chat_message(chat["role"]):
        if chat["role"] == "assistant" and "confidence" in chat:
            conf_pct = int(chat["confidence"] * 100)
            threshold_status = "Qualified" if chat.get("passed_threshold", True) else "Below 60% Threshold"
            st.progress(chat["confidence"], text=f"Aggregated Confidence: {conf_pct}% ({threshold_status}) | Scope: {chat.get('target_doc', 'All Documents')}")
        
        st.markdown(chat["content"])
        
        if chat.get("citations"):
            expander_title = f"🔍 View {len(chat['citations'])} Evidence Chunk(s)"
            with st.expander(expander_title):
                for c in chat["citations"]:
                    st.markdown(
                        f"**[{c['chunk_id']}]** — **File:** `{c['source']}` | **Page:** `{c['page']}` | "
                        f"**Vector Index:** `#{c['vector_id']}` | **Type:** `{c['type'].upper()}` | "
                        f"**Chunk Confidence:** `{int(c['confidence']*100)}%`"
                    )
                    st.caption(c["text"])
                    st.divider()

user_query = st.chat_input(f"Ask a question ({selected_doc_filter})...")

if user_query:
    if not check_policy(user_query):
        st.error("Query blocked by security guardrails. Please rephrase your question.")
    elif not st.session_state.faiss_index:
        st.warning("Please upload and index at least one PDF document first.")
    else:
        with st.chat_message("user"):
            st.markdown(user_query)
        st.session_state.chat_history.append({"role": "user", "content": user_query})

        with st.chat_message("assistant"):
            with st.spinner(f"Searching across '{selected_doc_filter}'..."):
                top_results, aggregated_conf, passed_threshold = retrieve_and_rerank(
                    query=user_query,
                    faiss_index=st.session_state.faiss_index,
                    bm25_index=st.session_state.bm25_index,
                    chunks=st.session_state.chunks,
                    metadata=st.session_state.metadata,
                    target_doc=selected_doc_filter,
                    top_k=8,
                    threshold=0.60,
                    max_passages=4
                )

                conf_pct = int(aggregated_conf * 100)

                if not passed_threshold:
                    st.progress(aggregated_conf, text=f"Confidence Score: {conf_pct}% (Below 60% Threshold) | Scope: {selected_doc_filter}")
                    final_response = (
                        f"⚠️ **Low Confidence Escalation ({conf_pct}%):** No chunks met the minimum 60% "
                        f"confidence threshold in **{selected_doc_filter}**. Escalating to human supervisor. "
                        "You can review the closest candidate chunks below."
                    )
                    st.markdown(final_response)
                    
                    citations_payload = []
                    if top_results:
                        with st.expander("🔍 View Near-Miss Candidate Chunks (< 60%)"):
                            for c in top_results:
                                meta = c["meta"]
                                st.markdown(
                                    f"**[{meta['chunk_id']}]** — **File:** `{meta['source']}` | **Page:** `{meta['page']}` | "
                                    f"**Confidence:** `{int(c['confidence']*100)}%` (Below Threshold)"
                                )
                                st.caption(c["text"])
                                st.divider()
                                citations_payload.append({
                                    "chunk_id": meta["chunk_id"],
                                    "source": meta["source"],
                                    "page": meta["page"],
                                    "vector_id": meta["vector_id"],
                                    "type": meta["type"],
                                    "confidence": c["confidence"],
                                    "text": c["text"]
                                })

                    st.session_state.chat_history.append({
                        "role": "assistant",
                        "content": final_response,
                        "confidence": aggregated_conf,
                        "passed_threshold": False,
                        "target_doc": selected_doc_filter,
                        "citations": citations_payload
                    })
                else:
                    context_blocks = []
                    citations_payload = []
                    for res in top_results:
                        meta = res["meta"]
                        header = f"[{meta['source']} | Page: {meta['page']} | ID: {meta['chunk_id']} | VectorIndex: {meta['vector_id']}]"
                        context_blocks.append(f"{header}\n{res['text']}")
                        citations_payload.append({
                            "chunk_id": meta["chunk_id"],
                            "source": meta["source"],
                            "page": meta["page"],
                            "vector_id": meta["vector_id"],
                            "type": meta["type"],
                            "confidence": res["confidence"],
                            "text": res["text"]
                        })

                    st.progress(aggregated_conf, text=f"Aggregated Confidence: {conf_pct}% ({len(top_results)} chunk(s) ≥ 60%) | Scope: {selected_doc_filter}")

                    context_str = "\n\n---\n\n".join(context_blocks)
                    answer = generate_answer(user_query, context_str)

                    if "CONFIDENCE_LOW" in answer:
                        final_response = (
                            f"⚠️ **Context Insufficient:** Relevant chunks were located ({conf_pct}% confidence), "
                            "but they did not contain a definitive answer to your specific query."
                        )
                    else:
                        final_response = answer

                    st.markdown(final_response)

                    with st.expander(f"🔍 View {len(citations_payload)} Qualifying Evidence Chunk(s) (≥ 60%)"):
                        for c in citations_payload:
                            st.markdown(
                                f"**[{c['chunk_id']}]** — **File:** `{c['source']}` | **Page:** `{c['page']}` | "
                                f"**Vector Index:** `#{c['vector_id']}` | **Type:** `{c['type'].upper()}` | "
                                f"**Chunk Confidence:** `{int(c['confidence']*100)}%`"
                            )
                            st.caption(c["text"])
                            st.divider()

                    st.session_state.chat_history.append({
                        "role": "assistant",
                        "content": final_response,
                        "confidence": aggregated_conf,
                        "passed_threshold": True,
                        "target_doc": selected_doc_filter,
                        "citations": citations_payload
                    })