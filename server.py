"""
Enterprise RAG Workstation — Flask Backend Server
Exposes REST API endpoints for the RAG pipeline powered by rag_engine.py.
"""

import os
import uuid
import json
import secrets
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response, session, send_from_directory, stream_with_context

# Load environment variables from .env file
load_dotenv()
from flask_cors import CORS
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from rag_engine import process_document, build_rag_graph


# ---------------------------------------------------------------------------
# App Factory
# ---------------------------------------------------------------------------

app = Flask(__name__, static_folder="static/dist", static_url_path="/")
app.secret_key = secrets.token_hex(32)
CORS(app, supports_credentials=True)

# ---------------------------------------------------------------------------
# In-memory session store (keyed by session ID)
# Stores heavy objects that can't go into Flask's cookie-based session:
#   - compiled LangGraph app
#   - checkpointer
#   - retriever
# ---------------------------------------------------------------------------

_sessions: dict = {}


def _get_sid() -> str:
    """Return or create a unique session identifier."""
    if "sid" not in session:
        session["sid"] = str(uuid.uuid4())
    return session["sid"]


def _get_store() -> dict:
    """Return the server-side store for the current session."""
    sid = _get_sid()
    if sid not in _sessions:
        _sessions[sid] = {
            "app": None,
            "checkpointer": MemorySaver(),
            "thread_id": str(uuid.uuid4()),
            "messages": [],
            "doc_meta": None,
            "pending_escalation": None,
            "api_key": os.environ.get("GEMINI_API_KEY", ""),
            "langsmith_key": os.environ.get("LANGSMITH_KEY", ""),
        }
    return _sessions[sid]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_text(content) -> str:
    """Normalize LangChain message content to a plain string."""
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        return "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        )
    return str(content)


# ---------------------------------------------------------------------------
# Routes — Static Pages
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory("static/dist", "index.html")


# ---------------------------------------------------------------------------
# Routes — API Key Configuration
# ---------------------------------------------------------------------------

@app.route("/api/configure", methods=["POST"])
def configure():
    """Store API keys in the server-side session."""
    data = request.get_json(force=True)
    store = _get_store()

    api_key = data.get("api_key", "").strip() or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return jsonify({"error": "Gemini API key is required."}), 400

    store["api_key"] = api_key

    langsmith_key = data.get("langsmith_key", "").strip() or os.environ.get("LANGSMITH_KEY", "")
    if langsmith_key:
        store["langsmith_key"] = langsmith_key
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"
        os.environ["LANGCHAIN_API_KEY"] = langsmith_key
        os.environ["LANGCHAIN_PROJECT"] = "Advanced-RAG-Assistant"

    return jsonify({"status": "ok", "observability": bool(langsmith_key)})


# ---------------------------------------------------------------------------
# Routes — Document Upload & Processing
# ---------------------------------------------------------------------------

