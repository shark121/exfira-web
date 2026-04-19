import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, title, user_id")
    .eq("id", id)
    .single();

  if (!conv || conv.user_id !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, redacted_prompt, raw_llm_response, redactions, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ id: conv.id, title: conv.title, messages: messages ?? [] });
}
