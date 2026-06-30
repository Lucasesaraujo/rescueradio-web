import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogState {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  onConfirm: () => Promise<void> | void;
}

interface Props {
  open: boolean;
  state: ConfirmDialogState | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, state, busy, onCancel, onConfirm }: Props) {
  if (!open || !state) return null;

  const variant = state.variant || "danger";
  const tone =
    variant === "danger"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : variant === "warning"
        ? "border-[color:var(--color-warning)]/50 bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]"
        : "border-primary/50 bg-primary/10 text-primary";
  const button =
    variant === "danger"
      ? "bg-destructive text-destructive-foreground"
      : variant === "warning"
        ? "bg-[color:var(--color-warning)] text-background"
        : "bg-primary text-primary-foreground";

  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-md border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md", tone)}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div id="confirm-dialog-title" className="text-sm font-semibold">
                {state.title}
              </div>
              {state.description && (
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {state.description}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
            aria-label="Fechar confirmação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end gap-2 p-4">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {state.cancelLabel || "Cancelar"}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50",
              button,
            )}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {state.confirmLabel || "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
