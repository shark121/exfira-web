"use client";

import { useState, useRef, useEffect } from "react";

type Redaction = {
  entity_type: string;
  original: string;
  token: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  redactions?: Redaction[];
  redacted_prompt?: string;
};

const ENTITY_COLORS: Record<string, string> = {
  PERSON: "#ff453a",
  EMAIL_ADDRESS: "#ff9f0a",
  PHONE_NUMBER: "#30d158",
  CREDIT_CARD: "#bf5af2",
  IP_ADDRESS: "#64d2ff",
  LOCATION: "#ffd60a",
  URL: "#0a84ff",
  US_SSN: "#ff453a",
  ORGANIZATION: "#ff6961",
  NRP: "#a78bfa",
  UK_NHS: "#34d399",
};

function entityColor(type: string) {
  return ENTITY_COLORS[type] ?? "#888888";
}

function highlight(text: string, redactions: Redaction[]) {
  if (!redactions.length) return <span>{text}</span>;
  let result = text;
  const parts: Array<{ text: string; isToken: boolean; color?: string }> = [];
  const tokenMap = Object.fromEntries(
    redactions.map((r) => [r.token, r])
  );

  // Split by all tokens
  const tokenPattern = redactions.map((r) =>
    r.token.replace(/[<>]/g, (c) => `\\${c}`)
  ).join("|");

  if (!tokenPattern) return <span>{text}</span>;

  const re = new RegExp(`(${tokenPattern})`, "g");
  const segments = result.split(re);

  for (const seg of segments) {
    if (tokenMap[seg]) {
      parts.push({ text: seg, isToken: true, color: entityColor(tokenMap[seg].entity_type) });
    } else if (seg) {
      parts.push({ text: seg, isToken: false });
    }
  }

  return (
    <>
      {parts.map((p, i) =>
        p.isToken ? (
          <span
            key={i}
            className="rounded px-1 py-0.5 font-mono text-xs font-semibold"
            style={{
              background: `${p.color}20`,
              border: `1px solid ${p.color}50`,
              color: p.color,
            }}
          >
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

function MessageBubble({
  msg,
  onInspect,
  isSelected,
}: {
  msg: Message;
  onInspect: (msg: Message) => void;
  isSelected: boolean;
}) {
  const isUser = msg.role === "user";
  const hasRedactions = (msg.redactions?.length ?? 0) > 0;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1"
        style={{
          background: isUser ? "var(--red)" : "var(--surface-2)",
          border: isUser ? "none" : "1px solid var(--border)",
          color: isUser ? "#fff" : "var(--text-muted)",
        }}
      >
        {isUser ? "U" : "E"}
      </div>

      <div
        className={`flex flex-col gap-1.5 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={{
            background: isUser ? "var(--surface-2)" : "var(--surface)",
            border: isSelected
              ? "1px solid rgba(255,69,58,0.4)"
              : "1px solid var(--border)",
            color: "var(--text)",
          }}
        >
          {msg.content}
        </div>

        {isUser && hasRedactions && (
          <button
            onClick={() => onInspect(msg)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--red-dim)",
              border: "1px solid rgba(255,69,58,0.25)",
              color: "var(--red)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>
              shield
            </span>
            {msg.redactions!.length} item{msg.redactions!.length !== 1 ? "s" : ""} redacted — inspect
          </button>
        )}

        {isUser && !hasRedactions && msg.role === "user" && (
          <span className="text-xs px-2" style={{ color: "var(--text-muted)" }}>
            No PII detected
          </span>
        )}
      </div>
    </div>
  );
}

function InspectorPanel({
  msg,
  onClose,
}: {
  msg: Message | null;
  onClose: () => void;
}) {
  if (!msg) return null;

  return (
    <aside
      className="flex-shrink-0 flex flex-col h-full overflow-hidden"
      style={{
        width: 320,
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-14 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "16px", color: "var(--red)" }}
          >
            shield
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Privacy Inspector
          </span>
        </div>
        <button
          onClick={onClose}
          className="hover:opacity-60 transition-opacity"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            close
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Original query */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Original Query
          </p>
          <div
            className="rounded-lg px-3 py-2.5 text-sm leading-relaxed"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            {msg.content}
          </div>
        </div>

        {/* What was sent to LLM */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Sent to LLM
          </p>
          <div
            className="rounded-lg px-3 py-2.5 text-sm leading-relaxed"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            {msg.redacted_prompt
              ? highlight(msg.redacted_prompt, msg.redactions ?? [])
              : <span style={{ color: "var(--text-muted)" }}>—</span>}
          </div>
        </div>

        {/* Redaction table */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Redacted Items ({msg.redactions?.length ?? 0})
          </p>

          {(msg.redactions?.length ?? 0) === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No PII detected in this message.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {msg.redactions!.map((r, i) => {
                const color = entityColor(r.entity_type);
                return (
                  <div
                    key={i}
                    className="rounded-lg p-3"
                    style={{
                      background: "var(--surface-2)",
                      border: `1px solid ${color}25`,
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color }}
                      >
                        {r.entity_type}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Original
                        </span>
                        <span
                          className="text-xs font-medium text-right"
                          style={{ color: "var(--text)" }}
                        >
                          {r.original}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Token
                        </span>
                        <span
                          className="text-xs font-mono font-semibold"
                          style={{ color }}
                        >
                          {r.token}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info note */}
        <div
          className="rounded-lg px-3 py-2.5 text-xs leading-relaxed"
          style={{
            background: "var(--red-dim)",
            border: "1px solid rgba(255,69,58,0.15)",
            color: "var(--text-muted)",
          }}
        >
          The LLM never sees the original values. Tokens are replaced back after the response is received.
        </div>
      </div>
    </aside>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content:
        "Hello. I'm Exfira — your private AI assistant. Your conversations are automatically redacted before leaving your device. What would you like help with?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectedMsg, setInspectedMsg] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();

      // Attach redactions and redacted_prompt to the user message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsg.id
            ? {
                ...m,
                redactions: data.redactions ?? [],
                redacted_prompt: data.redacted_prompt ?? m.content,
              }
            : m
        )
      );

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_a",
          role: "assistant",
          content: data.response ?? "No response.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_err",
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInspect(msg: Message) {
    setInspectedMsg((prev) => (prev?.id === msg.id ? null : msg));
  }

  const totalRedactions = messages.reduce(
    (acc, m) => acc + (m.redactions?.length ?? 0),
    0
  );

  return (
    <div className="h-screen flex" style={{ background: "var(--bg)" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
      />

      {/* Left Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col transition-all duration-200"
        style={{
          width: sidebarOpen ? 220 : 52,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center h-14 hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            {sidebarOpen ? "menu_open" : "menu"}
          </span>
        </button>

        <div
          className="px-3 pb-4 flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span
            className="w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ background: "var(--red)", color: "#fff" }}
          >
            E
          </span>
          {sidebarOpen && (
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              exfira
            </span>
          )}
        </div>

        <div className="p-2 flex-1">
          <button
            className="w-full rounded-lg flex items-center gap-2 px-2 py-2 text-sm transition-colors hover:opacity-80"
            style={{
              background: "var(--red-dim)",
              border: "1px solid rgba(255,69,58,0.2)",
              color: "var(--red)",
            }}
            onClick={() => {
              setMessages([
                {
                  id: "0",
                  role: "assistant",
                  content: "New conversation started. What would you like help with?",
                },
              ]);
              setInspectedMsg(null);
            }}
          >
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: "18px" }}>
              add
            </span>
            {sidebarOpen && <span>New chat</span>}
          </button>
        </div>

        {sidebarOpen && totalRedactions > 0 && (
          <div
            className="mx-2 mb-2 rounded-lg px-3 py-2.5"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "14px", color: "var(--red)" }}
              >
                shield
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                Protected
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {totalRedactions} PII item{totalRedactions !== 1 ? "s" : ""} this session
            </p>
          </div>
        )}

        <div className="p-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            className="w-full rounded-lg flex items-center gap-2 px-2 py-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: "18px" }}>
              settings
            </span>
            {sidebarOpen && <span>Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main chat */}
      <main className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center justify-between px-6 h-14 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Chat
          </span>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: "var(--red-dim)",
                border: "1px solid rgba(255,69,58,0.2)",
                color: "var(--red)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                shield
              </span>
              PII Redaction Active
            </div>
            {inspectedMsg && (
              <button
                onClick={() => setInspectedMsg(null)}
                className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-70"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                  close
                </span>
                Close inspector
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onInspect={handleInspect}
                isSelected={inspectedMsg?.id === msg.id}
              />
            ))}

            {loading && (
              <div className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  E
                </div>
                <div
                  className="rounded-2xl px-4 py-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: "var(--text-muted)",
                          animation: `blink 1.2s ${i * 0.2}s ease-in-out infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div
          className="flex-shrink-0 px-4 pb-4 pt-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="max-w-2xl mx-auto">
            <div
              className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResize(e.target);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message Exfira… PII is redacted automatically"
                className="flex-1 resize-none bg-transparent outline-none text-sm py-1.5 leading-relaxed"
                style={{ color: "var(--text)" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-30"
                style={{ background: "var(--red)", color: "#fff" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  arrow_upward
                </span>
              </button>
            </div>
            <p className="text-center text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Click{" "}
              <span style={{ color: "var(--red)" }}>inspect</span> on any message to see what was redacted
            </p>
          </div>
        </div>
      </main>

      {/* Right: Privacy Inspector */}
      {inspectedMsg && (
        <InspectorPanel msg={inspectedMsg} onClose={() => setInspectedMsg(null)} />
      )}
    </div>
  );
}
