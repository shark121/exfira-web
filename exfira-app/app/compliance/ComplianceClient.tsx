"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type EntityTypes = Record<string, number>;

type ComplianceEvent = {
  id: string;
  conversation_id: string | null;
  user_id: string;
  user_email: string;
  client_ip: string;
  pii_detected: boolean;
  entity_types: EntityTypes;
  risk_score: number;
  risk_label: "Low" | "Medium" | "High" | "Critical";
  llm_model: string;
  use_case: string;
  full_record: Record<string, unknown>;
  created_at: string;
};

const RISK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Low:      { bg: "#f0fdf4", border: "#86efac", text: "#15803d" },
  Medium:   { bg: "#fffbeb", border: "#fcd34d", text: "#b45309" },
  High:     { bg: "#fff7ed", border: "#fdba74", text: "#c2410c" },
  Critical: { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c" },
};

const ENTITY_COLORS: Record<string, string> = {
  PERSON: "#b91c1c", EMAIL_ADDRESS: "#b45309", PHONE_NUMBER: "#15803d",
  CREDIT_CARD: "#7e22ce", IP_ADDRESS: "#0369a1", LOCATION: "#a16207",
  URL: "#1d4ed8", US_SSN: "#b91c1c", ORGANIZATION: "#9f1239",
  DATE_OF_BIRTH: "#c2410c",
};
function entityColor(t: string) { return ENTITY_COLORS[t] ?? "#6E6E73"; }

