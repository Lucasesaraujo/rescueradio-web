import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Search, Users, Check } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { normalizeOperator } from "@/lib/rescueradio";

export interface Operator {
  username: string;
  display_name?: string;
  funcao?: string;
  status?: string;
  competencias?: string[];
  base_id?: string;
}

interface Props {
  baseId?: string;
  selected: string[];
  onChange: (usernames: string[]) => void;
}

export function OperatorSelector({ baseId, selected, onChange }: Props) {
  const [list, setList] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [skill, setSkill] = useState<string>("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api<Operator[]>("/operators", {
          query: { base_id: baseId, status, skill },
        });
        if (!cancelled) setList(Array.isArray(res) ? res.map(normalizeOperator) : []);
      } catch {
        if (!cancelled) setList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [baseId, status, skill]);

  const toggle = (u: string) => {
    if (selected.includes(u)) onChange(selected.filter((x) => x !== u));
    else onChange([...selected, u]);
  };

  const addAvailable = () => {
    const usernames = list.filter((o) => o.status === "disponivel").map((o) => o.username);
    onChange(Array.from(new Set([...selected, ...usernames])));
  };

  const filtered = list.filter(
    (o) =>
      !q ||
      (o.display_name || "").toLowerCase().includes(q.toLowerCase()) ||
      o.username.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar operador..."
            className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
        >
          <option value="">Todos status</option>
          <option value="disponivel">Disponivel</option>
          <option value="em_operacao">Em operacao</option>
          <option value="ausente">Ausente</option>
        </select>
        <input
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          placeholder="Competencia"
          className="w-32 rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={addAvailable}
          className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 text-xs text-primary hover:bg-primary/20"
        >
          <Users className="h-3.5 w-3.5" /> Todos disponiveis
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Carregando operadores...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Nenhum operador.</div>
        ) : (
          <ul>
            {filtered.map((o) => {
              const sel = selected.includes(o.username);
              return (
                <li key={o.username}>
                  <button
                    type="button"
                    onClick={() => toggle(o.username)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2 text-left text-xs transition hover:bg-surface-2",
                      sel && "bg-primary/10",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {o.display_name || o.username}
                      </div>
                      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                        {o.competencias?.length ? o.competencias.join(", ") : "-"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {o.status && <StatusBadge status={o.status} />}
                      {sel && (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {selected.length} operador(es) selecionado(s)
      </div>
    </div>
  );
}
