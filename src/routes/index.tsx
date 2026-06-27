import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth, isProfileComplete } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-background text-muted-foreground">
        <div className="inline-flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Inicializando cockpit...
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  if (!isProfileComplete(profile)) return <Navigate to="/onboarding" />;
  return <Navigate to="/chat" />;
}
