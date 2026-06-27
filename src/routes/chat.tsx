import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/RoleGuard";
import { Shell } from "@/components/Shell";
import { ChatRoom } from "@/components/ChatRoom";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <AuthGuard>
      <Shell>
        <Inner />
      </Shell>
    </AuthGuard>
  );
}

function Inner() {
  const { profile } = useAuth();
  const baseId = profile?.base_id || "base-central";
  return (
    <ChatRoom
      channelId={`base:${baseId}:geral`}
      title={`Central de Comunicação - Base ${baseId}`}
      subtitle="Canal persistente da base - comunicacao tatica em tempo real"
      showChannelsPanel
    />
  );
}
