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

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/chat");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
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
            Welcome back
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: "var(--text-muted)" }}>
            Sign in to your workspace
          </p>
        </div>

        <div
          className="rounded-xl p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Work email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
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
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                  Password
                </label>
                <a href="#" className="text-xs hover:underline" style={{ color: "var(--red)" }}>
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
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
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: "var(--text-muted)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium hover:underline" style={{ color: "var(--text)" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
