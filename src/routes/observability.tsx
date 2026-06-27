import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/RoleGuard";
import { Shell } from "@/components/Shell";
import { useEffect, useState } from "react";
import { Activity, ExternalLink, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/observability")({
  component: () => (
    <AuthGuard roles={["comandante", "admin"]}>
      <Shell>
        <ObsPage />
      </Shell>
    </AuthGuard>
  ),
});

const SERVICES = [
  { name: "API", url: "http://localhost:8000/health", desc: "FastAPI principal" },
  { name: "Swagger", url: "http://localhost:8000/docs", desc: "Documentacao interativa da API" },
  { name: "Kong", url: "http://localhost:8001/health", desc: "Gateway de roteamento" },
  { name: "Prometheus", url: "http://localhost:9090", desc: "Metricas em /metrics" },
  { name: "Grafana", url: "http://localhost:3000", desc: "Dashboards visuais" },
  { name: "Loki", url: "http://localhost:3100", desc: "Logs agregados" },
];

function ObsPage() {
  const [statuses, setStatuses] = useState<Record<string, "ok" | "down" | "checking">>({});

  useEffect(() => {
    SERVICES.forEach((s) => {
      setStatuses((p) => ({ ...p, [s.name]: "checking" }));
      fetch(s.url, { mode: "no-cors" })
        .then(() => setStatuses((p) => ({ ...p, [s.name]: "ok" })))
        .catch(() => setStatuses((p) => ({ ...p, [s.name]: "down" })));
    });
  }, []);

  return (
    <div className="h-full overflow-auto p-4">
      <header className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">Observabilidade tatica</div>
        <div className="text-xs text-muted-foreground">- estado dos servicos de plataforma</div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => {
          const st = statuses[s.name] || "checking";
          return (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2 rounded-md border border-border bg-surface p-4 transition hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{s.name}</div>
                {st === "checking" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : st === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
              <div className="mt-auto inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground group-hover:text-primary">
                {s.url} <ExternalLink className="h-3 w-3" />
              </div>
            </a>
          );
        })}
      </div>

      <div className="mt-4 rounded-md border border-border bg-surface p-4 text-xs text-muted-foreground">
        Metricas Prometheus expostas em <span className="font-mono text-foreground">/metrics</span>{" "}
        nos servicos instrumentados.
      </div>
    </div>
  );
}
