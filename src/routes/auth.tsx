import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, isProfileComplete } from "@/lib/auth";
import { Radar, Loader2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, profile, login, register, bootstrapAdmin, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "bootstrap">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [bootstrapKey, setBootstrapKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!loading && user) {
    if (!isProfileComplete(profile)) return <Navigate to="/onboarding" />;
    return <Navigate to="/chat" />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else if (mode === "bootstrap") {
        await bootstrapAdmin(username, password, displayName || username, bootstrapKey);
      } else {
        await register(username, password, username, inviteCode);
      }
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err?.message || "Falha na autenticacao");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-4">
      <div className="tactical-grid pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-sm rounded-lg border border-border bg-surface/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold">RescueRadio</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Cockpit de operacoes
            </div>
          </div>
        </div>

        <div className="mb-4 flex rounded-md border border-border bg-background p-1 text-xs">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded px-3 py-1.5 font-medium uppercase tracking-wide transition ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "login" ? "Entrar" : "Cadastrar"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Usuario">
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
            />
          </Field>
          {mode === "bootstrap" && (
            <Field label="Nome de exibicao">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}
          {mode === "register" && (
            <Field label="Codigo de convite">
              <input
                required
                autoComplete="one-time-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}
          {mode === "bootstrap" && (
            <Field label="Chave bootstrap admin">
              <input
                required
                type="password"
                autoComplete="off"
                value={bootstrapKey}
                onChange={(e) => setBootstrapKey(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}
          <Field label="Senha">
            <input
              required
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </Field>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login"
              ? "Acessar cockpit"
              : mode === "bootstrap"
                ? "Criar primeiro admin"
                : "Criar conta"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode(mode === "bootstrap" ? "login" : "bootstrap");
          }}
          className="mt-3 w-full text-center text-[11px] font-medium text-muted-foreground hover:text-primary"
        >
          {mode === "bootstrap" ? "Voltar para login" : "Configurar primeiro admin"}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
