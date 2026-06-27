import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth, isProfileComplete } from "@/lib/auth";
import { api } from "@/lib/api";
import { Radar, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

interface Base {
  id: string;
  name?: string;
  city?: string;
}
interface OperatorFunction {
  id: string;
  label: string;
}

function OnboardingPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [bases, setBases] = useState<Base[]>([]);
  const [functions, setFunctions] = useState<OperatorFunction[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    funcao: "",
    contato: "",
    competencias: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedBaseId = user?.base_id || profile?.base_id || "";
  const selectedBase = bases.find((base) => base.id === lockedBaseId);

  useEffect(() => {
    api<Base[]>("/bases")
      .then(setBases)
      .catch(() => setBases([]));
    api<OperatorFunction[]>("/functions")
      .then(setFunctions)
      .catch(() => setFunctions([]));
  }, []);

  useEffect(() => {
    if (profile) {
      setForm((current) => ({
        ...current,
        full_name: profile.full_name || profile.operational_name || "",
        funcao: profile.funcao || profile.function || "",
        contato: profile.contato || profile.contact || "",
        competencias: (profile.competencias || profile.skills || []).join(", "),
      }));
    }
  }, [profile]);

  const identity = useMemo(() => deriveIdentity(form.full_name), [form.full_name]);
  const errors = useMemo(() => validate(form, lockedBaseId), [form, lockedBaseId]);
  const canSubmit = Object.keys(errors).length === 0;

  if (loading) return null;
  if (!user) return <Navigate to="/auth" />;
  if (isProfileComplete(profile)) return <Navigate to="/chat" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ full_name: true, base_id: true, funcao: true, contato: true });
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api("/profiles/me", {
        method: "PUT",
        json: {
          full_name: form.full_name.trim(),
          display_name: identity.displayName,
          callsign: identity.callsign,
          operational_name: identity.displayName,
          base_id: lockedBaseId,
          function: form.funcao,
          contact: form.contato.trim(),
          status: "disponivel",
          skills: parseSkills(form.competencias),
        },
      });
      await refreshProfile();
      navigate({ to: "/chat" });
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar perfil");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center bg-background p-4">
      <div className="tactical-grid pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-xl rounded-lg border border-border bg-surface/85 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold">Identificacao operacional</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Convite validado - complete seus dados
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome completo" error={touched.full_name ? errors.full_name : ""} full>
            <input
              required
              value={form.full_name}
              onBlur={() => setTouched((value) => ({ ...value, full_name: true }))}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={inputCls(!!(touched.full_name && errors.full_name))}
              placeholder="Marcos Castro da Silva"
            />
          </Field>

          <div className="sm:col-span-2 rounded-md border border-primary/25 bg-primary/10 p-3 text-xs">
            <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Dados travados pelo convite
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Info label="Base" value={selectedBase?.name || lockedBaseId || "Sem base"} />
              <Info label="Perfil" value={user.role} />
              <Info label="Nome de exibicao" value={identity.displayName || "-"} />
            </div>
          </div>

          <Field label="Funcao operacional" error={touched.funcao ? errors.funcao : ""}>
            <select
              required
              value={form.funcao}
              onBlur={() => setTouched((value) => ({ ...value, funcao: true }))}
              onChange={(e) => setForm({ ...form, funcao: e.target.value })}
              className={inputCls(!!(touched.funcao && errors.funcao))}
            >
              <option value="">Selecione...</option>
              {functions.map((fn) => (
                <option key={fn.id} value={fn.label}>
                  {fn.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Contato operacional" error={touched.contato ? errors.contato : ""}>
            <input
              required
              value={form.contato}
              onBlur={() => setTouched((value) => ({ ...value, contato: true }))}
              onChange={(e) => setForm({ ...form, contato: e.target.value })}
              className={inputCls(!!(touched.contato && errors.contato))}
              placeholder="Radio 02 / telefone"
            />
          </Field>

          <Field label="Competencias" full>
            <input
              value={form.competencias}
              onChange={(e) => setForm({ ...form, competencias: e.target.value })}
              className={inputCls(false)}
              placeholder="APH, resgate vertical, busca..."
            />
          </Field>

          {error && (
            <div className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy || !canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar e entrar na Central
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function validate(form: { full_name: string; funcao: string; contato: string }, baseId: string) {
  const errors: Record<string, string> = {};
  if (form.full_name.trim().split(/\s+/).length < 2) {
    errors.full_name = "Informe nome e sobrenome.";
  }
  if (!baseId) errors.base_id = "Convite sem base vinculada.";
  if (!form.funcao) errors.funcao = "Selecione sua funcao.";
  if (form.contato.trim().length < 3) errors.contato = "Informe radio, telefone ou contato.";
  return errors;
}

function deriveIdentity(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const displayName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : fullName.trim();
  const callsign = parts.map((part) => part[0]?.toLowerCase()).join("");
  return { displayName, callsign };
}

function parseSkills(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function inputCls(error: boolean) {
  return `w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ${
    error ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
  }`;
}

function Field({
  label,
  children,
  error,
  full,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-destructive">{error}</span>}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value || "-"}</div>
    </div>
  );
}
