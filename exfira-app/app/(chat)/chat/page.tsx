import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import ChatClient from "./ChatClient";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false })
    .limit(60);

  return (
    <ChatClient
      initialConversations={conversations ?? []}
      user={{
        id: session.user.id,
        name: session.user.name ?? undefined,
        email: session.user.email ?? undefined,
      }}
    />
  );
}
