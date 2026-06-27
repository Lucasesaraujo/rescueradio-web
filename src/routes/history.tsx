import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/RoleGuard";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { normalizeChatMessage, normalizeOccurrence, normalizeOperation } from "@/lib/rescueradio";
import { useAuth } from "@/lib/auth";
import { Archive, RefreshCw, Loader2, MapPin } from "lucide-react";

export const Route = createFileRoute("/history")({
  component: () => (
    <AuthGuard>
      <Shell>
        <HistoryPage />
      </Shell>
    </AuthGuard>
  ),
});

interface Base {
  id: string;
  name?: string;
  nome?: string;
}

function HistoryPage() {
  const { user, profile } = useAuth();
  const [ops, setOps] = useState<any[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [filters, setFilters] = useState({
    base_id: "",
    prioridade: "",
    operador: "",
    from: "",
    to: "",
  });
  const [selected, setSelected] = useState<any | null>(null);
  const [audit, setAudit] = useState<any | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<any[]>("/operations", {
        query: { status: "closed", base_id: filters.base_id },
      });
      setOps(Array.isArray(res) ? res.map(normalizeOperation) : []);
    } catch {
      setOps([]);
    }
  }, [filters.base_id]);

  useEffect(() => {
    api<Base[]>("/bases")
      .then(setBases)
      .catch(() => setBases([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setAudit(null);
      return;
    }
    setLoadingAudit(true);
    api(`/operations/${selected.id}/audit`)
      .then(setAudit)
      .catch(() => setAudit(null))
      .finally(() => setLoadingAudit(false));
  }, [selected]);

  const filtered = useMemo(() => {
    return ops.filter((o) => {
      if (user?.role === "operador") {
        const me = user.username;
        const display = profile?.operational_name || profile?.nome_operacional || user.display_name;
        const participated = (o.participantes || o.members || []).some((p: any) => {
          if (typeof p === "string") return p === me || p === display;
          return (
            p.username === me || p.display_name === display || p.display_name === user.display_name
          );
        });
        if (!participated && o.created_by !== me) return false;
      }
      if (filters.prioridade && o.prioridade !== filters.prioridade) return false;
      if (
        filters.operador &&
        !(o.participantes || []).some((p: any) =>
          (typeof p === "string" ? p : p.username || p.display_name || "").includes(
            filters.operador,
          ),
        )
      )
        return false;
      if (filters.from && new Date(o.created_at || 0) < new Date(filters.from)) return false;
      if (filters.to && new Date(o.created_at || 0) > new Date(filters.to)) return false;
      return true;
    });
  }, [ops, filters, profile, user]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-border bg-surface md:border-b-0 md:border-r">
        <div className="border-b border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Historico
            </div>
            <button
              onClick={load}
              className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.base_id}
              onChange={(e) => setFilters({ ...filters, base_id: e.target.value })}
              className={mini}
            >
              <option value="">Todas bases</option>
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.nome || b.id}
                </option>
              ))}
            </select>
            <select
              value={filters.prioridade}
              onChange={(e) => setFilters({ ...filters, prioridade: e.target.value })}
              className={mini}
            >
              <option value="">Prioridade</option>
              <option value="critico">Critico</option>
              <option value="alto">Alto</option>
              <option value="medio">Medio</option>
              <option value="normal">Normal</option>
            </select>
            <input
              placeholder="Operador"
              value={filters.operador}
              onChange={(e) => setFilters({ ...filters, operador: e.target.value })}
              className={mini}
            />
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className={mini}
            />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className={`${mini} col-span-2`}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">Nenhuma operacao finalizada.</div>
          )}
          <ul className="divide-y divide-border">
            {filtered.map((o) => {
              const sel = selected?.id === o.id;
              return (
                <li key={o.id}>
                  <button
                    onClick={() => setSelected(o)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2 ${sel ? "bg-surface-2" : ""}`}
                  >
                    <Archive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{o.titulo || o.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {o.closed_at
                          ? new Date(o.closed_at).toLocaleString()
                          : o.created_at
                            ? new Date(o.created_at).toLocaleString()
                            : "-"}
                      </div>
                      <div className="mt-1">
                        <StatusBadge status={o.prioridade || "normal"} />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <section className="min-h-0 overflow-auto">
        {!selected ? (
          <div className="grid h-full place-items-center p-8 text-sm text-muted-foreground">
            Selecione uma operacao para auditar.
          </div>
        ) : loadingAudit ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando auditoria...
          </div>
        ) : (
          <AuditView op={selected} audit={audit} />
        )}
      </section>
    </div>
  );
}

const mini =
  "rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary";

function AuditView({ op, audit }: { op: any; audit: any }) {
  const auditOperation = normalizeOperation(audit?.operation || op);
  const occ = normalizeOccurrence(
    audit?.occurrence || audit?.ocorrencia || auditOperation.occurrence || op.occurrence,
  );
  const outcome = operationOutcomeFormal(auditOperation);
  const participants =
    audit?.participants ||
    audit?.participantes ||
    auditOperation.members ||
    auditOperation.participantes ||
    [];
  const messages = (audit?.messages || audit?.mensagens || []).map((m: any) =>
    normalizeChatMessage(m, "briefing"),
  );
  const events = audit?.events || audit?.eventos || audit?.status_events || [];
  return (
    <div className="space-y-4 p-4">
      <header className="rounded-md border border-border bg-surface p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operacao</div>
        <div className="text-lg font-semibold">{auditOperation.titulo || auditOperation.title}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
          <Info label="ID" value={auditOperation.id} />
          <Info label="Prioridade" value={auditOperation.prioridade} />
          <Info label="Base" value={auditOperation.base_id} />
          <Info
            label="Fechada em"
            value={
              auditOperation.closed_at ? new Date(auditOperation.closed_at).toLocaleString() : "-"
            }
          />
        </div>
        {auditOperation.resumo && (
          <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
            {auditOperation.resumo}
          </div>
        )}
      </header>

      {occ && (
        <Section title="Ocorrencia">
          <div className="mb-3 overflow-hidden rounded-md border border-border bg-background">
            <div className="relative h-36 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--color-primary)_18%,transparent),transparent_58%),linear-gradient(135deg,#07100d,#101a15)]">
              <div className="absolute inset-0 tactical-grid opacity-40" />
              <div className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/50 bg-primary/15 text-primary shadow-[0_0_28px_color-mix(in_oklch,var(--color-primary)_40%,transparent)]">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="absolute bottom-2 left-2 rounded border border-border bg-surface/85 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur">
                {Number(occ.latitude).toFixed(5)}, {Number(occ.longitude).toFixed(5)}
              </div>
              <Link
                to={`/map?lat=${encodeURIComponent(occ.latitude)}&lng=${encodeURIComponent(
                  occ.longitude,
                )}&occurrence_id=${encodeURIComponent(
                  occ.id || op.occurrence_id || "",
                )}&focus=history&outcome=${outcome}&title=${encodeURIComponent(
                  occ.titulo ||
                    occ.title ||
                    auditOperation.titulo ||
                    auditOperation.title ||
                    "Ocorrencia",
                )}&address=${encodeURIComponent(occ.endereco || occ.address_text || "")}`}
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary backdrop-blur hover:bg-primary/20"
              >
                <MapPin className="h-3.5 w-3.5" /> Ver no Mapa
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <Info label="Titulo" value={occ.titulo || occ.title} />
            <Info label="Tipo" value={occ.tipo || occ.type} />
            <Info label="Endereco" value={occ.endereco || occ.address_text} />
            <Info label="Coordenadas" value={`${occ.latitude}, ${occ.longitude}`} />
            <div className="sm:col-span-2">
              <Info label="Descricao" value={occ.descricao || occ.description || "-"} />
            </div>
          </div>
        </Section>
      )}

      <Section title={`Participantes (${participants.length})`}>
        {participants.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nenhum participante registrado.</div>
        ) : (
          <ul className="flex flex-wrap gap-2 text-xs">
            {participants.map((p: any, i: number) => (
              <li key={i} className="rounded-md border border-border bg-background px-2 py-1">
                {typeof p === "string" ? p : p.display_name || p.username}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Eventos (${events.length})`}>
        <ul className="space-y-1 text-xs">
          {events.length === 0 && (
            <li className="text-muted-foreground">Nenhum evento registrado.</li>
          )}
          {events.map((e: any, i: number) => (
            <li
              key={i}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono"
            >
              [
              {e.timestamp || e.created_at
                ? new Date(e.timestamp || e.created_at).toLocaleString()
                : "-"}
              ] {e.type || e.kind || e.status} - {e.description || e.message || e.note || ""}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Mensagens (${messages.length})`}>
        <ul className="space-y-1 text-sm">
          {messages.length === 0 && (
            <li className="text-xs text-muted-foreground">Sem mensagens.</li>
          )}
          {messages.map((m: any, i: number) => (
            <li key={i} className="rounded-md border border-border bg-background px-2 py-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {m.author || m.display_name || m.username || "Sistema"} -{" "}
                {m.timestamp ? new Date(m.timestamp).toLocaleString() : ""}
              </div>
              <div>{m.text || m.content || m.corpo_texto || ""}</div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function operationOutcome(operation: any): "success" | "failure" {
  const text = String(
    operation?.outcome ||
      operation?.resultado ||
      operation?.closing_summary ||
      operation?.resumo ||
      "",
  ).toLowerCase();
  if (/falh|fracass|insucesso|sem sucesso|cancelad|abortad|nao conclu|não conclu/.test(text)) {
    return "failure";
  }
  return "success";
}

function operationOutcomeFormal(operation: any): "success" | "failure" {
  const value = String(operation?.outcome || operation?.resultado || "").toLowerCase();
  if (value === "failure" || value === "falha") return "failure";
  return "success";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}
function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? "-"}</div>
    </div>
  );
}
