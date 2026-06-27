import { cn } from "@/lib/utils";

const map: Record<string, { label: string; color: string }> = {
  disponivel: { label: "Disponivel", color: "text-primary" },
  em_operacao: { label: "Em operacao", color: "text-destructive" },
  ausente: { label: "Ausente", color: "text-[color:var(--color-warning)]" },
  indisponivel: { label: "Ausente", color: "text-[color:var(--color-warning)]" },
  connected: { label: "Conectado", color: "text-primary" },
  connecting: { label: "Conectando", color: "text-[color:var(--color-warning)]" },
  reconnecting: { label: "Reconectando", color: "text-[color:var(--color-warning)]" },
  error: { label: "Erro", color: "text-destructive" },
  closed: { label: "Encerrado", color: "text-muted-foreground" },
  idle: { label: "Ocioso", color: "text-muted-foreground" },
  active: { label: "Ativa", color: "text-primary" },
  closed_op: { label: "Encerrada", color: "text-muted-foreground" },
  critico: { label: "Critico", color: "text-destructive" },
  alto: { label: "Alto", color: "text-[color:var(--color-warning)]" },
  medio: { label: "Medio", color: "text-primary" },
  normal: { label: "Normal", color: "text-primary" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const entry = map[status] || { label: label || status, color: "text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        entry.color,
        className,
      )}
    >
      <span className="status-dot" style={{ background: "currentColor" }} />
      {label || entry.label}
    </span>
  );
}
