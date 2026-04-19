import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const userId = (session?.user as { id?: string })?.id ?? "anonymous";
    const userEmail = session?.user?.email ?? "";
    const conversationId: string | null = body.conversation_id ?? null;
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    // ── Forward to Python with identity context ─────────────────────────────
    const pythonRes = await fetch(`${PYTHON_SERVICE_URL}/redact-and-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": userId,
        "X-Session-ID": conversationId ?? `sess_${userId}_${Date.now()}`,
        "X-Role": "user",
        "X-Auth-Method": "NextAuth / Credentials",
        "X-Device": userAgent.slice(0, 200),
        "X-Use-Case": body.use_case ?? "General",
        "X-Forwarded-For": clientIp,
      },
      body: JSON.stringify({
        messages: body.messages,
        workspace_id: userId,
      }),
    });

    if (!pythonRes.ok) {
      const text = await pythonRes.text();
      return NextResponse.json({ error: `Python service error: ${text}` }, { status: 502 });
    }

    const data = await pythonRes.json();
    const userContent: string = body.messages[body.messages.length - 1].content;

    // ── Persist conversation ────────────────────────────────────────────────
    let activeConvId = conversationId;

    if (!activeConvId) {
      const title =
        userContent.length > 60
          ? userContent.slice(0, 57).trimEnd() + "…"
          : userContent;
      const { data: conv } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title })
        .select("id")
        .single();
      activeConvId = conv?.id ?? null;
    } else {
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeConvId);
    }

    // ── Persist messages ────────────────────────────────────────────────────
    if (activeConvId) {
      await supabase.from("messages").insert([
        {
          conversation_id: activeConvId,
          role: "user",
          content: userContent,
          redacted_prompt: data.redacted_prompt ?? null,
          raw_llm_response: null,
          redactions: data.redactions ?? [],
        },
        {
          conversation_id: activeConvId,
          role: "assistant",
          content: data.response,
          redacted_prompt: null,
          raw_llm_response: data.raw_llm_response ?? null,
          redactions: [],
        },
      ]);

      // ── Persist compliance event ──────────────────────────────────────────
      const entityTypes: Record<string, number> = {};
      for (const r of data.redactions ?? []) {
        entityTypes[r.entity_type] = (entityTypes[r.entity_type] ?? 0) + 1;
      }
      const piiDetected = (data.redactions?.length ?? 0) > 0;
      const riskScore = computeRisk(data.redactions ?? []);

      await supabase.from("compliance_events").insert({
        conversation_id: activeConvId,
        user_id: userId,
        user_email: userEmail,
        client_ip: clientIp,
        pii_detected: piiDetected,
        entity_types: entityTypes,
        risk_score: riskScore,
        risk_label: riskLabel(riskScore),
        llm_model: process.env.LLM_MODEL ?? "gpt-4o-mini",
        use_case: body.use_case ?? "General",
        full_record: {
          user_id: userId,
          conversation_id: activeConvId,
          redactions: data.redactions ?? [],
          redacted_prompt: data.redacted_prompt,
          pii_detected: piiDetected,
          entity_types: entityTypes,
        },
      });
    }

    return NextResponse.json({ ...data, conversation_id: activeConvId });
  } catch (err) {
    console.error("[/api/chat]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const HIGH_RISK = new Set([
  "US_SSN", "CREDIT_CARD", "IBAN_CODE", "US_BANK_NUMBER",
  "US_PASSPORT", "US_DRIVER_LICENSE", "UK_NHS", "MEDICAL_LICENSE",
]);
const MED_RISK = new Set([
  "PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "DATE_OF_BIRTH", "FINANCIAL_ACCOUNT",
]);

function computeRisk(redactions: { entity_type: string }[]): number {
  let score = 0.05;
  for (const r of redactions) {
    if (HIGH_RISK.has(r.entity_type)) score += 0.20;
    else if (MED_RISK.has(r.entity_type)) score += 0.07;
    else score += 0.02;
  }
  return Math.min(Math.round(score * 100) / 100, 1.0);
}

function riskLabel(score: number): string {
  if (score < 0.20) return "Low";
  if (score < 0.50) return "Medium";
  if (score < 0.75) return "High";
  return "Critical";
}
