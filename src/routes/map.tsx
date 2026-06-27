import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthGuard } from "@/components/RoleGuard";
import { Shell } from "@/components/Shell";
import {
  OccurrenceMap,
  type CoverageArea,
  type MapMarker,
  type TeamMarker,
} from "@/components/OccurrenceMap";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { createCircularCoverageArea, loadLocalCoverageAreasForCities } from "@/lib/geo";
import { normalizeOccurrence, normalizeOperator } from "@/lib/rescueradio";
import { Crosshair, Filter, MapPin, RefreshCw, Users, X, Plus, Check } from "lucide-react";

export const Route = createFileRoute("/map")({
  component: () => (
    <AuthGuard>
      <Shell>
        <MapPage />
      </Shell>
    </AuthGuard>
  ),
});

const PRIORITIES = ["critico", "alto", "medio"] as const;
const STATUSES = ["aberta", "em_andamento", "encerrada"] as const;
type Priority = (typeof PRIORITIES)[number];
type Status = (typeof STATUSES)[number];

const PRIO_LABEL: Record<string, string> = {
  critico: "Critico",
  alto: "Alto",
  medio: "Medio",
  normal: "Medio",
};
const PRIO_COLOR: Record<string, string> = {
  critico: "#ff5560",
  alto: "#f5a524",
  medio: "#3ddc84",
  normal: "#3ddc84",
};
const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
};

const GRANDE_RECIFE_CENTER: [number, number] = [-8.0476, -34.877];

interface BaseInfo {
  id: string;
  name?: string;
  nome?: string;
  city?: string;
  coverage_cities?: string[];
  latitude?: number;
  longitude?: number;
}

const DEFAULT_BASE: BaseInfo = {
  id: "base-central",
  name: "Base Central",
  city: "Grande Recife",
  latitude: GRANDE_RECIFE_CENTER[0],
  longitude: GRANDE_RECIFE_CENTER[1],
};

const COVERAGE_BY_BASE: Record<
  string,
  { label: string; center: [number, number]; areas: CoverageArea[] }
> = {
  "base-central": {
    label: "Grande Recife",
    center: GRANDE_RECIFE_CENTER,
    areas: [
      {
        id: "grande-recife-core",
        label: "Cobertura metropolitana",
        color: "#3ddc84",
        points: [
          [-7.72, -34.86],
          [-7.775, -34.79],
          [-7.86, -34.77],
          [-7.955, -34.765],
          [-8.055, -34.79],
          [-8.17, -34.83],
          [-8.285, -34.905],
          [-8.315, -35.005],
          [-8.245, -35.105],
          [-8.13, -35.18],
          [-8.005, -35.16],
          [-7.9, -35.08],
          [-7.815, -34.99],
        ],
      },
      {
        id: "recife",
        label: "Recife",
        color: "#57e39b",
        points: [
          [-7.945, -34.875],
          [-7.995, -34.835],
          [-8.055, -34.845],
          [-8.105, -34.895],
          [-8.085, -34.97],
          [-8.02, -35.02],
          [-7.955, -34.985],
          [-7.925, -34.925],
        ],
      },
      {
        id: "olinda-paulista",
        label: "Olinda e Paulista",
        color: "#78e6ad",
        points: [
          [-7.74, -34.85],
          [-7.805, -34.79],
          [-7.9, -34.8],
          [-7.96, -34.86],
          [-7.93, -34.94],
          [-7.835, -34.98],
          [-7.765, -34.93],
        ],
      },
      {
        id: "jaboatao-camaragibe",
        label: "Jaboatao, Camaragibe e entorno",
        color: "#2bcf79",
        points: [
          [-8.025, -34.96],
          [-8.095, -34.88],
          [-8.205, -34.895],
          [-8.27, -34.985],
          [-8.225, -35.09],
          [-8.095, -35.13],
          [-7.995, -35.06],
        ],
      },
    ],
  },
};

function coverageForBase(baseId?: string, base?: BaseInfo) {
  const baseCoordinate = coordinateForBase(base);
  if (baseCoordinate) {
    const label = base?.name || base?.nome || base?.city || base.id;
    return {
      label,
      center: baseCoordinate,
      areas: [createCircularCoverageArea(base.id, label, baseCoordinate)],
    };
  }
  return COVERAGE_BY_BASE[baseId || ""] || COVERAGE_BY_BASE["base-central"];
}

