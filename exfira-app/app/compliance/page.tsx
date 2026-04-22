import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import ComplianceClient from "./ComplianceClient";

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { data, count } = await supabase
    .from("compliance_events")
    .select(
      "id, conversation_id, user_id, user_email, client_ip, pii_detected, entity_types, risk_score, risk_label, llm_model, use_case, full_record, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(0, 49);

  return (
    <ComplianceClient
      initialEvents={data ?? []}
      initialTotal={count ?? 0}
    />
  );
}
