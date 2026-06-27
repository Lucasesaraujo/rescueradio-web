import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/RoleGuard";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { profileToApiPayload } from "@/lib/rescueradio";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: () => (
    <AuthGuard>
      <Shell>
        <ProfilePage />
      </Shell>
    </AuthGuard>
  ),
});

interface Base {
  id: string;
  name?: string;
  nome?: string;
  uf?: string;
}

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [bases, setBases] = useState<Base[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    nome_operacional: "",
    base_id: "",
    contato: "",
    status: "disponivel" as "disponivel" | "em_operacao" | "ausente",
    competencias: "",
  });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api<Base[]>("/bases")
      .then(setBases)
      .catch(() => setBases([]));
  }, []);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || profile.nome_operacional || "",
        nome_operacional: profile.display_name || profile.nome_operacional || "",
        base_id: profile.base_id || user?.base_id || "",
        contato: profile.contato || "",
        status: (profile.status as any) || "disponivel",
        competencias: (profile.competencias || []).join(", "),
      });
    }
  }, [profile, user?.base_id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOk(false);
    try {
      await api("/profiles/me", {
        method: "PUT",
        json: profileToApiPayload(form),
      });
      await refreshProfile();
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="rounded-md border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Usuario</div>
          <div className="mt-1 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">{user?.display_name || user?.username}</div>
              <div className="text-xs text-muted-foreground">@{user?.username}</div>
            </div>
            <div className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold uppercase text-primary">
              {user?.role}
            </div>
          </div>
        </header>

        <form
          onSubmit={submit}
          className="grid grid-cols-1 gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-2"
        >
          <Field label="Nome completo" full>
            <input
              required
              value={form.full_name}
              onChange={(e) => {
                const fullName = e.target.value;
                setForm({
                  ...form,
                  full_name: fullName,
                  nome_operacional: deriveDisplayName(fullName),
                });
              }}
              className={inp}
            />
          </Field>
          <Field label="Nome de exibicao">
            <input value={form.nome_operacional} readOnly className={`${inp} opacity-75`} />
          </Field>
          <Field label="Base">
            <select
              value={form.base_id}
              onChange={(e) => setForm({ ...form, base_id: e.target.value })}
              disabled={user?.role === "operador"}
              className={inp}
            >
              <option value="">Selecione...</option>
              {bases.map((base) => (
                <option key={base.id} value={base.id}>
                  {base.name || base.nome || base.id} {base.uf ? `- ${base.uf}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contato">
            <input
              required
              value={form.contato}
              onChange={(e) => setForm({ ...form, contato: e.target.value })}
              className={inp}
            />
          </Field>
          <Field label="Competencias" full>
            <input
              value={form.competencias}
              onChange={(e) => setForm({ ...form, competencias: e.target.value })}
              className={inp}
            />
          </Field>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
            {ok && <span className="text-xs text-primary">Perfil atualizado.</span>}
          </div>
        </form>
      </div>
    </div>
  );
}

const inp =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function deriveDisplayName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : fullName.trim();
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
