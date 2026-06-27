import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/RoleGuard";
import { Shell } from "@/components/Shell";
import { OperationForm } from "@/components/OperationForm";
import { ChatRoom } from "@/components/ChatRoom";
import { api } from "@/lib/api";
import { normalizeOperation } from "@/lib/rescueradio";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, RefreshCw, Radio, X, CheckCircle2, MapPin } from "lucide-react";

export const Route = createFileRoute("/operations")({
  component: () => (
    <AuthGuard>
      <Shell>
        <OperationsPage />
      </Shell>
    </AuthGuard>
  ),
});

function OperationsPage() {
  const { user, profile } = useAuth();
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState<"success" | "failure">("success");
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<any[]>("/operations", { query: { status: "active" } });
      const normalized = Array.isArray(res) ? res.map(normalizeOperation) : [];
      if (user?.role === "operador") {
        setOps(normalized.filter((op) => userParticipates(op, user, profile)));
      } else {
        setOps(normalized);
      }
    } catch {
      setOps([]);
    } finally {
      setLoading(false);
    }
  }, [profile, user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!ops.length) return;
    const operationId = new URLSearchParams(window.location.search).get("operation_id");
    if (!operationId) return;
    const op = ops.find((item) => item.id === operationId);
    if (op) {
      setSelected(op);
      setCreating(false);
    }
  }, [ops]);

  useEffect(() => {
    if (!selected || selected.status === "closed") return;
    const timer = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [selected]);

  const duration = selected?.created_at ? formatDuration(selected.created_at) : "--:--:--";
  const canCommand = user?.role === "comandante" || user?.role === "admin";
  const occurrence = selected?.occurrence;
  const mapHref =
    occurrence?.latitude && occurrence?.longitude
      ? `/map?lat=${encodeURIComponent(occurrence.latitude)}&lng=${encodeURIComponent(
          occurrence.longitude,
        )}&occurrence_id=${encodeURIComponent(occurrence.id || selected.occurrence_id || "")}`
      : "/map";

  const close = async () => {
    if (!selected) return;
    setClosing(true);
    try {
      await api(`/operations/${selected.id}/close`, { method: "POST", json: { summary, outcome } });
      setSelected({ ...selected, status: "closed", outcome });
      setSummary("");
      setOutcome("success");
      load();
    } catch (e: any) {
      alert(e?.message || "Erro ao finalizar operacao");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-border bg-surface md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Operacoes ativas
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={load}
              className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            {canCommand && (
              <button
                onClick={() => {
                  setCreating(true);
                  setSelected(null);
                }}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Nova
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {ops.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">Nenhuma operacao ativa.</div>
          )}
          <ul className="divide-y divide-border">
            {ops.map((o) => {
              const sel = selected?.id === o.id;
              return (
                <li key={o.id}>
                  <button
                    onClick={() => {
                      setSelected(o);
                      setCreating(false);
                    }}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2 ${sel ? "bg-surface-2" : ""}`}
                  >
                    <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{o.titulo || o.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {o.tipo || "-"}
                      </div>
                      <div className="mt-1 flex gap-1">
                        <StatusBadge status={o.prioridade || "normal"} />
                        <StatusBadge status={o.status === "closed" ? "closed_op" : "active"} />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <section className="min-h-0">
        {creating && canCommand ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-2 text-sm">
              <div className="font-semibold">Nova operacao</div>
              <button
                onClick={() => setCreating(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <OperationForm
                onCreated={() => {
                  setCreating(false);
                  load();
                }}
              />
            </div>
          </div>
        ) : selected ? (
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-surface/60 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{selected.titulo || selected.title}</div>
                <div className="text-xs text-muted-foreground">
                  Operacao - {selected.id} - Duracao {duration}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={mapHref}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/60 hover:text-primary"
                >
                  <MapPin className="h-3.5 w-3.5" /> Ver no Mapa
                </a>
                {canCommand && selected.status !== "closed" && (
                  <div className="flex items-center gap-2">
                    <input
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Resumo de encerramento"
                      className="w-56 rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
                    />
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value as "success" | "failure")}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                    >
                      <option value="success">Sucesso</option>
                      <option value="failure">Falha</option>
                    </select>
                    <button
                      onClick={close}
                      disabled={closing || !summary.trim()}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
                    </button>
                  </div>
                )}
              </div>
            </div>
            <ChatRoom
              channelId={`operacao:${selected.id}`}
              title={`Canal da operacao - ${selected.titulo || selected.title}`}
              subtitle={
                selected.status === "closed"
                  ? "Operacao finalizada"
                  : "Comunicacao tatica em tempo real"
              }
              readOnly={selected.status === "closed"}
              readOnlyReason="Operacao finalizada. Envio de mensagens bloqueado."
              operationStartedAt={selected.created_at}
            />
          </div>
        ) : (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground">
            Selecione uma operacao ativa ou crie uma nova.
          </div>
        )}
      </section>
    </div>
  );
}

function formatDuration(start: string) {
  const total = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function userParticipates(op: any, user: any, profile: any) {
  const display = profile?.operational_name || profile?.nome_operacional || user?.display_name;
  return (op.participantes || op.members || []).some((member: any) => {
    if (typeof member === "string") return member === user?.username || member === display;
    return (
      member.username === user?.username ||
      member.display_name === display ||
      member.display_name === user?.display_name
    );
  });
}
