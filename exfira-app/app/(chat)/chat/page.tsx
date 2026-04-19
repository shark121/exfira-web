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
  raw_llm_response?: string;
};

const ENTITY_COLORS: Record<string, string> = {
  PERSON:         "#b91c1c",
  EMAIL_ADDRESS:  "#b45309",
  PHONE_NUMBER:   "#15803d",
  CREDIT_CARD:    "#7e22ce",
  IP_ADDRESS:     "#0369a1",
  LOCATION:       "#a16207",
  URL:            "#1d4ed8",
  US_SSN:         "#b91c1c",
  ORGANIZATION:   "#9f1239",
  NRP:            "#6b21a8",
};
function entityColor(t: string) { return ENTITY_COLORS[t] ?? "#6E6E73"; }

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
            style={{
              borderRadius: 5,
              padding: "1px 5px",
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: 600,
              background: `${entityColor(map[seg].entity_type)}12`,
              color: entityColor(map[seg].entity_type),
              border: `1px solid ${entityColor(map[seg].entity_type)}28`,
            }}
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

function InspectorPanel({ msg, onClose, isMobile }: { msg: Message; onClose: () => void; isMobile: boolean }) {
  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: 0, right: 0, bottom: 0,
        height: "75vh",
        zIndex: 60,
        borderRadius: "20px 20px 0 0",
        borderTop: "0.5px solid rgba(0,0,0,0.1)",
        borderLeft: "none",
        display: "flex",
        flexDirection: "column",
        background: "rgba(248,248,248,0.97)",
        backdropFilter: "blur(24px) saturate(1.6)",
        WebkitBackdropFilter: "blur(24px) saturate(1.6)",
        animation: "slide-up-sheet 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
      }
    : {
        width: 288,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "rgba(248,248,248,0.92)",
        backdropFilter: "blur(24px) saturate(1.6)",
        WebkitBackdropFilter: "blur(24px) saturate(1.6)",
        borderLeft: "0.5px solid rgba(0,0,0,0.1)",
        animation: "fade-in 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
      };

  return (
    <>
      {isMobile && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 59, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }}
          onClick={onClose}
        />
      )}
      <aside style={panelStyle}>
        {/* Drag handle on mobile */}
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.15)" }} />
          </div>
        )}

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 18px", height: 52, flexShrink: 0,
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        }}>
          <span style={{
            fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
            color: "var(--secondary)", textTransform: "uppercase",
            fontFamily: "var(--font-body)",
          }}>
            Privacy Details
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 8, border: "none", background: "rgba(0,0,0,0.05)",
              cursor: "pointer", color: "var(--secondary)", transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.09)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--outline)", marginBottom: 7 }}>
              You typed
            </p>
            <div style={{
              fontSize: 13, lineHeight: 1.6, borderRadius: 11, padding: "10px 12px",
              background: "rgba(120,120,128,0.08)", color: "var(--on-surface)",
              border: "0.5px solid rgba(0,0,0,0.07)",
            }}>
              {msg.content}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--outline)", margin: 0 }}>
                Sent to LLM
              </p>
              {(msg.redactions?.length ?? 0) === 0 && (
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#15803d", background: "#15803d12", border: "0.5px solid #15803d28", borderRadius: 5, padding: "1px 6px" }}>
                  no pii — sent as-is
                </span>
              )}
            </div>
            <div style={{
              fontSize: 13, lineHeight: 1.6, borderRadius: 11, padding: "10px 12px",
              background: "rgba(120,120,128,0.08)", color: "var(--on-surface)",
              border: "0.5px solid rgba(0,0,0,0.07)", whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {msg.redacted_prompt
                ? <HighlightedText text={msg.redacted_prompt} redactions={msg.redactions ?? []} />
                : <span style={{ color: "var(--outline)" }}>{msg.content}</span>}
            </div>
          </div>

          {(msg.redactions?.length ?? 0) > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--outline)", marginBottom: 7 }}>
                Redacted ({msg.redactions!.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {msg.redactions!.map((r, i) => {
                  const color = entityColor(r.entity_type);
                  return (
                    <div key={i} style={{
                      borderRadius: 11, padding: "9px 11px",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                      background: "rgba(120,120,128,0.07)", border: `0.5px solid ${color}22`,
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color }}>
                          {r.entity_type.replace(/_/g, " ")}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.original}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10, fontFamily: "monospace", flexShrink: 0,
                        borderRadius: 6, padding: "2px 7px", fontWeight: 600,
                        background: `${color}10`, color, border: `0.5px solid ${color}22`,
                      }}>
                        {r.token}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--outline)", margin: 0 }}>
                LLM replied (raw)
              </p>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#0369a1", background: "#0369a112", border: "0.5px solid #0369a128", borderRadius: 5, padding: "1px 6px" }}>
                before de-anonymisation
              </span>
            </div>
            <div style={{
              fontSize: 13, lineHeight: 1.6, borderRadius: 11, padding: "10px 12px",
              background: "rgba(120,120,128,0.08)", color: "var(--on-surface)",
              border: "0.5px solid rgba(0,0,0,0.07)", whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {msg.raw_llm_response
                ? <HighlightedText text={msg.raw_llm_response} redactions={msg.redactions ?? []} />
                : <span style={{ color: "var(--outline)" }}>Waiting for response…</span>}
            </div>
          </div>

          <p style={{ fontSize: 11, lineHeight: 1.6, color: "var(--outline)" }}>
            Tokens in the LLM reply are swapped back to real values before being shown to you.
          </p>
        </div>
      </aside>
    </>
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
  const [isMobile, setIsMobile] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isEmptyState = messages.length === 0;

  // Track mobile breakpoint
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    // Close inspector and sidebar on mobile when sending
    if (isMobile) { setInspectedMsg(null); setSidebarOpen(false); }

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
            ? { ...m, redactions: data.redactions ?? [], redacted_prompt: data.redacted_prompt ?? m.content, raw_llm_response: data.raw_llm_response ?? "" }
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

  // Sidebar widths
  const sidebarWidth = sidebarOpen ? 220 : 52;

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--bg)" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />

      {/* ── Mobile sidebar backdrop ───────────────────────── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 40,
            background: "rgba(0,0,0,0.28)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside
        style={{
          position: isMobile ? "fixed" : "relative",
          left: 0, top: 0,
          zIndex: isMobile ? 50 : "auto",
          width: isMobile ? 260 : sidebarWidth,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflow: "hidden",
          background: "rgba(246,246,246,0.96)",
          backdropFilter: "blur(20px) saturate(1.6)",
          WebkitBackdropFilter: "blur(20px) saturate(1.6)",
          borderRight: "0.5px solid rgba(0,0,0,0.1)",
          transition: isMobile
            ? "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
            : "width 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          transform: isMobile
            ? sidebarOpen ? "translateX(0)" : "translateX(-100%)"
            : "none",
        }}
      >
        {/* Sidebar header */}
        <div style={{
          display: "flex", alignItems: "center", height: 56, padding: "0 10px",
          flexShrink: 0, gap: 8,
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        }}>
          {(sidebarOpen || isMobile) && (
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
              <div style={{
                fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em",
                color: "var(--on-surface)", fontFamily: "var(--font-headline)", lineHeight: 1,
              }}>
                Exfira
              </div>
              <div style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--secondary)", marginTop: 2 }}>
                Private AI
              </div>
            </div>
          )}
          {!sidebarOpen && !isMobile && <div style={{ flex: 1 }} />}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? "Collapse" : "Expand"}
            style={{
              width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 8, border: "none", background: "transparent",
              cursor: "pointer", color: "var(--outline)", flexShrink: 0,
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
              {sidebarOpen || isMobile ? "left_panel_close" : "left_panel_open"}
            </span>
          </button>
        </div>

        {/* New Chat */}
        <div style={{ padding: "10px 10px 6px" }}>
          <button
            onClick={() => { setMessages([]); setInspectedMsg(null); if (isMobile) setSidebarOpen(false); }}
            title="New Chat"
            style={{
              width: "100%", display: "flex", alignItems: "center", borderRadius: 9, border: "none",
              fontWeight: 600, fontSize: 12, letterSpacing: "-0.01em",
              cursor: "pointer", transition: "all 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              background: "linear-gradient(180deg, #2e2e30 0%, #1D1D1F 100%)",
              color: "#ffffff", fontFamily: "var(--font-body)",
              justifyContent: (sidebarOpen || isMobile) ? "space-between" : "center",
              padding: (sidebarOpen || isMobile) ? "9px 12px" : "9px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.82"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {(sidebarOpen || isMobile) && <span>New Chat</span>}
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "4px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {!isEmptyState && (
            <button
              title="Current Chat"
              onClick={() => { if (isMobile) setSidebarOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                borderRadius: 8, border: "none",
                fontSize: 13, fontWeight: 500, letterSpacing: "-0.01em",
                cursor: "pointer", transition: "background 0.15s ease",
                background: "rgba(255,255,255,0.75)", color: "var(--on-surface)",
                padding: (sidebarOpen || isMobile) ? "8px 10px" : "8px",
                justifyContent: (sidebarOpen || isMobile) ? "flex-start" : "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17, flexShrink: 0, fontVariationSettings: "'FILL' 1", color: "var(--apple-blue)" }}>
                chat_bubble
              </span>
              {(sidebarOpen || isMobile) && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Current Chat</span>}
            </button>
          )}
        </nav>

        {/* Footer */}
        <div style={{
          padding: "10px 10px 12px", flexShrink: 0,
          borderTop: "0.5px solid rgba(0,0,0,0.08)",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {totalRedacted > 0 && (
            <div
              title={`${totalRedacted} items protected`}
              style={{
                display: "flex", alignItems: "center",
                borderRadius: 8, overflow: "hidden",
                background: "rgba(52,199,89,0.1)", border: "0.5px solid rgba(52,199,89,0.25)",
                padding: (sidebarOpen || isMobile) ? "6px 10px" : "6px",
                justifyContent: (sidebarOpen || isMobile) ? "flex-start" : "center",
                gap: (sidebarOpen || isMobile) ? 7 : 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--apple-green)", flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>shield</span>
              {(sidebarOpen || isMobile) && (
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--apple-green)", letterSpacing: "-0.01em" }}>
                  {totalRedacted} protected
                </span>
              )}
            </div>
          )}

          <div
            title="Administrator"
            style={{
              display: "flex", alignItems: "center", borderRadius: 8, cursor: "pointer",
              padding: (sidebarOpen || isMobile) ? "6px 8px" : "6px",
              justifyContent: (sidebarOpen || isMobile) ? "flex-start" : "center",
              gap: (sidebarOpen || isMobile) ? 9 : 0,
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, background: "rgba(0,0,0,0.08)", color: "var(--on-surface)",
            }}>
              A
            </div>
            {(sidebarOpen || isMobile) && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--on-surface)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>Administrator</p>
                <p style={{ fontSize: 10, color: "var(--secondary)", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>admin@exfira.io</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden", background: "var(--bg)", minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          display: "flex", alignItems: "center",
          padding: "0 16px", height: 56, flexShrink: 0,
          position: "sticky", top: 0, zIndex: 20,
          background: "rgba(245,245,247,0.82)",
          backdropFilter: "blur(20px) saturate(1.8)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8)",
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        }}>
          {/* Mobile: hamburger on left */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                width: 34, height: 34, borderRadius: 9, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", cursor: "pointer", color: "var(--on-surface)",
                marginRight: 8, transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>menu</span>
            </button>
          )}

          {/* Mobile: centered wordmark */}
          {isMobile && (
            <div style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--on-surface)", fontFamily: "var(--font-headline)" }}>
                Exfira
              </span>
            </div>
          )}

          {!isMobile && <div style={{ flex: 1 }} />}

          {/* User avatar */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              title="Account"
              style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                background: "rgba(0,0,0,0.07)", color: "var(--on-surface)",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.07)")}
            >
              A
            </button>

            {userMenuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setUserMenuOpen(false)} />
                <div
                  className="animate-fade-up"
                  style={{
                    position: "absolute", right: 0, top: 40, zIndex: 40, width: 220,
                    borderRadius: 14, paddingTop: 4, paddingBottom: 4,
                    background: "rgba(255,255,255,0.88)",
                    backdropFilter: "blur(30px) saturate(1.8)",
                    WebkitBackdropFilter: "blur(30px) saturate(1.8)",
                    border: "0.5px solid rgba(0,0,0,0.1)",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.04), 0 16px 40px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--on-surface)", margin: 0, letterSpacing: "-0.02em" }}>Administrator</p>
                    <p style={{ fontSize: 11, color: "var(--secondary)", margin: "2px 0 0" }}>admin@exfira.io</p>
                  </div>
                  <a
                    href="/login"
                    style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "9px 14px", fontSize: 13, letterSpacing: "-0.01em",
                      color: "var(--error)", textDecoration: "none",
                      transition: "background 0.15s ease", borderRadius: "0 0 14px 14px",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,59,48,0.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>logout</span>
                    Sign out
                  </a>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Ambient gradient */}
        <div style={{
          position: "absolute", width: "60vw", height: "50vh",
          background: "radial-gradient(ellipse at center, rgba(0,122,255,0.025) 0%, transparent 70%)",
          top: "40%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 0, pointerEvents: "none",
        }} />

        {isEmptyState ? (
          /* ── Empty / home state ── */
          <div style={{ flex: 1, position: "relative", zIndex: 10, display: "flex", flexDirection: "column" }}>
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "flex-end",
              paddingBottom: 28, padding: "0 16px 28px",
            }}>
              <div style={{ width: "100%", maxWidth: 620, textAlign: "center", marginBottom: 24 }}>
                <h2 style={{
                  fontSize: "clamp(26px, 6vw, 40px)",
                  lineHeight: 1.1, fontWeight: 700,
                  letterSpacing: "-0.04em", marginBottom: 10,
                  color: "var(--on-surface)", fontFamily: "var(--font-headline)",
                }}>
                  Hello, where do<br />we start today?
                </h2>
                <p style={{ fontSize: "clamp(13px, 2.5vw, 15px)", color: "var(--secondary)", lineHeight: 1.5, letterSpacing: "-0.01em" }}>
                  Your data is redacted before it reaches any model.
                </p>
              </div>

              <div style={{ width: "100%", maxWidth: 620, position: "relative" }}>
                <div style={{
                  background: "rgba(255,255,255,0.82)",
                  backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                  border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 18,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.07)",
                  overflow: "hidden",
                }}>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Exfira anything…"
                    style={{
                      width: "100%", resize: "none", outline: "none",
                      background: "transparent", border: "none",
                      fontSize: 15, lineHeight: 1.55, letterSpacing: "-0.01em",
                      color: "var(--on-surface)", fontFamily: "var(--font-body)",
                      padding: "16px 52px 16px 18px",
                    }}
                  />
                  <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || loading}
                      style={{
                        width: 34, height: 34, borderRadius: 10, border: "none",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "linear-gradient(180deg, #2e2e30 0%, #1D1D1F 100%)",
                        cursor: "pointer",
                        transition: "all 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                        opacity: !input.trim() || loading ? 0.28 : 1,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 17, color: "#fff" }}>arrow_upward</span>
                    </button>
                  </div>
                </div>
              </div>

              <p style={{
                fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
                fontWeight: 500, marginTop: 12,
                color: "rgba(0,0,0,0.22)", fontFamily: "var(--font-body)",
                textAlign: "center",
              }}>
                Exfira redacts PII before any data leaves this device
              </p>
            </div>
          </div>
        ) : (
          /* ── Chat state ── */
          <div style={{ flex: 1, overflowY: "auto", paddingBottom: 140, paddingTop: 20, position: "relative", zIndex: 10 }}>
            <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 24 }}>
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="animate-fade-up" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <div style={{
                      padding: "11px 16px",
                      borderRadius: 18, borderTopRightRadius: 5,
                      maxWidth: "85%",
                      fontSize: 14, lineHeight: 1.6, letterSpacing: "-0.01em",
                      background: "#F2F2F7", color: "var(--on-surface)",
                      border: inspectedMsg?.id === msg.id ? "1px solid rgba(52,199,89,0.3)" : "1px solid transparent",
                      wordBreak: "break-word",
                    }}>
                      {msg.content}
                    </div>
                    <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8, paddingRight: 4 }}>
                      {msg.redactions !== undefined ? (
                        msg.redactions.length > 0 ? (
                          <button
                            onClick={() => handleInspect(msg)}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              fontSize: 11, fontWeight: 500, border: "none",
                              background: "transparent", cursor: "pointer",
                              color: inspectedMsg?.id === msg.id ? "var(--apple-green)" : "var(--outline)",
                              letterSpacing: "-0.01em", transition: "color 0.15s ease", padding: 0,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>shield</span>
                            {msg.redactions.length} item{msg.redactions.length !== 1 ? "s" : ""} protected — inspect
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--surface-high)", letterSpacing: "-0.01em" }}>No PII detected</span>
                        )
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="animate-fade-up" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "linear-gradient(145deg, #2e2e30, #1D1D1F)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#fff", fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--on-surface)", margin: "0 0 7px", letterSpacing: "-0.01em", wordBreak: "break-word" }}>
                        {msg.content}
                      </p>
                      <button
                        title="Copy"
                        onClick={() => copyMessage(msg.id, msg.content)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          fontSize: 11, fontWeight: 500, letterSpacing: "-0.01em",
                          color: "var(--outline)", border: "none", background: "transparent",
                          cursor: "pointer", padding: 0, transition: "color 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--on-surface)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--outline)")}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                          {copied === msg.id ? "check" : "content_copy"}
                        </span>
                        {copied === msg.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="animate-fade-up" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "linear-gradient(145deg, #2e2e30, #1D1D1F)",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#fff", fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </div>
                  <div style={{
                    padding: "11px 14px", borderRadius: 14, marginTop: 2,
                    background: "rgba(255,255,255,0.8)", border: "0.5px solid rgba(0,0,0,0.08)",
                  }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center", height: 14 }}>
                      {[0, 1, 2].map((i) => (
                        <span key={i} style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: "var(--apple-blue)", display: "block",
                          animation: `blink 1.1s ${i * 0.18}s ease-in-out infinite`,
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        )}

        {/* ── Floating input (chat mode) ─────────────────── */}
        {!isEmptyState && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, width: "100%",
            zIndex: 30, padding: "0 16px 20px",
            background: "linear-gradient(to top, var(--bg) 60%, transparent)",
          }}>
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
              <div style={{
                position: "relative", display: "flex", flexDirection: "column",
                background: "rgba(255,255,255,0.82)",
                backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 18,
                boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.07)",
              }}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Exfira…"
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    fontSize: 15, resize: "none", outline: "none",
                    padding: "14px 52px 14px 18px",
                    minHeight: 50, maxHeight: 200,
                    color: "var(--on-surface)", fontFamily: "var(--font-body)",
                    letterSpacing: "-0.01em", lineHeight: 1.55,
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 10px 10px" }}>
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    style={{
                      width: 34, height: 34, borderRadius: 10, border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "linear-gradient(180deg, #2e2e30 0%, #1D1D1F 100%)",
                      cursor: "pointer",
                      transition: "all 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                      opacity: !input.trim() || loading ? 0.28 : 1,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                    onMouseEnter={(e) => { if (input.trim() && !loading) e.currentTarget.style.transform = "scale(1.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 17, color: "#fff" }}>arrow_upward</span>
                  </button>
                </div>
              </div>
              <p style={{
                textAlign: "center", marginTop: 7,
                fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
                fontWeight: 500, color: "rgba(0,0,0,0.22)", fontFamily: "var(--font-body)",
              }}>
                Exfira redacts PII before any data leaves this device
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ── Inspector panel ───────────────────────────────── */}
      {inspectedMsg && (
        <InspectorPanel
          msg={inspectedMsg}
          onClose={() => setInspectedMsg(null)}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
