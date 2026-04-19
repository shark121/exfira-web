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
  PERSON: "#b91c1c",
  EMAIL_ADDRESS: "#b45309",
  PHONE_NUMBER: "#15803d",
  CREDIT_CARD: "#7e22ce",
  IP_ADDRESS: "#0369a1",
  LOCATION: "#a16207",
  URL: "#1d4ed8",
  US_SSN: "#b91c1c",
  ORGANIZATION: "#9f1239",
  NRP: "#6b21a8",
};
function entityColor(t: string) { return ENTITY_COLORS[t] ?? "#5e5e5e"; }

function HighlightedText({ text, redactions }: { text: string; redactions: Redaction[] }) {
  if (!redactions.length) return <>{text}</>;
  const map = Object.fromEntries(redactions.map((r) => [r.token, r]));
  const pat = redactions.map((r) => r.token.replace(/[<>]/g, (c) => `\\${c}`)).join("|");
  if (!pat) return <>{text}</>;
  return (
    <>
      {text.split(new RegExp(`(${pat})`, "g")).map((seg, i) =>
        map[seg] ? (
          <span
            key={i}
            className="rounded px-1 py-0.5 font-mono text-[11px] font-semibold"
            style={{ background: `${entityColor(map[seg].entity_type)}12`, color: entityColor(map[seg].entity_type), border: `1px solid ${entityColor(map[seg].entity_type)}25` }}
          >
            {seg}
          </span>
        ) : (
          <span key={i}>{seg}</span>
        )
      )}
    </>
  );
}

