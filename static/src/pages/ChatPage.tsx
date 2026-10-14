import React, { useState, useRef, useEffect } from "react";
import { RefreshCw, Zap, Shield, RotateCcw } from "lucide-react";
import { ChatMessageBubble } from "../components/ChatMessage";
import { ChatInput } from "../components/ChatInput";
import { RobotModel } from "../components/RobotModel";
import type { ChatMessage } from "../types";

interface ChatPageProps {
  onOpenHitl: () => void;
  onOpenImageAnalysis: () => void;
  onNewChat: () => void;
}

const STARTERS = [
  "Summarize the key points of this document",
  "What are the leave policy requirements?",
  "Explain section 4.2 in simple terms",
  "Compare medical vs dental coverage",
];

export const ChatPage: React.FC<ChatPageProps> = ({
  onOpenHitl,
  onOpenImageAnalysis,
  onNewChat,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm Anveshan RAG. Upload a document and I'll answer questions about it using hybrid retrieval and cross-encoder reranking. What would you like to know?",
      timestamp: new Date().toISOString().substring(11, 19) + " UTC",
      model: "gemini-3.7-flash",
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3.7-flash");
  const [enableHighThinking, setEnableHighThinking] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const sendMessage = async (text?: string) => {
    const textToSend = text || inputQuery.trim();
    if (!textToSend || isSending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString().substring(11, 19) + " UTC",
    };
    const assistantId = `a-${Date.now() + 1}`;

    setMessages((prev) => [...prev, userMsg]);
    if (!text) setInputQuery("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSend, model: selectedModel }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${response.status}`);
      }

      if (!response.body) throw new Error("No readable stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString().substring(11, 19) + " UTC",
          model: selectedModel,
        },
      ]);

      let doneReading = false;
      let buffer = "";

      while (!doneReading) {
        const { value, done } = await reader.read();
        doneReading = done;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.type === "token") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + data.content }
                        : m
                    )
                  );
                } else if (data.type === "escalation") {
                  showToast("⚠️ Escalated to human supervisor");
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content:
                              m.content +
                              "\n\n⚠️ This query requires human supervisor review.",
                          }
                        : m
                    )
                  );
                } else if (data.type === "error") {
                  showToast("Pipeline error: " + data.content);
                }
              } catch {
                /* ignore parse errors */
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection error";
      showToast(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "⚠️ " + msg }
            : m
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="page-container">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-title-row">
            <h1 className="page-title">Document Intelligence</h1>
            <span className="status-pill status-pill-online">
              <span className="pip pip-success pip-pulse" />
              Pipeline Ready
            </span>
          </div>
          <p className="page-subtitle">
            Hybrid retrieval · BM25 + Dense vectors · Cross-encoder reranking · HITL supervision
          </p>
        </div>
        <div className="page-header-actions">
          <button className="header-action-btn" onClick={onOpenHitl} title="Simulate HITL escalation">
            <Shield className="h-4 w-4" />
            <span>HITL</span>
          </button>
          <button
            className="header-action-btn"
            onClick={onNewChat}
            title="Start new conversation"
          >
            <RotateCcw className="h-4 w-4" />
            <span>New chat</span>
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-area">
        <div className="chat-robot-wrapper">
          <RobotModel isThinking={isSending} />
        </div>

        <div className="chat-messages">
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}

          {isSending && (
            <div className="chat-row chat-row-assistant">
              <div className="chat-avatar chat-avatar-assistant">
                <RefreshCw className="h-4 w-4 animate-spin" />
              </div>
              <div className="chat-bubble chat-bubble-assistant chat-bubble-thinking">
                <span className="thinking-dots">
                  <span /><span /><span />
                </span>
                <span className="thinking-label">
                  Generating with {enableHighThinking ? "gemini-3.1-pro" : selectedModel}…
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Starter prompts — shown only on fresh chat */}
        {messages.length === 1 && (
          <div className="starter-prompts">
            {STARTERS.map((prompt) => (
              <button
                key={prompt}
                className="starter-chip"
                onClick={() => sendMessage(prompt)}
              >
                <Zap className="h-3.5 w-3.5 shrink-0" />
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <ChatInput
          value={inputQuery}
          onChange={setInputQuery}
          onSend={sendMessage}
          onAttach={onOpenImageAnalysis}
          disabled={isSending}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          enableHighThinking={enableHighThinking}
          onToggleThinking={() => setEnableHighThinking((v) => !v)}
        />
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="toast" role="status">
          <span className="pip pip-warning pip-pulse" />
          {toastMessage}
        </div>
      )}
    </div>
  );
};
