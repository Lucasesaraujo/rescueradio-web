import { Navigate } from "@tanstack/react-router";
import { useAuth, isProfileComplete, type Role } from "@/lib/auth";
import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando sessao...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  if (!isProfileComplete(profile)) return <Navigate to="/onboarding" />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <div className="text-lg font-semibold text-destructive">Acesso restrito</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Voce nao tem permissao para acessar esta area.
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
