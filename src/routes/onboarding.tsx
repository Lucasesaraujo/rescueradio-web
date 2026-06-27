import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth, isProfileComplete } from "@/lib/auth";
import { api } from "@/lib/api";
import { profileFieldErrors } from "@/lib/profileValidation";
import { Loader2, Radar, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

interface Base {
  id: string;
  name?: string;
  city?: string;
  uf?: string;
}

function OnboardingPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [bases, setBases] = useState<Base[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    contato: "",
    email: "",
    competencias: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedBaseId = user?.base_id || profile?.base_id || "";
  const baseId = lockedBaseId || selectedBaseId;
  const selectedBase = bases.find((base) => base.id === baseId);

  useEffect(() => {
    api<Base[]>("/bases")
      .then((items) => {
        setBases(items);
        if (!lockedBaseId && items[0]?.id) setSelectedBaseId((current) => current || items[0].id);
      })
      .catch(() => setBases([]));
  }, [lockedBaseId]);

  useEffect(() => {
    if (profile) {
      setForm((current) => ({
        ...current,
        full_name: profile.full_name || profile.operational_name || "",
        contato: profile.contato || profile.contact || "",
        email: profile.email || "",
        competencias: (profile.competencias || profile.skills || []).join(", "),
      }));
    }
  }, [profile]);

  const identity = useMemo(() => deriveIdentity(form.full_name), [form.full_name]);
  const errors = useMemo(() => validate(form, baseId), [form, baseId]);
  const canSubmit = Object.keys(errors).length === 0;

  if (loading) return null;
  if (!user) return <Navigate to="/auth" />;
  if (isProfileComplete(profile)) return <Navigate to="/chat" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ full_name: true, base_id: true, contato: true, email: true });
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
          base_id: baseId,
          function: "",
          contact: form.contato.trim(),
          email: form.email.trim(),
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
              minLength={6}
              value={form.full_name}
              onBlur={() => setTouched((value) => ({ ...value, full_name: true }))}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={inputCls(!!(touched.full_name && errors.full_name))}
              placeholder="Marcos Castro"
            />
          </Field>

          <div className="rounded-md border border-primary/25 bg-primary/10 p-3 text-xs sm:col-span-2">
            <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Escopo recebido pelo convite
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Info label="Papel" value={user.role} />
              <Info label="UF" value={user.uf_scope || selectedBase?.uf || "-"} />
              <Info label="Nome de exibicao" value={identity.displayName || "-"} />
            </div>
          </div>

          <Field label="Base operacional" error={touched.base_id ? errors.base_id : ""} full>
            {lockedBaseId ? (
              <input
                readOnly
                value={selectedBase?.name || lockedBaseId}
                className={`${inputCls(false)} opacity-75`}
              />
            ) : (
              <select
                value={selectedBaseId}
                onBlur={() => setTouched((value) => ({ ...value, base_id: true }))}
                onChange={(e) => setSelectedBaseId(e.target.value)}
                className={inputCls(!!(touched.base_id && errors.base_id))}
              >
                <option value="">Selecione...</option>
                {bases.map((base) => (
                  <option key={base.id} value={base.id}>
                    {base.name || base.id} {base.uf ? `- ${base.uf}` : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Contato operacional" error={touched.contato ? errors.contato : ""}>
            <input
              required
              value={form.contato}
              onBlur={() => setTouched((value) => ({ ...value, contato: true }))}
              onChange={(e) => setForm({ ...form, contato: e.target.value })}
              className={inputCls(!!(touched.contato && errors.contato))}
              placeholder="(81) 99999-9999"
            />
          </Field>

          <Field label="E-mail" error={touched.email ? errors.email : ""}>
            <input
              type="email"
              value={form.email}
              onBlur={() => setTouched((value) => ({ ...value, email: true }))}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls(!!(touched.email && errors.email))}
              placeholder="operador@exemplo.com"
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
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive sm:col-span-2">
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

function validate(form: { full_name: string; contato: string; email?: string }, baseId: string) {
  const errors = profileFieldErrors(form);
  if (!baseId) errors.base_id = "Selecione uma base operacional.";
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
