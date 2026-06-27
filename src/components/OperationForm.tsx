import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { OccurrenceMap } from "./OccurrenceMap";
import { OperatorSelector } from "./OperatorSelector";
import { MapPin, Loader2 } from "lucide-react";
import { normalizeOperation } from "@/lib/rescueradio";

const DEFAULT_CENTER: [number, number] = [-8.0476, -34.877];

interface Base {
  id: string;
  name?: string;
  nome?: string;
  latitude?: number;
  longitude?: number;
}

interface Props {
  onCreated?: (op: any) => void;
}

export function OperationForm({ onCreated }: Props) {
  const [bases, setBases] = useState<Base[]>([]);
  const [baseId, setBaseId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("resgate");
  const [prioridade, setPrioridade] = useState<"critico" | "alto" | "medio" | "normal">("medio");
  const [endereco, setEndereco] = useState("");
  const [descricao, setDescricao] = useState("");
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedBase = bases.find((base) => base.id === baseId);
  const baseCenter = useMemo<[number, number]>(() => {
    const lat = Number(selectedBase?.latitude);
    const lng = Number(selectedBase?.longitude);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return DEFAULT_CENTER;
    }
    return [lat, lng];
  }, [selectedBase?.latitude, selectedBase?.longitude]);

  useEffect(() => {
    api<Base[]>("/bases")
      .then((b) => {
        setBases(b);
        if (b[0]) setBaseId(b[0].id);
      })
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!coord) {
      setError("Selecione a coordenada clicando no mapa.");
      return;
    }
    setSubmitting(true);
    try {
      const op = await api<any>("/operations", {
        method: "POST",
        json: {
          occurrence: {
            title: titulo,
            type: tipo,
            priority: prioridade,
            address_text: endereco,
            description: descricao,
            latitude: coord.lat,
            longitude: coord.lng,
            base_id: baseId,
          },
          member_usernames: participantes,
        },
      });
      onCreated?.(normalizeOperation(op));
      setTitulo("");
      setDescricao("");
      setEndereco("");
      setCoord(null);
      setParticipantes([]);
    } catch (err: any) {
      setError(err?.message || "Erro ao criar operacao");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="flex min-h-[320px] flex-col overflow-hidden rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Clique no mapa para marcar a coordenada
          </span>
          {coord && (
            <span className="font-mono text-[11px] text-foreground">
              {coord.lat.toFixed(5)}, {coord.lng.toFixed(5)}
            </span>
          )}
        </div>
        <div className="flex-1">
          <OccurrenceMap
            markers={[]}
            pickedCoord={coord}
            onMapClick={(lat, lng) => setCoord({ lat, lng })}
            center={coord ? [coord.lat, coord.lng] : baseCenter}
            zoom={coord ? 15 : 11}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Field label="Titulo">
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
              <option value="resgate">Resgate</option>
              <option value="incendio">Incendio</option>
              <option value="medico">Medico</option>
              <option value="busca">Busca</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
          <Field label="Prioridade">
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as any)}
              className={inputCls}
            >
              <option value="critico">Critico</option>
              <option value="alto">Alto</option>
              <option value="medio">Medio</option>
              <option value="normal">Normal</option>
            </select>
          </Field>
        </div>
        <Field label="Base">
          <select value={baseId} onChange={(e) => setBaseId(e.target.value)} className={inputCls}>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.nome || b.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Endereco">
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            className={inputCls}
            placeholder="Rua, numero, bairro"
          />
          <div className="mt-1 text-[11px] text-muted-foreground">
            Endereco usado como registro textual. A localizacao operacional e definida pelo ponto no
            mapa.
          </div>
        </Field>
        <Field label="Descricao">
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className={inputCls + " resize-none"}
          />
        </Field>
        <Field label="Participantes">
          <OperatorSelector baseId={baseId} selected={participantes} onChange={setParticipantes} />
        </Field>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar operacao
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
