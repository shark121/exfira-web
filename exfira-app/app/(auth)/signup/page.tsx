"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <div className="text-center max-w-sm">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--red-dim)", border: "1px solid rgba(255,69,58,0.3)" }}
          >
            <span className="material-symbols-outlined" style={{ color: "var(--red)", fontSize: "22px" }}>
              check
            </span>
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text)" }}>
            Account created
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Check {form.email} for a verification link.
          </p>
          <Link
            href="/login"
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--red)" }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
      />
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        <div className="mb-8 flex flex-col items-center">
          <a href="/" className="flex items-center gap-2 mb-6">
            <span className="text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
              exfira
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{
                background: "var(--red-dim)",
                color: "var(--red)",
                border: "1px solid rgba(255,69,58,0.2)",
              }}
            >
              beta
            </span>
          </a>
          <h1 className="text-2xl font-semibold text-center" style={{ color: "var(--text)" }}>
            Create your account
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: "var(--text-muted)" }}>
            Private AI starts here
          </p>
        </div>

        <div
          className="rounded-xl p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Full name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Smith"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(255,69,58,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Work email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@company.com"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(255,69,58,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(255,69,58,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>

            {error && (
              <p
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  color: "var(--red)",
                  background: "var(--red-dim)",
                  border: "1px solid rgba(255,69,58,0.2)",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: "var(--red)", color: "#fff" }}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-xs text-center mt-4" style={{ color: "var(--text-muted)" }}>
            By signing up you agree to our{" "}
            <a href="/terms" className="underline">Terms</a> and{" "}
            <a href="/privacy" className="underline">Privacy Policy</a>.
          </p>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--text)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
