"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) setError("Incorrect email or password.");
    else router.push("/chat");
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
          Welcome back
        </h2>
        <p className="text-sm mb-8" style={{ color: "var(--secondary)" }}>Sign in to your workspace</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--surface-lowest)", border: "1px solid var(--outline-variant)" }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-transparent px-5 py-4 text-sm outline-none"
              style={{ color: "var(--on-surface)", borderBottom: "1px solid var(--outline-variant)" }}
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-transparent px-5 py-4 text-sm outline-none"
              style={{ color: "var(--on-surface)" }}
            />
          </div>

          {error && (
            <p className="text-[13px] animate-fade-in" style={{ color: "var(--error)" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3.5 rounded-lg text-sm font-semibold uppercase tracking-widest transition-all disabled:opacity-40 hover:opacity-80"
            style={{ background: "var(--primary)", color: "var(--on-primary)", fontFamily: "var(--font-body)" }}
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>

        <div className="flex items-center justify-between mt-5">
          <a href="#" className="text-[12px] hover:underline" style={{ color: "var(--secondary)" }}>
            Forgot password?
          </a>
          <p className="text-[12px]" style={{ color: "var(--secondary)" }}>
            No account?{" "}
            <Link href="/signup" className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