function InspectorPanel({ msg, onClose }: { msg: Message; onClose: () => void }) {
  return (
    <aside
      className="flex-shrink-0 flex flex-col h-full animate-fade-in"
      style={{
        width: 300,
        background: "var(--surface-lowest)",
        borderLeft: "1px solid var(--outline-variant)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 h-16 shrink-0"
        style={{ borderBottom: "1px solid var(--outline-variant)" }}
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>
          Privacy Details
        </span>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface)]"
          style={{ color: "var(--secondary)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--outline)" }}>
            You typed
          </p>
          <div
            className="text-[13px] leading-relaxed rounded-lg p-3"
            style={{ background: "var(--surface-low)", color: "var(--on-surface)", border: "1px solid var(--outline-variant)" }}
          >
            {msg.content}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--outline)" }}>
            Sent to LLM
          </p>
          <div
            className="text-[13px] leading-relaxed rounded-lg p-3"
            style={{ background: "var(--surface-low)", color: "var(--on-surface)", border: "1px solid var(--outline-variant)" }}
          >
            {msg.redacted_prompt
              ? <HighlightedText text={msg.redacted_prompt} redactions={msg.redactions ?? []} />
              : <span style={{ color: "var(--outline)" }}>No PII found — sent as-is.</span>}
          </div>
        </div>

        {(msg.redactions?.length ?? 0) > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--outline)" }}>
              Redacted ({msg.redactions!.length})
            </p>
            <div className="flex flex-col gap-2">
              {msg.redactions!.map((r, i) => {
                const color = entityColor(r.entity_type);
                return (
                  <div
                    key={i}
                    className="rounded-lg p-3 flex items-center justify-between gap-3"
                    style={{ background: "var(--surface-low)", border: `1px solid ${color}20` }}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
                        {r.entity_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[13px] font-medium truncate" style={{ color: "var(--on-surface)" }}>
                        {r.original}
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-mono flex-shrink-0 rounded px-2 py-0.5 font-semibold"
                      style={{ background: `${color}10`, color, border: `1px solid ${color}20` }}
                    >
                      {r.token}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[11px] leading-relaxed" style={{ color: "var(--outline)" }}>
          The LLM only ever sees tokens. Original values are restored after the response is received.
        </p>
      </div>
    </aside>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [inspectedMsg, setInspectedMsg] = useState<Message | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isEmptyState = messages.length === 0;

  useEffect(() => {
    if (!isEmptyState) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isEmptyState]);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsg.id
            ? { ...m, redactions: data.redactions ?? [], redacted_prompt: data.redacted_prompt ?? m.content }
            : m
        )
      );
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + "_a", role: "assistant", content: data.response ?? "No response." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + "_err", role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function copyMessage(id: string, content: string) {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  function handleInspect(msg: Message) {
    setInspectedMsg((prev) => (prev?.id === msg.id ? null : msg));
  }

  const totalRedacted = messages.reduce((a, m) => a + (m.redactions?.length ?? 0), 0);

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "var(--bg)" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Inter:wght@400;500;600&display=swap" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        className="h-screen flex flex-col shrink-0 overflow-hidden"
        style={{
          width: sidebarOpen ? 240 : 56,
          background: "var(--surface-low)",
          borderRight: "1px solid var(--outline-variant)",
          transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center h-16 px-3 shrink-0 gap-2"
          style={{ borderBottom: "1px solid var(--outline-variant)" }}
        >
          {sidebarOpen ? (
            <div className="flex-1 min-w-0">
              <h1
                className="text-[18px] font-extrabold uppercase tracking-tight leading-none"
                style={{ fontFamily: "var(--font-headline)", color: "var(--primary)" }}
              >
                EXFIRA
              </h1>
              <p className="text-[8px] uppercase tracking-[0.15em] mt-0.5" style={{ color: "var(--secondary)" }}>
                Private AI
              </p>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface)]"
            style={{ color: "var(--secondary)" }}
            title={sidebarOpen ? "Collapse" : "Expand"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              {sidebarOpen ? "left_panel_close" : "left_panel_open"}
            </span>
          </button>
        </div>

        {/* New Chat */}
        <div className="px-3 pt-4 pb-2 shrink-0">
          <button
            onClick={() => { setMessages([]); setInspectedMsg(null); }}
            title="New Chat"
            className="w-full flex items-center rounded font-semibold text-xs uppercase tracking-widest transition-all hover:opacity-80 active:scale-95"
            style={{
              background: "var(--primary)",
              color: "var(--on-primary)",
              fontFamily: "var(--font-body)",
              justifyContent: sidebarOpen ? "space-between" : "center",
              padding: sidebarOpen ? "10px 14px" : "10px",
            }}
          >
            {sidebarOpen && <span>New Chat</span>}
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pt-2 flex flex-col gap-0.5">
          {!isEmptyState && (
            <button
              title="Current Chat"
              className="w-full flex items-center gap-3 rounded-lg text-[13px] font-semibold transition-all"
              style={{
                background: "var(--surface-lowest)",
                color: "var(--primary)",
                padding: sidebarOpen ? "10px 12px" : "10px",
                justifyContent: sidebarOpen ? "flex-start" : "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}>
                chat_bubble
              </span>
              {sidebarOpen && <span className="truncate">Current Chat</span>}
            </button>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 shrink-0 flex flex-col gap-1" style={{ borderTop: "1px solid var(--outline-variant)" }}>
          <div className="pt-3" />

          {/* Privacy counter */}
          {totalRedacted > 0 && (
            <div
              className="flex items-center rounded-lg overflow-hidden mb-1"
              style={{
                background: `rgba(185,28,28,0.06)`,
                border: "1px solid rgba(185,28,28,0.15)",
                padding: sidebarOpen ? "7px 10px" : "7px",
                justifyContent: sidebarOpen ? "flex-start" : "center",
                gap: sidebarOpen ? 8 : 0,
              }}
              title={`${totalRedacted} items protected`}
            >
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: "16px", color: "#b91c1c" }}>shield</span>
              {sidebarOpen && (
                <span className="text-[11px] font-medium" style={{ color: "#b91c1c" }}>
                  {totalRedacted} protected
                </span>
              )}
            </div>
          )}

          <div
            className="flex items-center rounded-lg cursor-pointer transition-colors hover:bg-[var(--surface)]"
            style={{
              padding: sidebarOpen ? "7px 10px" : "7px",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              gap: sidebarOpen ? 10 : 0,
            }}
            title="Administrator"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{ background: "var(--surface-high)", color: "var(--on-surface)", border: "1px solid var(--outline-variant)" }}
            >
              A
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate leading-none" style={{ color: "var(--primary)" }}>Administrator</p>
                <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--secondary)" }}>admin@exfira.io</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden" style={{ background: "var(--bg)" }}>

        {/* Topbar */}
        <header
          className="flex justify-end items-center px-6 h-16 shrink-0 sticky top-0 z-20"
          style={{ background: "rgba(249,249,249,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--outline-variant)" }}
        >
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="w-9 h-9 flex items-center justify-center rounded-full font-bold text-[13px] transition-colors hover:bg-[var(--surface)]"
              style={{ background: "var(--surface-high)", color: "var(--primary)", border: "1px solid var(--outline-variant)" }}
              title="Account"
            >
              A
            </button>

            {userMenuOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                {/* Dropdown */}
                <div
                  className="absolute right-0 top-11 z-40 w-56 rounded-xl py-1 animate-fade-up"
                  style={{
                    background: "var(--surface-lowest)",
                    border: "1px solid var(--outline-variant)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                  }}
                >
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--outline-variant)" }}>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--primary)" }}>Administrator</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--secondary)" }}>admin@exfira.io</p>
                  </div>
                  <a
                    href="/login"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors hover:bg-[var(--surface-low)]"
                    style={{ color: "var(--error)" }}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>logout</span>
                    Sign out
                  </a>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Ambient orb */}
        <div className="ambient-orb" />

        {isEmptyState ? (
          /* ── Empty / home state ── */
          <div className="flex-1 relative z-10 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-end pb-8 px-6">
              <div className="w-full max-w-2xl text-center mb-10">
                <h2
                  className="text-[2.75rem] leading-none font-bold tracking-tight mb-3"
                  style={{ fontFamily: "var(--font-headline)", color: "var(--primary)" }}
                >
                  Hello, where do we start today?
                </h2>
                <p className="text-base" style={{ color: "var(--secondary)" }}>
                  Your data is redacted before it reaches any model.
                </p>
              </div>

              <div className="w-full max-w-2xl relative">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Exfira anything…"
                  className="w-full resize-none outline-none text-[15px] leading-relaxed"
                  style={{
                    background: "var(--surface-lowest)",
                    color: "var(--on-surface)",
                    border: "1px solid var(--outline-variant)",
                    borderRadius: "0.75rem",
                    padding: "18px 52px 18px 20px",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
                    fontFamily: "var(--font-body)",
                  }}
                />
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:opacity-80"
                    style={{ background: "var(--primary)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fff" }}>arrow_upward</span>
                  </button>
                </div>
              </div>

              <p className="text-[10px] uppercase tracking-widest font-bold mt-3" style={{ color: "var(--outline-variant)", fontFamily: "var(--font-body)" }}>
                Exfira redacts PII before any data leaves this device
              </p>
            </div>
          </div>
        ) : (
          /* ── Chat state ── */
          <div className="flex-1 overflow-y-auto pb-36 pt-6 z-10 relative">
            <div className="max-w-2xl mx-auto px-4 md:px-6 flex flex-col gap-8 w-full">
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="flex flex-col items-end w-full animate-fade-up">
                    <div
                      className="px-5 py-3.5 rounded-xl rounded-tr-sm max-w-[82%] text-[14px] leading-relaxed"
                      style={{
                        background: "var(--surface-highest)",
                        color: "var(--on-surface)",
                        border: inspectedMsg?.id === msg.id ? "1px solid rgba(185,28,28,0.3)" : "1px solid transparent",
                      }}
                    >
                      {msg.content}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 pr-1">
                      {msg.redactions !== undefined ? (
                        msg.redactions.length > 0 ? (
                          <button
                            onClick={() => handleInspect(msg)}
                            className="flex items-center gap-1.5 text-[11px] font-medium transition-opacity hover:opacity-70"
                            style={{ color: inspectedMsg?.id === msg.id ? "#b91c1c" : "var(--outline)" }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>shield</span>
                            {msg.redactions.length} item{msg.redactions.length !== 1 ? "s" : ""} protected — inspect
                          </button>
                        ) : (
                          <span className="text-[11px]" style={{ color: "var(--outline-variant)" }}>No PII detected</span>
                        )
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex items-start gap-3 w-full animate-fade-up">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "var(--primary)" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#fff" }}>auto_awesome</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-3 pt-1">
                      <p className="text-[14px] leading-relaxed" style={{ color: "var(--on-surface)" }}>
                        {msg.content}
                      </p>
                      <button
                        title="Copy"
                        onClick={() => copyMessage(msg.id, msg.content)}
                        className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-70"
                        style={{ color: "var(--outline)" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                          {copied === msg.id ? "check" : "content_copy"}
                        </span>
                        {copied === msg.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="flex items-start gap-3 animate-fade-up">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "var(--primary)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#fff" }}>auto_awesome</span>
                  </div>
                  <div
                    className="px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface-lowest)", border: "1px solid var(--outline-variant)" }}
                  >
                    <div className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "var(--outline)", animation: `blink 1.2s ${i * 0.2}s ease-in-out infinite` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        )}

        {/* ── Floating input (chat mode) ─────────────────────────── */}
        {!isEmptyState && (
          <div
            className="absolute bottom-0 left-0 w-full z-30 px-4 md:px-6 pb-5 pt-10"
            style={{ background: "linear-gradient(to top, var(--bg) 65%, transparent)" }}
          >
            <div className="max-w-2xl mx-auto w-full">
              <div
                className="relative flex flex-col rounded-xl"
                style={{
                  background: "var(--surface-lowest)",
                  border: "1px solid var(--outline-variant)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
                }}
              >
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Exfira…"
                  className="w-full bg-transparent text-[14px] resize-none outline-none border-none py-4 px-5 min-h-[52px] max-h-[200px]"
                  style={{ color: "var(--on-surface)", fontFamily: "var(--font-body)" }}
                />
                <div className="flex items-center justify-end px-3 pb-3">
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:opacity-80"
                    style={{ background: "var(--primary)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fff" }}>arrow_upward</span>
                  </button>
                </div>
              </div>
              <p
                className="text-center mt-2 text-[10px] uppercase tracking-widest font-bold"
                style={{ color: "var(--outline-variant)", fontFamily: "var(--font-body)" }}
              >
                Exfira redacts PII before any data leaves this device
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ── Inspector panel ─────────────────────────────────────── */}
      {inspectedMsg && (
        <InspectorPanel msg={inspectedMsg} onClose={() => setInspectedMsg(null)} />
      )}
    </div>
  );
}