function RiskBadge({ label }: { label: string }) {
  const c = RISK_COLORS[label] ?? RISK_COLORS.Low;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "2px 7px", borderRadius: 5,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>
      {label}
    </span>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ComplianceClient({
  initialEvents,
  initialTotal,
}: {
  initialEvents: ComplianceEvent[];
  initialTotal: number;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<ComplianceEvent[]>(initialEvents);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState("");
  const [filterPii, setFilterPii] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async (opts?: { page?: number; risk?: string; pii?: string; search?: string }) => {
    const p = opts?.page ?? page;
    const r = opts?.risk ?? filterRisk;
    const pi = opts?.pii ?? filterPii;
    const s = opts?.search ?? search;

    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (r) params.set("risk", r);
      if (pi) params.set("pii", pi);
      if (s) params.set("search", s);
      const res = await fetch(`/api/compliance?${params}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.text();
        setFetchError(`Server error ${res.status}: ${body}`);
        return;
      }
      const data = await res.json();
      setEvents(data.events);
      setTotal(data.total);
    } catch (e) {
      setFetchError(String(e));
    } finally {
      setLoading(false);
    }
  }, [page, filterRisk, filterPii, search]);

  function applySearch() {
    setPage(1);
    setSearch(searchInput);
    load({ page: 1, search: searchInput });
  }

  function changeRisk(val: string) {
    setPage(1);
    setFilterRisk(val);
    load({ page: 1, risk: val });
  }

  function changePii(val: string) {
    setPage(1);
    setFilterPii(val);
    load({ page: 1, pii: val });
  }

  function changePage(p: number) {
    setPage(p);
    load({ page: p });
  }

  function resetFilters() {
    setFilterRisk(""); setFilterPii(""); setSearch(""); setSearchInput(""); setPage(1);
    load({ page: 1, risk: "", pii: "", search: "" });
  }

  const totalPages = Math.ceil(total / 50);
  const piiCount = events.filter(e => e.pii_detected).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f5f5f7)", fontFamily: "var(--font-body, Inter, sans-serif)" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />

      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 24px", height: 56,
        background: "rgba(245,245,247,0.88)",
        backdropFilter: "blur(20px) saturate(1.8)",
        WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        borderBottom: "0.5px solid rgba(0,0,0,0.08)",
      }}>
        <button
          onClick={() => router.push("/chat")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            border: "none", background: "transparent", cursor: "pointer",
            fontSize: 13, color: "var(--secondary, #6E6E73)", padding: "4px 8px",
            borderRadius: 7, transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          Chat
        </button>

        <div style={{ width: "0.5px", height: 18, background: "rgba(0,0,0,0.12)" }} />

        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#0369a1", fontVariationSettings: "'FILL' 1" }}>
          policy
        </span>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--on-surface, #1d1d1f)", fontFamily: "var(--font-headline, Manrope, sans-serif)" }}>
            Compliance Logs
          </span>
          <span style={{ fontSize: 11, color: "var(--secondary, #6E6E73)", marginLeft: 8 }}>
            {total} event{total !== 1 ? "s" : ""}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => load()}
          title="Refresh"
          style={{
            width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--secondary, #6E6E73)", transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.06)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17, ...(loading ? { animation: "spin 1s linear infinite" } : {}) }}>refresh</span>
        </button>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>

        {fetchError && (
          <div style={{
            marginBottom: 16, padding: "12px 16px", borderRadius: 10,
            background: "#fef2f2", border: "0.5px solid #fca5a5",
            color: "#b91c1c", fontSize: 13, fontFamily: "monospace",
          }}>
            {fetchError}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total Events", value: total, icon: "receipt_long", color: "#0369a1" },
            { label: "PII Detected", value: events.length ? piiCount : "—", icon: "shield_person", color: "#b91c1c" },
            { label: "High / Critical", value: events.filter(e => e.risk_label === "High" || e.risk_label === "Critical").length, icon: "warning", color: "#c2410c" },
            { label: "Avg Risk Score", value: events.length ? (events.reduce((s, e) => s + e.risk_score, 0) / events.length).toFixed(2) : "—", icon: "analytics", color: "#15803d" },
          ].map(s => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,0.8)", borderRadius: 14,
              border: "0.5px solid rgba(0,0,0,0.08)", padding: "14px 16px",
              backdropFilter: "blur(16px)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: s.color, fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--outline, #8e8e93)" }}>{s.label}</span>
              </div>
              <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--on-surface, #1d1d1f)", margin: 0, fontFamily: "var(--font-headline, Manrope, sans-serif)" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div style={{
          display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
          background: "rgba(255,255,255,0.8)", borderRadius: 12,
          border: "0.5px solid rgba(0,0,0,0.08)", padding: "12px 14px",
          marginBottom: 16, backdropFilter: "blur(16px)",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--outline, #8e8e93)" }}>filter_list</span>

          <select
            value={filterRisk}
            onChange={e => changeRisk(e.target.value)}
            style={{ fontSize: 12, borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)", padding: "5px 10px", background: "transparent", cursor: "pointer", color: "var(--on-surface, #1d1d1f)" }}
          >
            <option value="">All risk levels</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>

          <select
            value={filterPii}
            onChange={e => changePii(e.target.value)}
            style={{ fontSize: 12, borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)", padding: "5px 10px", background: "transparent", cursor: "pointer", color: "var(--on-surface, #1d1d1f)" }}
          >
            <option value="">PII: all</option>
            <option value="true">PII detected</option>
            <option value="false">No PII</option>
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 180 }}>
            <input
              type="text"
              placeholder="Search by email…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applySearch()}
              style={{
                flex: 1, fontSize: 12, borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)",
                padding: "5px 10px", background: "transparent", outline: "none", color: "var(--on-surface, #1d1d1f)",
              }}
            />
            <button onClick={applySearch} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)", background: "rgba(0,0,0,0.04)", cursor: "pointer", color: "var(--on-surface, #1d1d1f)" }}>Search</button>
          </div>

          {(filterRisk || filterPii || search) && (
            <button onClick={resetFilters} style={{ fontSize: 12, color: "#b91c1c", border: "none", background: "transparent", cursor: "pointer", padding: "4px 6px", borderRadius: 6 }}>
              Clear
            </button>
          )}
        </div>

        {loading && events.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--outline, #8e8e93)", fontSize: 13 }}>Loading…</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--outline, #8e8e93)", fontSize: 13 }}>
            No events found.{" "}
            {!filterRisk && !filterPii && !search && (
              <span style={{ display: "block", marginTop: 6, fontSize: 11 }}>
                Events are created when the chat service processes a message. Check that the Python service is running.
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {events.map(ev => {
              const isOpen = expandedId === ev.id;
              const ts = new Date(ev.created_at);
              const entities = Object.entries(ev.entity_types ?? {});

              return (
                <div
                  key={ev.id}
                  style={{
                    background: "rgba(255,255,255,0.85)", borderRadius: 14,
                    border: `0.5px solid ${isOpen ? "rgba(3,105,161,0.25)" : "rgba(0,0,0,0.08)"}`,
                    backdropFilter: "blur(16px)", overflow: "hidden",
                    transition: "border-color 0.15s",
                  }}
                >
                  <button
                    onClick={() => setExpandedId(isOpen ? null : ev.id)}
                    style={{
                      width: "100%", display: "grid", textAlign: "left",
                      gridTemplateColumns: "1fr auto auto auto auto",
                      alignItems: "center", gap: 16,
                      padding: "13px 16px", border: "none", background: "transparent",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--on-surface, #1d1d1f)", letterSpacing: "-0.01em" }}>
                          {ev.user_email || ev.user_id}
                        </span>
                        {ev.use_case && ev.use_case !== "General" && (
                          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--outline, #8e8e93)", background: "rgba(0,0,0,0.05)", borderRadius: 5, padding: "1px 5px" }}>
                            {ev.use_case}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--outline, #8e8e93)" }}>
                          {ts.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--outline, #8e8e93)" }}>·</span>
                        <span style={{ fontSize: 11, color: "var(--outline, #8e8e93)" }}>{relativeTime(ev.created_at)}</span>
                        {ev.client_ip && ev.client_ip !== "unknown" && (
                          <>
                            <span style={{ fontSize: 11, color: "var(--outline, #8e8e93)" }}>·</span>
                            <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--outline, #8e8e93)" }}>{ev.client_ip}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {entities.slice(0, 4).map(([et, cnt]) => (
                        <span key={et} style={{
                          fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 5,
                          background: `${entityColor(et)}10`, color: entityColor(et), border: `0.5px solid ${entityColor(et)}30`,
                        }}>
                          {et.replace(/_/g, " ")} ×{cnt}
                        </span>
                      ))}
                      {entities.length > 4 && (
                        <span style={{ fontSize: 10, color: "var(--outline, #8e8e93)", padding: "1px 4px" }}>+{entities.length - 4}</span>
                      )}
                      {entities.length === 0 && (
                        <span style={{ fontSize: 11, color: "var(--outline, #8e8e93)" }}>No PII</span>
                      )}
                    </div>

                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                      padding: "2px 7px", borderRadius: 5,
                      background: ev.pii_detected ? "#fef2f2" : "#f0fdf4",
                      border: ev.pii_detected ? "1px solid #fca5a5" : "1px solid #86efac",
                      color: ev.pii_detected ? "#b91c1c" : "#15803d",
                      whiteSpace: "nowrap",
                    }}>
                      {ev.pii_detected ? "PII" : "Clean"}
                    </span>

                    <RiskBadge label={ev.risk_label} />

                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--outline, #8e8e93)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }}>
                      expand_more
                    </span>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: "0.5px solid rgba(0,0,0,0.07)", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                        {[
                          { label: "Event ID", value: ev.id.slice(0, 8) + "…" },
                          { label: "User ID", value: ev.user_id },
                          { label: "Model", value: ev.llm_model },
                          { label: "Risk Score", value: `${ev.risk_score} (${ev.risk_label})` },
                          { label: "Client IP", value: ev.client_ip || "—" },
                          { label: "Conversation", value: ev.conversation_id ? ev.conversation_id.slice(0, 8) + "…" : "—" },
                        ].map(f => (
                          <div key={f.label} style={{ background: "rgba(120,120,128,0.06)", borderRadius: 9, padding: "8px 11px" }}>
                            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--outline, #8e8e93)", margin: "0 0 3px" }}>{f.label}</p>
                            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--on-surface, #1d1d1f)", margin: 0, fontFamily: "monospace", wordBreak: "break-all" }}>{f.value}</p>
                          </div>
                        ))}
                      </div>

                      {(ev.full_record?.redactions as { entity_type: string; original: string; token: string }[] | undefined)?.length ? (
                        <div>
                          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--outline, #8e8e93)", margin: "0 0 7px" }}>
                            Redactions ({(ev.full_record.redactions as unknown[]).length})
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {(ev.full_record.redactions as { entity_type: string; original: string; token: string }[]).map((r, i) => {
                              const col = entityColor(r.entity_type);
                              return (
                                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: `${col}08`, border: `0.5px solid ${col}20`, borderRadius: 8, padding: "6px 10px" }}>
                                  <div>
                                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: col }}>{r.entity_type.replace(/_/g, " ")}</span>
                                    <span style={{ fontSize: 12, color: "var(--on-surface, #1d1d1f)", marginLeft: 8 }}>{r.original}</span>
                                  </div>
                                  <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: col, background: `${col}12`, borderRadius: 5, padding: "1px 6px", border: `0.5px solid ${col}22`, whiteSpace: "nowrap" }}>
                                    {r.token}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <details style={{ cursor: "pointer" }}>
                        <summary style={{ fontSize: 11, fontWeight: 600, color: "var(--outline, #8e8e93)", letterSpacing: "-0.01em", listStyle: "none", display: "flex", alignItems: "center", gap: 5 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>data_object</span>
                          Raw record
                        </summary>
                        <pre style={{
                          marginTop: 8, fontSize: 11, lineHeight: 1.6,
                          background: "rgba(0,0,0,0.04)", borderRadius: 9, padding: "10px 12px",
                          overflowX: "auto", color: "var(--on-surface, #1d1d1f)",
                          border: "0.5px solid rgba(0,0,0,0.07)",
                        }}>
                          {JSON.stringify(ev.full_record, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 24 }}>
            <button
              onClick={() => changePage(Math.max(1, page - 1))}
              disabled={page === 1}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.15)", background: "rgba(255,255,255,0.8)", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1, color: "var(--on-surface, #1d1d1f)" }}
            >
              Previous
            </button>
            <span style={{ fontSize: 12, color: "var(--outline, #8e8e93)" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => changePage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.15)", background: "rgba(255,255,255,0.8)", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1, color: "var(--on-surface, #1d1d1f)" }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
