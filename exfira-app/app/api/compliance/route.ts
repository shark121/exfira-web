import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 50;
  const offset = (page - 1) * limit;
  const risk = searchParams.get("risk");        // Low | Medium | High | Critical
  const pii = searchParams.get("pii");          // "true" | "false"
  const search = searchParams.get("search");    // user_email or use_case substring

  let query = supabase
    .from("compliance_events")
    .select("id, conversation_id, user_id, user_email, client_ip, pii_detected, entity_types, risk_score, risk_label, llm_model, use_case, full_record, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (risk) query = query.eq("risk_label", risk);
  if (pii === "true") query = query.eq("pii_detected", true);
  if (pii === "false") query = query.eq("pii_detected", false);
  if (search) query = query.ilike("user_email", `%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [], total: count ?? 0, page, limit });
}
