import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  MessageSquare,
  Map as MapIcon,
  Radio,
  History,
  Activity,
  Shield,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  Bell,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { connectNotifications } from "@/lib/notifications";
import { normalizeChatMessage, normalizeOperation } from "@/lib/rescueradio";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

type NavItem = { to: string; label: string; icon: typeof MessageSquare; roles?: string[] };

const NAV: NavItem[] = [
  { to: "/chat", label: "Central de Comunicação", icon: MessageSquare },
  { to: "/map", label: "Mapa", icon: MapIcon },
  { to: "/operations", label: "Operações", icon: Radio },
  { to: "/history", label: "Historico", icon: History },
  {
    to: "/observability",
    label: "Observabilidade",
    icon: Activity,
    roles: ["comandante", "admin"],
  },
  { to: "/admin", label: "Gestão de Usuários", icon: Shield, roles: ["admin"] },
];

export function Shell({ children }: { children: ReactNode }) {
  const { user, profile, logout, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [assignment, setAssignment] = useState<any | null>(null);
  const [assignmentMessages, setAssignmentMessages] = useState<any[]>([]);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const seenAssignments = useRef<Set<string>>(new Set());

  const handleLogout = () => {
    logout();
    navigate({ to: "/auth" });
  };

  const visible = NAV.filter((i) => !i.roles || (user && i.roles.includes(user.role)));

  const currentStatus = (profile?.status as string) || "disponivel";
  const statusLabel = useMemo(() => {
    if (!user) return "Offline";
    if (currentStatus === "em_operacao") return "Em operacao";
    if (currentStatus === "ausente" || currentStatus === "indisponivel") return "Ausente";
    return "Disponivel";
  }, [currentStatus, user]);
  const statusTone =
    currentStatus === "em_operacao"
      ? "text-destructive"
      : currentStatus === "ausente" || currentStatus === "indisponivel"
        ? "text-[color:var(--color-warning)]"
        : "text-primary";

  const updateStatus = async (status: string) => {
    if (!profile) return;
    setStatusBusy(true);
    try {
      await api("/profiles/me", {
        method: "PUT",
        json: {
          operational_name: profile.operational_name || profile.nome_operacional || "",
          base_id: profile.base_id || "",
          function: "",
          contact: profile.contact || profile.contato || "",
          status,
          skills: profile.skills || profile.competencias || [],
        },
      });
      await refreshProfile();
    } finally {
      setStatusBusy(false);
    }
  };

  useEffect(() => {
    if (!user || pathname === "/auth" || pathname === "/onboarding") return;
    let cancelled = false;

    const openAssignment = async (op: any) => {
      const operationId = op.id || op.operation_id;
      if (!operationId) return;
      if (
        seenAssignments.current.has(operationId) ||
        assignmentAcknowledged(user.username, operationId)
      ) {
        seenAssignments.current.add(operationId);
        return;
      }
      seenAssignments.current.add(operationId);
      if (pathname === "/operations") return;
      const normalized = normalizeOperation({
        ...op,
        id: operationId,
        title: op.title || op.titulo,
        prioridade: op.priority || op.prioridade,
      });
      setAssignmentMessages([]);
      setAssignment(normalized);
      try {
        const audit = await api<any>(`/operations/${operationId}/audit`);
        const messages = (audit?.messages || [])
          .slice(-6)
          .map((m: any) => normalizeChatMessage(m, "briefing"));
        if (!cancelled) {
          setAssignment(normalizeOperation(audit?.operation || normalized));
          setAssignmentMessages(messages);
        }
      } catch {
        if (!cancelled) setAssignmentMessages([]);
      }
    };

    const notifications = connectNotifications((event) => {
      if (event.type === "OPERATION_ASSIGNED") {
        openAssignment(event);
      }
    });

    const pollAssignments = async () => {
      try {
        const res = await api<any[]>("/operations", { query: { status: "active" } });
        if (cancelled) return;
        const ops = Array.isArray(res) ? res.map(normalizeOperation) : [];
        const assigned = ops.filter((op) => userParticipates(op, user, profile));
        assigned.forEach((op) => {
          openAssignment(op);
        });
      } catch {
        // Assignment polling is best-effort; cockpit remains usable offline.
      }
    };

    pollAssignments();
    const timer = setInterval(pollAssignments, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      notifications.close();
    };
  }, [user, profile, pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] md:relative md:translate-x-0",
          collapsed && "md:w-[72px]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
            <Radar className="h-4 w-4" />
          </div>
          <div className={cn("min-w-0", collapsed && "md:hidden")}>
            <div className="truncate text-sm font-semibold tracking-wide">RescueRadio</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Emergency Ops
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "group mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  collapsed && "md:justify-center md:px-2",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                <span className={cn("truncate", collapsed && "md:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          {profile && (
            <label
              className={cn(
                "mb-2 flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-[11px]",
                collapsed && "md:justify-center md:px-1",
              )}
              title="Status operacional"
            >
              <span className={`status-dot ${statusTone}`} style={{ background: "currentColor" }} />
              <span className={cn("text-muted-foreground", collapsed && "md:hidden")}>
                {statusLabel}
              </span>
              <select
                value={currentStatus}
                disabled={statusBusy}
                onChange={(e) => updateStatus(e.target.value)}
                className={cn(
                  "min-w-0 bg-transparent text-foreground outline-none",
                  collapsed && "md:hidden",
                )}
              >
                <option className="bg-surface" value="disponivel">
                  Disponivel
                </option>
                <option className="bg-surface" value="ausente">
                  Ausente
                </option>
                <option className="bg-surface" value="em_operacao">
                  Em operacao
                </option>
              </select>
            </label>
          )}
          <Link
            to="/profile"
            className={cn(
              "mb-2 flex items-center gap-2 rounded-md p-1 transition hover:bg-sidebar-accent/60",
              collapsed && "md:justify-center",
            )}
            title="Meu perfil"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold uppercase">
              {(user?.display_name || user?.username || "?").slice(0, 2)}
            </div>
            <div className={cn("min-w-0", collapsed && "md:hidden")}>
              <div className="truncate text-sm font-medium">
                {user?.display_name || user?.username}
              </div>
              <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                {user?.role}
              </div>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-destructive/60 hover:text-destructive"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className={cn(collapsed && "md:hidden")}>Sair</span>
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="absolute inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/60 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              className="hidden h-9 w-9 place-items-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground md:grid"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
              title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {visible.find((v) => pathname.startsWith(v.to))?.label || "Cockpit"}
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                RescueRadio - Operacao tatica
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status="connected" label="Sistema online" />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
      {assignment && (
        <AssignmentModal
          operation={assignment}
          messages={assignmentMessages}
          onClose={() => {
            acknowledgeAssignment(user?.username, assignment.id);
            setAssignment(null);
          }}
          onOpen={() => {
            const id = assignment.id;
            acknowledgeAssignment(user?.username, id);
            setAssignment(null);
            navigate({ to: "/operations", search: { operation_id: id } as any });
          }}
        />
      )}
    </div>
  );
}

function assignmentKey(username: string, operationId: string) {
  return `rescueradio:assignment-ack:${username}:${operationId}`;
}

function assignmentAcknowledged(username: string, operationId: string) {
  try {
    return window.localStorage.getItem(assignmentKey(username, operationId)) === "1";
  } catch {
    return false;
  }
}

function acknowledgeAssignment(username: string | undefined, operationId: string) {
  if (!username) return;
  try {
    window.localStorage.setItem(assignmentKey(username, operationId), "1");
  } catch {
    // Local storage can be unavailable in hardened browsers.
  }
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

function AssignmentModal({
  operation,
  messages,
  onClose,
  onOpen,
}: {
  operation: any;
  messages: any[];
  onClose: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-md border border-primary/40 bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Designado para operação</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {operation.titulo || operation.title || operation.id}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div className="rounded border border-border bg-background p-3 text-xs text-muted-foreground">
            Briefing automático com as últimas transmissões do canal da operação.
          </div>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
            {messages.length === 0 && (
              <li className="rounded border border-border bg-background px-2 py-2 text-xs text-muted-foreground">
                Nenhuma mensagem anterior registrada.
              </li>
            )}
            {messages.map((m, idx) => {
              const text = String(m.text || m.corpo_texto || "");
              const critical = /^\s*\[CRITICO\]/i.test(text);
              const alert = /^\s*\[ALERTA\]/i.test(text);
              return (
                <li
                  key={idx}
                  className={cn(
                    "rounded border-l-2 bg-background px-2 py-1.5",
                    critical
                      ? "border-l-destructive"
                      : alert
                        ? "border-l-[color:var(--color-warning)]"
                        : "border-l-border",
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.author || "Operador"}
                    {critical && " - CRITICO"}
                    {alert && !critical && " - ALERTA"}
                  </div>
                  <div>{text.replace(/^\s*\[(CRITICO|ALERTA)\]\s*/i, "")}</div>
                </li>
              );
            })}
          </ul>
          <button
            onClick={onOpen}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Entrar no chat da operação
          </button>
        </div>
      </div>
    </div>
  );
}
