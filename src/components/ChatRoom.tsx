import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { connectChannel, type WSStatus } from "@/lib/ws";
import {
  Send,
  Wifi,
  WifiOff,
  Loader2,
  Radio,
  Users,
  AlertTriangle,
  Activity,
  ShieldAlert,
  Crown,
  History as HistoryIcon,
  Lock,
  Clock3,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { normalizeChatMessage, normalizeOperation, normalizeOperator } from "@/lib/rescueradio";
import { cn } from "@/lib/utils";
import { ConfirmDialog, type ConfirmDialogState } from "./ConfirmDialog";

export interface ChatMessage {
  id: string;
  text: string;
  author: string;
  role?: string;
  username?: string;
  timestamp: string;
  channel?: string;
  kind: "live" | "briefing" | "system" | "alert" | "critical";
  priority?: "normal" | "alerta" | "critico";
  mine?: boolean;
}

export interface Member {
  username?: string;
  display_name?: string;
  role?: string;
  status?: string;
  connection_status?: string;
  last_seen_at?: string | null;
  [k: string]: any;
}

interface Props {
  channelId: string;
  title: string;
  subtitle?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
  auditHref?: string;
  showChannelsPanel?: boolean;
  operationStartedAt?: string;
}

type Priority = "normal" | "alerta" | "critico";

const QUICK_COMMANDS = [
  "QAP?",
  "A caminho",
  "Cheguei no local",
  "Preciso apoio",
  "Vitima localizada",
  "Encerrando atendimento",
];

function normalizeMsg(m: any, fallbackKind: ChatMessage["kind"] = "live"): ChatMessage {
  const normalized = normalizeChatMessage(m, fallbackKind);
  const text = (normalized.text || "").replace(/^\s*\[(CRITICO|ALERTA)\]\s*/i, "");
  let priority: Priority | undefined = m.priority || m.prioridade;
  if (!priority && /^\s*\[CRITICO\]/i.test(normalized.text || "")) priority = "critico";
  if (!priority && /^\s*\[ALERTA\]/i.test(normalized.text || "")) priority = "alerta";
  let kind = normalized.kind || fallbackKind;
  if (priority === "critico") kind = "critical";
  else if (priority === "alerta") kind = "alert";
  return {
    id: normalized.id,
    text,
    author: normalized.author,
    username: normalized.username,
    role: m.role || m.funcao,
    timestamp: normalized.timestamp,
    channel: normalized.channel,
    kind,
    priority,
  };
}

function normalizeMember(input: any): Member {
  if (typeof input === "string") {
    return { username: input, display_name: input, role: "operador", status: "online" };
  }
  const name =
    input?.display_name ||
    input?.operational_name ||
    input?.nome_operacional ||
    input?.usuario ||
    input?.username ||
    "Operador";
  return {
    ...input,
    username: input?.username || input?.usuario || name,
    display_name: name,
    role: input?.role || input?.funcao || "operador",
    status: input?.status || "online",
    connection_status: input?.connection_status || input?.connectionStatus,
    last_seen_at: input?.last_seen_at || input?.lastSeenAt || null,
  };
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

function fmtDuration(start?: string) {
  if (!start) return "--:--:--";
  const ms = Math.max(0, Date.now() - new Date(start).getTime());
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function ChatRoom({
  channelId,
  title,
  subtitle,
  readOnly,
  readOnlyReason,
  auditHref,
  showChannelsPanel,
  operationStartedAt,
}: Props) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [briefingCount, setBriefingCount] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [status, setStatus] = useState<WSStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [activeOps, setActiveOps] = useState<any[]>([]);
  const [baseOperators, setBaseOperators] = useState<Member[]>([]);
  const [showOfflineOperators, setShowOfflineOperators] = useState(false);
  const [autoscroll, setAutoscroll] = useState(true);
  const [clockTick, setClockTick] = useState(0);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const clientRef = useRef<ReturnType<typeof connectChannel> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevStatusRef = useRef<WSStatus>("idle");
  const connectedAtRef = useRef<number>(0);
  const baseId = useMemo(() => {
    const match = channelId.match(/^base:(.+):geral$/);
    return match?.[1] || profile?.base_id || user?.base_id || "";
  }, [channelId, profile?.base_id, user?.base_id]);

  // Fetch active operations for the channels panel
  useEffect(() => {
    if (!showChannelsPanel) return;
    let cancel = false;
    api<any[]>("/operations", { query: { status: "active" } })
      .then((r) => {
        if (cancel) return;
        const ops = Array.isArray(r) ? r.map(normalizeOperation) : [];
        if (user?.role !== "operador") {
          setActiveOps(ops);
          return;
        }
        const display = profile?.operational_name || profile?.nome_operacional || user.display_name;
        setActiveOps(
          ops.filter((op) =>
            (op.participantes || op.members || []).some((member: any) => {
              if (typeof member === "string") return member === user.username || member === display;
              return (
                member.username === user.username ||
                member.display_name === display ||
                member.display_name === user.display_name
              );
            }),
          ),
        );
      })
      .catch(() => !cancel && setActiveOps([]));
    return () => {
      cancel = true;
    };
  }, [showChannelsPanel, channelId, user, profile]);

  useEffect(() => {
    if (!baseId) return;
    let cancel = false;
    const loadOperators = () => {
      api<any[]>("/operators", { query: { base_id: baseId } })
        .then((result) => {
          if (cancel) return;
          const operators = Array.isArray(result)
            ? result.map((item) => normalizeMember(normalizeOperator(item)))
            : [];
          setBaseOperators(operators);
        })
        .catch(() => !cancel && setBaseOperators([]));
    };
    loadOperators();
    const timer = setInterval(loadOperators, 30000);
    return () => {
      cancel = true;
      clearInterval(timer);
    };
  }, [baseId]);

  useEffect(() => {
    if (!operationStartedAt) return;
    const timer = setInterval(() => setClockTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [operationStartedAt]);

  // Connect WS
  useEffect(() => {
    setMessages([]);
    setMembers([]);
    setBriefingCount(0);
    setLastError(null);
    connectedAtRef.current = Date.now();
    const client = connectChannel(
      channelId,
      (ev) => {
        switch (ev.type) {
          case "CONNECTED": {
            const ms = Date.now() - connectedAtRef.current;
            setLatency(ms);
            if (Array.isArray((ev as any).members)) {
              setMembers((ev as any).members.map(normalizeMember));
            }
            break;
          }
          case "BRIEFING": {
            const raw = Array.isArray(ev.messages) ? ev.messages : [];
            const list = raw.map((m: any) => normalizeMsg(m, "briefing"));
            setMessages(list);
            setBriefingCount(list.length);
            if (Array.isArray((ev as any).members)) {
              setMembers((ev as any).members.map(normalizeMember));
            }
            break;
          }
          case "MESSAGE_RECEIVED": {
            const msg = normalizeMsg(ev.payload ?? ev, "live");
            setMessages((prev) => [...prev, msg]);
            break;
          }
          case "MEMBER_JOINED":
            if (Array.isArray((ev as any).members)) {
              setMembers((ev as any).members.map(normalizeMember));
            }
            if (ev.member) {
              const member = normalizeMember(ev.member);
              setMembers((prev) => [...prev, member]);
              setMessages((prev) => [
                ...prev,
                sysMsg(`${member.display_name || member.username} entrou no canal`),
              ]);
            } else if ((ev as any).usuario) {
              setMessages((prev) => [...prev, sysMsg(`${(ev as any).usuario} entrou no canal`)]);
            }
            break;
          case "MEMBER_LEFT":
            if (Array.isArray((ev as any).members)) {
              setMembers((ev as any).members.map(normalizeMember));
            }
            if (ev.member) {
              const member = normalizeMember(ev.member);
              const id = member.username;
              setMembers((prev) => prev.filter((m) => m.username !== id));
              setMessages((prev) => [
                ...prev,
                sysMsg(`${member.display_name || member.username} saiu do canal`),
              ]);
            } else if ((ev as any).usuario) {
              setMessages((prev) => [...prev, sysMsg(`${(ev as any).usuario} saiu do canal`)]);
            }
            break;
          case "ERROR":
            setLastError(ev.error || ev.message || "Erro no canal");
            setMessages((prev) => [
              ...prev,
              sysMsg(`Erro: ${ev.error || ev.message || "desconhecido"}`, "alert"),
            ]);
            break;
          case "CHAT_CLEARED":
            setMessages([
              sysMsg(`Historico do canal limpo por ${(ev as any).cleared_by || "admin"}.`, "alert"),
            ]);
            setBriefingCount(0);
            break;
        }
      },
      (s) => {
        // detect transitions
        const prev = prevStatusRef.current;
        if (prev !== "connected" && s === "connected" && prev !== "idle") {
          setMessages((p) => [...p, sysMsg("Canal restabelecido")]);
          connectedAtRef.current = Date.now();
        }
        if (prev === "connected" && (s === "reconnecting" || s === "error" || s === "closed")) {
          setMessages((p) => [
            ...p,
            sysMsg("Conexao perdida. Tentando restabelecer canal...", "alert"),
          ]);
        }
        prevStatusRef.current = s;
        setStatus(s);
      },
    );
    clientRef.current = client;
    return () => client.close();
  }, [channelId]);

  // Auto-scroll if user is near bottom
  useEffect(() => {
    if (!autoscroll) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, autoscroll]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoscroll(nearBottom);
  };

  const send = () => {
    const text = input.trim();
    if (!text || readOnly || status !== "connected") return;
    // optimistic priority marker prepended for backend that doesn't support priority
    const decorated =
      priority === "critico"
        ? `[CRITICO] ${text}`
        : priority === "alerta"
          ? `[ALERTA] ${text}`
          : text;
    clientRef.current?.send(decorated);
    setMessages((prev) => [
      ...prev,
      normalizeMsg(
        {
          corpo_texto: decorated,
          usuario:
            profile?.operational_name ||
            profile?.nome_operacional ||
            user?.display_name ||
            user?.username ||
            "OP",
          username: user?.username,
          timestamp_iso: new Date().toISOString(),
          priority,
        },
        "live",
      ),
    ]);
    setInput("");
    setPriority("normal");
    inputRef.current?.focus();
  };

  const clearChat = async () => {
    setConfirmState({
      title: "Limpar chat",
      description:
        "Todas as mensagens deste canal serao removidas do historico e do briefing. Os operadores conectados serao avisados.",
      confirmLabel: "Limpar chat",
      variant: "danger",
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          await api(`/channels/${encodeURIComponent(channelId)}/messages`, { method: "DELETE" });
          setMessages([sysMsg("Historico do canal limpo por admin.", "alert")]);
          setBriefingCount(0);
          setConfirmState(null);
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  };

  const liveStartIdx = useMemo(() => briefingCount, [briefingCount]);

  const mergedOperators = useMemo(() => {
    const byName = new Map<string, Member>();
    baseOperators.forEach((operator) => {
      byName.set(operator.username || operator.display_name || "", {
        ...operator,
        status: operator.status || "offline",
        connection_status: operator.connection_status || "offline",
      });
    });
    members.forEach((member) => {
      const key = member.username || member.display_name || "";
      byName.set(key, {
        ...(byName.get(key) || {}),
        ...member,
        connection_status: "online",
        status: member.status || byName.get(key)?.status || "online",
      });
    });
    const all = [...byName.values()];
    return all.sort((a, b) => {
      const ao = a.connection_status === "online" ? 0 : 1;
      const bo = b.connection_status === "online" ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return String(a.display_name || a.username).localeCompare(
        String(b.display_name || b.username),
      );
    });
  }, [baseOperators, members]);

  const onlineOperators = mergedOperators.filter(
    (operator) => operator.connection_status === "online",
  );
  const offlineOperators = mergedOperators.filter(
    (operator) => operator.connection_status !== "online",
  );

  const banner = useMemo(() => {
    if (readOnly) {
      return (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            <span>
              {readOnlyReason || "Operacao finalizada. Registro preservado para auditoria."}
            </span>
          </div>
          {auditHref && (
            <Link
              to={auditHref}
              className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary hover:bg-surface-2"
            >
              <HistoryIcon className="h-3 w-3" /> Abrir auditoria
            </Link>
          )}
        </div>
      );
    }
    if (status === "reconnecting" || status === "error") {
      return (
        <div className="flex items-center gap-2 border-b border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 px-4 py-2 text-xs text-[color:var(--color-warning)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="font-medium">Conexao perdida. Tentando restabelecer canal...</span>
        </div>
      );
    }
    if (status === "closed") {
      return (
        <div className="flex items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Canal offline.</span>
        </div>
      );
    }
    return null;
  }, [status, readOnly, readOnlyReason, auditHref]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 bg-background lg:grid-cols-[minmax(0,1fr)_300px]">
      <ConfirmDialog
        open={!!confirmState}
        state={confirmState}
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setConfirmState(null)}
        onConfirm={() => confirmState?.onConfirm()}
      />
      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
        {/* Banner row (read-only / reconnection) */}
        <div>{banner}</div>

        {/* Timeline */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative min-h-0 overflow-y-auto px-4 py-3"
        >
          {messages.length === 0 ? (
            <EmptyTimeline status={status} />
          ) : (
            <ol className="space-y-1.5">
              {messages.map((m, idx) => {
                const isMine =
                  m.username === user?.username ||
                  m.author ===
                    (profile?.operational_name || profile?.nome_operacional || user?.display_name);
                const showLiveDivider =
                  idx === liveStartIdx && briefingCount > 0 && messages.length > briefingCount;
                const showBriefingHeader = idx === 0 && briefingCount > 0;
                return (
                  <li key={m.id}>
                    {showBriefingHeader && (
                      <Divider
                        label={`Briefing automatico recebido - ultimas ${briefingCount} transmissoes`}
                        muted
                      />
                    )}
                    {showLiveDivider && <Divider label="Transmissoes ao vivo" />}
                    <TransmissionRow msg={{ ...m, mine: isMine }} />
                  </li>
                );
              })}
            </ol>
          )}
          {!autoscroll && messages.length > 0 && (
            <button
              onClick={() => {
                setAutoscroll(true);
                scrollRef.current?.scrollTo({
                  top: scrollRef.current.scrollHeight,
                  behavior: "smooth",
                });
              }}
              className="sticky bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary backdrop-blur"
            >
              Saltar para o ao vivo
            </button>
          )}
        </div>

        {/* Composer */}
        <footer className="border-t border-border bg-surface/60">
          {readOnly ? (
            <div className="px-4 py-3 text-center text-xs text-muted-foreground">
              <Lock className="mr-1 inline h-3 w-3" />
              Canal bloqueado para escrita.
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {/* Quick command chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => {
                      setInput((v) => (v ? v + " " + cmd : cmd));
                      inputRef.current?.focus();
                    }}
                    className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    {cmd}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  <PriorityChip value="normal" current={priority} onChange={setPriority} />
                  <PriorityChip value="alerta" current={priority} onChange={setPriority} />
                  <PriorityChip value="critico" current={priority} onChange={setPriority} />
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex flex-1 items-end gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:border-primary">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    disabled={status !== "connected"}
                    placeholder={
                      status === "connected"
                        ? "Transmissao tatica... (Enter envia, Shift+Enter quebra linha)"
                        : status === "reconnecting" || status === "error"
                          ? "Aguardando restabelecimento do canal..."
                          : "Conectando ao canal..."
                    }
                    className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  onClick={send}
                  disabled={status !== "connected" || !input.trim()}
                  className={cn(
                    "inline-flex h-[42px] items-center gap-2 rounded-md px-4 text-sm font-semibold transition",
                    priority === "critico"
                      ? "bg-destructive text-destructive-foreground hover:opacity-90"
                      : priority === "alerta"
                        ? "bg-[color:var(--color-warning)] text-background hover:opacity-90"
                        : "bg-primary text-primary-foreground hover:opacity-90",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <Send className="h-4 w-4" /> Transmitir
                </button>
              </div>
              {lastError && (
                <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                  <AlertTriangle className="h-3 w-3" /> {lastError}
                </div>
              )}
            </div>
          )}
        </footer>
      </section>

      {/* Side panel */}
      <aside className="hidden min-h-0 border-l border-border bg-surface/40 lg:flex lg:flex-col">
        <div className="border-b border-border px-3 py-2">
          <div className="truncate text-xs font-semibold">{title}</div>
          {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <ConnIndicator status={status} />
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {latency != null ? `${latency} ms` : "-- ms"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {onlineOperators.length}
            </span>
          </div>
          {operationStartedAt && (
            <div className="mt-2 flex items-center justify-between rounded border border-border bg-background px-2 py-1.5 font-mono text-xs">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5 text-primary" />
                Duracao
              </span>
              <span className="text-primary">{fmtDuration(operationStartedAt)}</span>
            </div>
          )}
          {user?.role === "admin" && (
            <button
              type="button"
              onClick={clearChat}
              disabled={confirmBusy}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Limpar chat
            </button>
          )}
        </div>
        <div className="border-b border-border px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Operadores no canal ({members.length})
          </div>
        </div>
        <ul className="max-h-[40%] overflow-y-auto p-2">
          {onlineOperators.length === 0 && (
            <li className="px-2 py-1 text-xs text-muted-foreground">Aguardando conexoes...</li>
          )}
          {onlineOperators.map((m, i) => (
            <OperatorRow key={(m.username || "") + i} member={m} />
          ))}
          {offlineOperators.length > 0 && (
            <li className="mt-2">
              <button
                type="button"
                onClick={() => setShowOfflineOperators((value) => !value)}
                className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {showOfflineOperators ? "Ocultar" : "Ver mais"} ({offlineOperators.length} offline)
              </button>
            </li>
          )}
          {showOfflineOperators &&
            offlineOperators.map((m, i) => (
              <OperatorRow key={`offline-${m.username || i}`} member={m} offline />
            ))}
        </ul>

        {showChannelsPanel && (
          <>
            <div className="border-y border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Canais
            </div>
            <ul className="flex-1 overflow-y-auto p-2 text-xs">
              <li>
                <div className="flex items-center gap-2 rounded bg-primary/10 px-2 py-1.5 font-medium text-primary">
                  <Radio className="h-3 w-3" /> Chat geral da base
                </div>
              </li>
              <li className="mt-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Operacoes ativas
              </li>
              {activeOps.length === 0 && (
                <li className="px-2 py-1 text-[11px] text-muted-foreground">
                  Nenhuma operacao ativa.
                </li>
              )}
              {activeOps.map((o) => (
                <li key={o.id}>
                  <Link
                    to="/operations"
                    className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-2"
                  >
                    <ShieldAlert className="h-3 w-3 text-[color:var(--color-warning)]" />
                    <span className="truncate">{o.titulo || o.title || o.id}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}

function sysMsg(text: string, kind: ChatMessage["kind"] = "system"): ChatMessage {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    author: "SISTEMA",
    timestamp: new Date().toISOString(),
    kind,
  };
}

function Divider({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <div className="my-3 flex items-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.2em]",
          muted ? "text-muted-foreground" : "text-primary",
        )}
      >
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function ConnIndicator({ status }: { status: WSStatus }) {
  const map: Record<WSStatus, { label: string; cls: string; icon: any }> = {
    idle: { label: "Ocioso", cls: "text-muted-foreground", icon: Loader2 },
    connecting: { label: "Conectando", cls: "text-[color:var(--color-warning)]", icon: Loader2 },
    connected: { label: "Conectado", cls: "text-primary", icon: Wifi },
    reconnecting: {
      label: "Reconectando",
      cls: "text-[color:var(--color-warning)]",
      icon: Loader2,
    },
    error: { label: "Erro", cls: "text-destructive", icon: WifiOff },
    closed: { label: "Offline", cls: "text-destructive", icon: WifiOff },
  };
  const e = map[status];
  const Icon = e.icon;
  const spin = status === "connecting" || status === "reconnecting";
  return (
    <span className={cn("inline-flex items-center gap-1.5", e.cls)}>
      <Icon className={cn("h-3.5 w-3.5", spin && "animate-spin")} />
      <span>{e.label}</span>
    </span>
  );
}

function RoleIcon({ role }: { role?: string }) {
  if (role === "admin" || role === "comandante") {
    return <Crown className="h-3.5 w-3.5 text-[color:var(--color-warning)]" />;
  }
  return <Users className="h-3.5 w-3.5 text-muted-foreground" />;
}

function OperatorRow({ member, offline }: { member: Member; offline?: boolean }) {
  const statusTone =
    member.status === "em_operacao"
      ? "text-destructive"
      : member.status === "ausente" || member.status === "indisponivel"
        ? "text-[color:var(--color-warning)]"
        : offline
          ? "text-muted-foreground"
          : "text-primary";
  return (
    <li className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-surface-2">
      <RoleIcon role={member.role} />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate font-medium", offline && "text-muted-foreground")}>
          {member.display_name || member.username || "Operador"}
        </div>
        <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          {member.role || "operador"} - {offline ? "offline" : member.status || "online"}
        </div>
        {offline && (
          <div className="truncate text-[10px] text-muted-foreground">
            Visto por ultimo {formatLastSeen(member.last_seen_at)}
          </div>
        )}
      </div>
      <span className={`status-dot ${statusTone}`} style={{ background: "currentColor" }} />
    </li>
  );
}

function formatLastSeen(value?: string | null) {
  if (!value) return "sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem registro";
  return `as ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function PriorityChip({
  value,
  current,
  onChange,
}: {
  value: Priority;
  current: Priority;
  onChange: (p: Priority) => void;
}) {
  const active = current === value;
  const label = value === "normal" ? "Normal" : value === "alerta" ? "Alerta" : "Critico";
  const cls =
    value === "critico"
      ? active
        ? "border-destructive bg-destructive text-destructive-foreground"
        : "border-destructive/40 text-destructive"
      : value === "alerta"
        ? active
          ? "border-[color:var(--color-warning)] bg-[color:var(--color-warning)] text-background"
          : "border-[color:var(--color-warning)]/40 text-[color:var(--color-warning)]"
        : active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground";
  return (
    <button
      onClick={() => onChange(value)}
      className={cn(
        "rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        cls,
      )}
    >
      {label}
    </button>
  );
}

function EmptyTimeline({ status }: { status: WSStatus }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-border bg-surface text-primary">
          <Radio className="h-5 w-5" />
        </div>
        <div className="text-sm font-semibold">Canal silencioso</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {status === "connected"
            ? "Nenhuma transmissao registrada. Inicie a comunicacao."
            : "Aguardando estabelecimento da conexao com o canal..."}
        </div>
      </div>
    </div>
  );
}

function TransmissionRow({ msg }: { msg: ChatMessage }) {
  const isSystem = msg.kind === "system";
  const isAlert = msg.kind === "alert" || msg.priority === "alerta";
  const isCritical = msg.kind === "critical" || msg.priority === "critico";
  const isBriefing = msg.kind === "briefing";

  if (isSystem) {
    return (
      <div className="flex items-center gap-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono">{msg.text}</span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {fmtTime(msg.timestamp)}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex gap-2 rounded border-l-2 px-2 py-1.5 transition",
        isCritical
          ? "border-l-destructive bg-destructive/10"
          : isAlert
            ? "border-l-[color:var(--color-warning)] bg-[color:var(--color-warning)]/5"
            : msg.mine
              ? "border-l-primary bg-primary/5"
              : isBriefing
                ? "border-l-border bg-surface/40 opacity-90"
                : "border-l-border bg-surface/30 hover:bg-surface-2/50",
      )}
    >
      <div className="w-20 shrink-0 font-mono text-[10px] leading-relaxed text-muted-foreground">
        {fmtTime(msg.timestamp)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] uppercase tracking-wider">
          <span className={cn("font-semibold", msg.mine ? "text-primary" : "text-foreground")}>
            {msg.author}
          </span>
          {msg.role && <span className="text-muted-foreground">/ {msg.role}</span>}
          {isCritical && (
            <span className="rounded bg-destructive px-1 py-px font-mono text-[9px] text-destructive-foreground">
              CRITICO
            </span>
          )}
          {isAlert && !isCritical && (
            <span className="rounded bg-[color:var(--color-warning)] px-1 py-px font-mono text-[9px] text-background">
              ALERTA
            </span>
          )}
          {isBriefing && (
            <span className="rounded border border-border px-1 py-px font-mono text-[9px] text-muted-foreground">
              BRIEFING
            </span>
          )}
        </div>
        <div className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-foreground">
          {msg.text}
        </div>
      </div>
    </div>
  );
}
