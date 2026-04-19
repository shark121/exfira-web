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
    if (!res.ok) setError(data.error ?? "Something went wrong.");
    else setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <div className="text-center animate-fade-up">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--surface-high)", border: "1px solid var(--outline-variant)" }}
          >
            <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: "22px" }}>check</span>
          </div>
          <h2 className="text-[22px] font-bold mb-1" style={{ fontFamily: "var(--font-headline)", color: "var(--primary)" }}>
            Account created
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--secondary)" }}>
            Check {form.email} to verify your account.
          </p>
          <Link href="/login" className="text-sm font-semibold hover:underline" style={{ color: "var(--primary)" }}>
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Inter:wght@400;500;600&display=swap" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />

      <div className="w-full max-w-[380px] animate-fade-up">
        <div className="mb-10">
          <h1 className="text-[28px] font-extrabold tracking-tight uppercase" style={{ fontFamily: "var(--font-headline)", color: "var(--primary)" }}>
            EXFIRA
          </h1>
          <p className="text-[10px] uppercase tracking-[0.15em] mt-1" style={{ color: "var(--secondary)" }}>
            Private AI Platform
          </p>
        </div>

        <h2 className="text-[22px] font-bold tracking-tight mb-1" style={{ fontFamily: "var(--font-headline)", color: "var(--primary)" }}>
          Create account
        </h2>
        <p className="text-sm mb-8" style={{ color: "var(--secondary)" }}>Private AI starts here</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--surface-lowest)", border: "1px solid var(--outline-variant)" }}
          >
            {[
              { field: "name", type: "text", placeholder: "Full name" },
              { field: "email", type: "email", placeholder: "Email" },
              { field: "password", type: "password", placeholder: "Password (min. 8 characters)" },
            ].map(({ field, type, placeholder }, i, arr) => (
              <input
                key={field}
                type={type}
                required
                minLength={field === "password" ? 8 : undefined}
                value={form[field as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                placeholder={placeholder}
                className="w-full bg-transparent px-5 py-4 text-sm outline-none"
                style={{
                  color: "var(--on-surface)",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--outline-variant)" : "none",
                }}
              />
            ))}
          </div>

          {error && (
            <p className="text-[13px] animate-fade-in" style={{ color: "var(--error)" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !form.name || !form.email || !form.password}
            className="w-full py-3.5 rounded-lg text-sm font-semibold uppercase tracking-widest transition-all disabled:opacity-40 hover:opacity-80"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            {loading ? "Creating account…" : "Continue"}
          </button>
        </form>

        <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--outline)" }}>
          By continuing you agree to our{" "}
          <a href="/terms" className="underline">Terms</a> and{" "}
          <a href="/privacy" className="underline">Privacy Policy</a>.
        </p>

        <p className="mt-5 text-[12px]" style={{ color: "var(--secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