@app.route("/api/upload", methods=["POST"])
def upload_document():
    """
    Upload a document, process it through the RAG pipeline, and compile the
    LangGraph state machine.
    """
    store = _get_store()

    if not store.get("api_key"):
        return jsonify({"error": "API key not configured. Call /api/configure first."}), 400

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename."}), 400

    allowed_ext = {".pdf", ".docx", ".txt", ".csv"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        return jsonify({"error": f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_ext)}"}), 400

    api_key = store["api_key"]
    file_bytes = file.read()

    try:
        # Step 1: Process the document (parse, chunk, embed, index)
        retriever, metadata = process_document(file_bytes, file.filename, api_key)

        # Step 2: Build and compile the LangGraph state machine
        graph_builder = build_rag_graph(retriever, api_key)
        store["app"] = graph_builder.compile(checkpointer=store["checkpointer"])
        store["doc_meta"] = metadata
        store["messages"] = []
        store["pending_escalation"] = None
        store["thread_id"] = str(uuid.uuid4())

        return jsonify({
            "status": "ok",
            "metadata": metadata
        })

    except Exception as e:
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500


# ---------------------------------------------------------------------------
# Routes — Chat (SSE Streaming)
# ---------------------------------------------------------------------------

@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Send a user query to the RAG graph.
    Returns a Server-Sent Events stream of tokens from the generate_answer node.
    If an escalation interrupt occurs, the final SSE event signals it.
    """
    store = _get_store()

    if not store.get("app"):
        return jsonify({"error": "No document processed. Upload a document first."}), 400

    data = request.get_json(force=True)
    user_query = data.get("query", "").strip()
    if not user_query:
        return jsonify({"error": "Empty query."}), 400

    user_msg = HumanMessage(content=user_query)
    store["messages"].append(user_msg)

    graph_app = store["app"]
    config = {"configurable": {"thread_id": store["thread_id"]}}
    input_payload = {"messages": [user_msg]}

    def generate():
        full_response = []
        try:
            for chunk, metadata in graph_app.stream(
                input_payload, config=config, stream_mode="messages"
            ):
                if metadata.get("langgraph_node") == "generate_answer" and chunk.content:
                    text = extract_text(chunk.content)
                    full_response.append(text)
                    yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"

            # Check for escalation interrupt
            state = graph_app.get_state(config)
            if state.next and state.next[0] == "human_escalation":
                escalation_data = state.tasks[0].interrupts[0].value
                store["pending_escalation"] = escalation_data
                yield f"data: {json.dumps({'type': 'escalation', 'data': escalation_data})}\n\n"
            else:
                # Store the AI response
                response_text = "".join(full_response)
                if response_text:
                    store["messages"].append(AIMessage(content=response_text))
                yield f"data: {json.dumps({'type': 'done', 'content': response_text})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# ---------------------------------------------------------------------------
# Routes — Human-in-the-Loop Escalation Resume
# ---------------------------------------------------------------------------

@app.route("/api/escalation/resume", methods=["POST"])
def resume_escalation():
    """
    Submit supervisor guidance to resume the interrupted LangGraph execution.
    Returns the final generated answer.
    """
    store = _get_store()

    if not store.get("app"):
        return jsonify({"error": "No active session."}), 400

    if not store.get("pending_escalation"):
        return jsonify({"error": "No pending escalation to resume."}), 400

    data = request.get_json(force=True)
    supervisor_input = data.get("guidance", "").strip()

    graph_app = store["app"]
    config = {"configurable": {"thread_id": store["thread_id"]}}

    try:
        # Resume the graph with the supervisor's guidance
        for _ in graph_app.stream(
            Command(resume=supervisor_input), config=config, stream_mode="values"
        ):
            pass

        final_state = graph_app.get_state(config)
        bot_response = final_state.values["messages"][-1]
        response_text = extract_text(bot_response.content)

        store["messages"].append(bot_response)
        store["pending_escalation"] = None

        return jsonify({
            "status": "ok",
            "response": response_text
        })

    except Exception as e:
        return jsonify({"error": f"Resume failed: {str(e)}"}), 500


# ---------------------------------------------------------------------------
# Routes — Session Management
# ---------------------------------------------------------------------------

@app.route("/api/session/reset", methods=["POST"])
def reset_session():
    """Clear all session state and start fresh."""
    store = _get_store()
    store["app"] = None
    store["messages"] = []
    store["doc_meta"] = None
    store["pending_escalation"] = None
    store["thread_id"] = str(uuid.uuid4())
    store["checkpointer"] = MemorySaver()
    return jsonify({"status": "ok"})


@app.route("/api/session/export", methods=["GET"])
def export_session():
    """Download the chat history as a JSON file."""
    store = _get_store()
    chat_export = [
        {
            "role": "user" if isinstance(m, HumanMessage) else "assistant",
            "content": extract_text(m.content)
        }
        for m in store.get("messages", [])
    ]
    return Response(
        json.dumps(chat_export, indent=2),
        mimetype="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=chat_history_{store['thread_id'][:8]}.json"
        }
    )


@app.route("/api/session/status", methods=["GET"])
def session_status():
    """Return current session state for the frontend to sync on page load."""
    store = _get_store()
    return jsonify({
        "configured": bool(store.get("api_key")),
        "document_loaded": store.get("app") is not None,
        "doc_meta": store.get("doc_meta"),
        "messages": [
            {
                "role": "user" if isinstance(m, HumanMessage) else "assistant",
                "content": extract_text(m.content)
            }
            for m in store.get("messages", [])
        ],
        "pending_escalation": store.get("pending_escalation"),
        "thread_id": store.get("thread_id"),
    })


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("\n  [*] Enterprise RAG Workstation -- Flask Server")
    print(f"  [>] API Base:  http://localhost:{port}/api")
    print(f"  [>] Frontend:  http://localhost:{port}/\n")
    app.run(host="0.0.0.0", port=port, debug=True, threaded=True)