function coordinateForBase(base?: BaseInfo): [number, number] | null {
  const lat = Number(base?.latitude);
  const lng = Number(base?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function normPrio(p: any): Priority {
  const v = String(p || "medio").toLowerCase();
  if (v === "critico" || v === "critico") return "critico";
  if (v === "alto") return "alto";
  return "medio";
}
function normStatus(s: any): Status {
  const v = String(s || "aberta").toLowerCase();
  if (v.includes("anda")) return "em_andamento";
  if (v.includes("encer") || v === "closed") return "encerrada";
  return "aberta";
}

function MapPage() {
  const { profile } = useAuth();
  const [bases, setBases] = useState<BaseInfo[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<string>(profile?.base_id || DEFAULT_BASE.id);
  const [items, setItems] = useState<any[]>([]);
  const [teams, setTeams] = useState<TeamMarker[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [prioFilter, setPrioFilter] = useState<Set<Priority>>(new Set(PRIORITIES));
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(
    new Set(["aberta", "em_andamento"]),
  );
  const [showTeams, setShowTeams] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [recenterToken, setRecenterToken] = useState(0);
  const [localCoverageAreas, setLocalCoverageAreas] = useState<CoverageArea[]>([]);
  const [coverageNotice, setCoverageNotice] = useState("");
  const prevIdsRef = useRef<Set<string>>(new Set());

  const baseOptions = bases.length ? bases : [DEFAULT_BASE];
  const selectedBase = baseOptions.find((base) => base.id === selectedBaseId);
  const selectedCoverage = useMemo(
    () => coverageForBase(selectedBaseId, selectedBase),
    [selectedBaseId, selectedBase],
  );
  const selectedCoverageCities = useMemo(
    () =>
      selectedBase?.coverage_cities?.length
        ? selectedBase.coverage_cities
        : selectedBase?.city
          ? [selectedBase.city]
          : ["Recife", "Olinda", "Jaboatao dos Guararapes", "Paulista"],
    [selectedBase],
  );
  const selectedCoverageCitiesKey = selectedCoverageCities.join("|");
  const mapCoverageAreas = localCoverageAreas.length ? localCoverageAreas : selectedCoverage.areas;

  const baseCenter: [number, number] = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const occurrenceId = params.get("occurrence_id");
    const focus = params.get("focus");
    if (focus !== "history" && occurrenceId && Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng];
    }
    const selectedBase = bases.find((b) => b.id === selectedBaseId);
    const selectedBaseCoord = coordinateForBase(selectedBase);
    if (selectedBaseCoord) return selectedBaseCoord;
    const b: any = (profile as any)?.base;
    const profileBaseCoord = coordinateForBase(b);
    if (profileBaseCoord) return profileBaseCoord;
    return selectedCoverage.center;
  }, [bases, profile, selectedBaseId, selectedCoverage.center]);
  const [center, setCenter] = useState<[number, number]>(baseCenter);

  const auditFocus = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("focus") !== "history") return null;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const outcome = params.get("outcome") === "failure" ? "failure" : "success";
    const title = params.get("title") || "Ocorrencia auditada";
    const id = params.get("occurrence_id") || `audit-${lat}-${lng}`;
    return {
      id,
      lat,
      lng,
      title,
      description: "Localizacao historica da operacao",
      priority: outcome === "failure" ? "critico" : "medio",
      status: "encerrada",
      outcome: outcome as "success" | "failure",
      latitude: lat,
      longitude: lng,
      titulo: title,
      endereco: params.get("address") || "",
    };
  }, []);

  useEffect(() => {
    if (profile?.base_id) setSelectedBaseId(profile.base_id);
  }, [profile?.base_id]);

  const focusBase = (baseId = selectedBaseId) => {
    const selectedBase = bases.find((b) => b.id === baseId);
    const fallback = coverageForBase(baseId, selectedBase).center;
    const next: [number, number] = coordinateForBase(selectedBase) || fallback;
    setCenter(next);
    setRecenterToken((v) => v + 1);
  };

  const loadBases = useCallback(async () => {
    try {
      const res = await api<BaseInfo[]>("/bases");
      const arr = Array.isArray(res) ? res : [];
      setBases(arr);
      setSelectedBaseId((current) =>
        arr.find((base) => base.id === current) || !arr[0]?.id ? current : arr[0].id,
      );
    } catch {
      setBases([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<any[]>("/occurrences", { query: { status: "active" } });
      const arr = Array.isArray(res) ? res.map(normalizeOccurrence) : [];
      // detect newly arrived
      const newIds = new Set(arr.map((i) => i.id || i.occurrence_id));
      const prev = prevIdsRef.current;
      const fresh = [...newIds].find((id) => !prev.has(id));
      if (prev.size > 0 && fresh) {
        setNewId(fresh as string);
        setTimeout(() => setNewId(null), 1200);
      }
      prevIdsRef.current = newIds as Set<string>;
      setItems(arr);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeams = useCallback(async () => {
    try {
      const res = await api<any[]>("/operators", { query: { base_id: profile?.base_id } });
      const arr = Array.isArray(res) ? res.map(normalizeOperator) : [];
      setTeams(
        arr
          .filter((o) => o.latitude && o.longitude)
          .map((o) => ({
            id: o.id || o.operator_id,
            lat: Number(o.latitude),
            lng: Number(o.longitude),
            label: o.nome || o.name || o.callsign,
          })),
      );
    } catch {
      setTeams([]);
    }
  }, [profile?.base_id]);

  useEffect(() => {
    loadBases();
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, loadBases]);

  useEffect(() => {
    if (showTeams) loadTeams();
  }, [loadTeams, showTeams]);

  useEffect(() => {
    let cancelled = false;
    setCoverageNotice("Carregando fronteiras locais...");
    loadLocalCoverageAreasForCities(selectedCoverageCities)
      .then((areas) => {
        if (cancelled) return;
        setLocalCoverageAreas(areas);
        setCoverageNotice(
          areas.length
            ? "Fronteiras municipais locais ativas."
            : "Cobertura estimada localmente a partir da coordenada da base.",
        );
      })
      .catch(() => {
        if (cancelled) return;
        setLocalCoverageAreas([]);
        setCoverageNotice("Cobertura estimada localmente a partir da coordenada da base.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCoverageCities, selectedCoverageCitiesKey]);

  useEffect(() => {
    setCenter(baseCenter);
  }, [baseCenter]);

  useEffect(() => {
    if (!items.length) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("occurrence_id");
    if (!id) return;
    const item = items.find((i) => (i.id || i.occurrence_id) === id);
    if (item) setSelected(item);
  }, [items]);

  const markers: MapMarker[] = useMemo(
    () =>
      items
        .filter((i) => i.latitude && i.longitude)
        .map((i) => ({
          id: i.id || i.occurrence_id,
          lat: Number(i.latitude),
          lng: Number(i.longitude),
          title: i.titulo || i.title,
          description: i.endereco || i.descricao,
          priority: normPrio(i.prioridade || i.priority),
          status: normStatus(i.status),
        }))
        .filter((m) => prioFilter.has(m.priority as Priority))
        .filter((m) => statusFilter.has(m.status as Status)),
    [items, prioFilter, statusFilter],
  );

  const mapMarkers = useMemo(() => {
    if (!auditFocus) return markers;
    const withoutDuplicatePulse = markers.filter((marker) => {
      if (marker.id === auditFocus.id) return false;
      return (
        Math.abs(Number(marker.lat) - auditFocus.lat) > 0.00001 ||
        Math.abs(Number(marker.lng) - auditFocus.lng) > 0.00001
      );
    });
    return [...withoutDuplicatePulse, auditFocus];
  }, [markers, auditFocus]);

  const selectedId = selected ? selected.id || selected.occurrence_id : auditFocus?.id || null;

  const togglePrio = (p: Priority) => {
    const next = new Set(prioFilter);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setPrioFilter(next);
  };
  const toggleStatus = (s: Status) => {
    const next = new Set(statusFilter);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setStatusFilter(next);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!pickMode) return;
    setPicked({ lat, lng });
  };

  const confirmPicked = async () => {
    if (!picked) return;
    try {
      await navigator.clipboard?.writeText(`${picked.lat.toFixed(6)}, ${picked.lng.toFixed(6)}`);
    } catch {
      // Clipboard access is optional in restricted browsers.
    }
    setPickMode(false);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { critico: 0, alto: 0, medio: 0 };
    items.forEach((i) => {
      const p = normPrio(i.prioridade || i.priority);
      c[p] = (c[p] || 0) + 1;
    });
    return c;
  }, [items]);

  return (
    <div className="relative grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_340px] md:grid-rows-1">
      {/* Map */}
      <div className="relative md:col-start-1 md:row-start-1">
        <OccurrenceMap
          markers={mapMarkers}
          teams={teams}
          showTeams={showTeams}
          selectedId={selectedId}
          newId={newId}
          pickMode={pickMode}
          pickedCoord={picked}
          onSelect={(m) =>
            setSelected(items.find((i) => (i.id || i.occurrence_id) === m.id) || auditFocus)
          }
          onMapClick={handleMapClick}
          center={center}
          recenterToken={recenterToken}
          coverageAreas={mapCoverageAreas}
          focusAnimation={
            auditFocus
              ? {
                  target: [auditFocus.lat, auditFocus.lng],
                  startZoom: 12,
                  endZoom: 17,
                  token: auditFocus.id,
                }
              : undefined
          }
          zoom={13}
        />

        {/* Top status strip */}
        <div className="pointer-events-none absolute left-14 right-3 top-3 z-[400] flex flex-wrap gap-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-surface/85 px-2.5 py-1.5 text-[11px] backdrop-blur">
            <span className="font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Ocorrencias
            </span>
            {PRIORITIES.map((p) => (
              <span key={p} className="flex items-center gap-1 font-mono">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: PRIO_COLOR[p], boxShadow: `0 0 6px ${PRIO_COLOR[p]}` }}
                />
                {counts[p] || 0}
              </span>
            ))}
          </div>
          <label className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-surface/85 px-2.5 py-1.5 text-[11px] backdrop-blur">
            <span className="font-mono uppercase tracking-[0.2em] text-muted-foreground">Base</span>
            <select
              value={selectedBaseId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedBaseId(value);
                const selectedBase = bases.find((b) => b.id === value);
                setCenter(
                  coordinateForBase(selectedBase) || coverageForBase(value, selectedBase).center,
                );
                setRecenterToken((v) => v + 1);
              }}
              className="max-w-[180px] bg-transparent text-foreground outline-none"
            >
              {baseOptions.map((base) => (
                <option key={base.id} value={base.id} className="bg-surface text-foreground">
                  {base.name || base.nome || base.id}
                  {base.city ? ` - ${base.city}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-[11px] text-primary backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
            Cobertura {selectedBase?.name || selectedCoverage.label}
          </div>
          {pickMode && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-primary/60 bg-primary/10 px-2.5 py-1.5 text-[11px] text-primary backdrop-blur">
              <Crosshair className="h-3.5 w-3.5" />
              Clique no mapa para marcar coordenada
              {picked && (
                <button
                  onClick={confirmPicked}
                  className="ml-2 flex items-center gap-1 rounded border border-primary/60 px-1.5 py-0.5 hover:bg-primary/20"
                >
                  <Check className="h-3 w-3" /> Confirmar
                </button>
              )}
              <button
                onClick={() => {
                  setPickMode(false);
                  setPicked(null);
                }}
                className="rounded hover:bg-primary/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Control cluster - bottom right */}
        <div className="absolute bottom-4 right-3 z-[400] flex flex-col gap-2">
          <ControlBtn label="Centralizar na base" onClick={() => focusBase()}>
            <Crosshair className="h-4 w-4" />
          </ControlBtn>
          <ControlBtn label="Atualizar" onClick={load}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </ControlBtn>
          <ControlBtn
            label="Equipes em campo"
            active={showTeams}
            onClick={() => setShowTeams((v) => !v)}
          >
            <Users className="h-4 w-4" />
          </ControlBtn>
          <ControlBtn
            label="Nova ocorrencia (selecionar coord.)"
            active={pickMode}
            onClick={() => {
              setPickMode((v) => !v);
              setPicked(null);
            }}
          >
            <Plus className="h-4 w-4" />
          </ControlBtn>
          <ControlBtn
            label="Filtros"
            active={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Filter className="h-4 w-4" />
          </ControlBtn>
        </div>

        {/* Filters panel */}
        {filtersOpen && (
          <div className="absolute bottom-4 right-16 z-[400] w-60 rounded-md border border-border bg-surface/95 p-3 text-xs shadow-xl backdrop-blur">
            <div className="mb-2 font-mono uppercase tracking-[0.18em] text-muted-foreground">
              Prioridade
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => {
                const on = prioFilter.has(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePrio(p)}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-1 ${on ? "border-border bg-surface-2 text-foreground" : "border-border/50 text-muted-foreground"}`}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        background: PRIO_COLOR[p],
                        boxShadow: on ? `0 0 6px ${PRIO_COLOR[p]}` : "none",
                      }}
                    />
                    {PRIO_LABEL[p]}
                  </button>
                );
              })}
            </div>
            <div className="mb-2 font-mono uppercase tracking-[0.18em] text-muted-foreground">
              Status
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => {
                const on = statusFilter.has(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    className={`rounded-full border px-2 py-1 ${on ? "border-border bg-surface-2 text-foreground" : "border-border/50 text-muted-foreground"}`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend bottom-left */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex items-center gap-3 rounded-md border border-border bg-surface/80 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
          {PRIORITIES.map((p) => (
            <span key={p} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: PRIO_COLOR[p], boxShadow: `0 0 8px ${PRIO_COLOR[p]}` }}
              />
              {PRIO_LABEL[p]}
            </span>
          ))}
        </div>
      </div>

      {/* Side panel */}
      <aside className="flex min-h-0 flex-col border-t border-border bg-surface md:border-l md:border-t-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
            Ocorrencias - {markers.length}/{items.length}
          </div>
        </div>

        <div className="border-b border-border bg-background p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Cidades cobertas
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedCoverageCities.map((city) => (
              <span
                key={city}
                className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
              >
                {city}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {coverageNotice || "Cobertura estimada localmente a partir da coordenada da base."}
          </div>
        </div>

        {selected ? (
          <div className="relative border-b border-border bg-background p-3">
            <button
              onClick={() => setSelected(null)}
              className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  background: PRIO_COLOR[normPrio(selected.prioridade || selected.priority)],
                  boxShadow: `0 0 10px ${PRIO_COLOR[normPrio(selected.prioridade || selected.priority)]}`,
                }}
              />
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                {PRIO_LABEL[normPrio(selected.prioridade || selected.priority)]} -{" "}
                {STATUS_LABEL[normStatus(selected.status)]}
              </div>
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {selected.titulo || selected.title || "Ocorrencia"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {selected.endereco || selected.descricao || selected.description || "Sem descricao."}
            </div>
            <div className="mt-2 font-mono text-[11px] text-muted-foreground">
              {Number(selected.latitude).toFixed(5)}, {Number(selected.longitude).toFixed(5)}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setCenter([Number(selected.latitude), Number(selected.longitude)])}
                className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] text-foreground hover:border-primary/60 hover:text-primary"
              >
                <Crosshair className="h-3 w-3" /> Focar no mapa
              </button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {markers.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">
              Nenhuma ocorrencia corresponde aos filtros.
            </div>
          )}
          <ul className="divide-y divide-border">
            {markers.map((m) => {
              const i = items.find((it) => (it.id || it.occurrence_id) === m.id);
              const isSel = selectedId === m.id;
              const c = PRIO_COLOR[m.priority as string];
              return (
                <li key={m.id}>
                  <button
                    onClick={() => setSelected(i)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-2 ${isSel ? "bg-surface-2" : ""}`}
                  >
                    <span
                      className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: c, boxShadow: `0 0 8px ${c}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{m.title || "Ocorrencia"}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {m.description || "-"}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                        <span>{PRIO_LABEL[m.priority as string]}</span>
                        <span>-</span>
                        <span>{STATUS_LABEL[m.status as string]}</span>
                      </div>
                    </div>
                    <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function ControlBtn({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group relative grid h-10 w-10 place-items-center rounded-md border bg-surface/90 backdrop-blur transition ${
        active
          ? "border-primary/60 text-primary shadow-[0_0_18px_color-mix(in_oklch,var(--color-primary)_30%,transparent)]"
          : "border-border text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      {children}
      <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground opacity-0 transition group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}
