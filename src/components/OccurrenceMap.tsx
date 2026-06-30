import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  description?: string;
  priority?: "critico" | "alto" | "medio" | "normal" | string;
  status?: string;
  isNew?: boolean;
  outcome?: "success" | "failure";
}

export interface TeamMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface CoverageArea {
  id: string;
  label: string;
  points: [number, number][];
  color?: string;
}

const COLOR: Record<string, string> = {
  critico: "#ff5560",
  alto: "#f5a524",
  medio: "#3ddc84",
  normal: "#3ddc84",
};

function beaconIcon(priority: string, selected: boolean, isNew: boolean) {
  const color = COLOR[priority] || COLOR.normal;
  const cls = [
    "rr-beacon",
    `prio-${priority || "normal"}`,
    selected ? "selected" : "",
    isNew ? "new" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const size = priority === "medio" || priority === "normal" ? 44 : 54;
  return L.divIcon({
    className: "",
    html: `<div class="rr-beacon-wrap"><div class="${cls}" style="--rr-c:${color}"><div class="pulse"></div><div class="pulse delay"></div><div class="core"></div></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function auditIcon(outcome: "success" | "failure", selected: boolean) {
  const success = outcome === "success";
  const cls = ["rr-audit-pin", success ? "success" : "failure", selected ? "selected" : ""]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "",
    html: `<div class="${cls}"><div class="rr-audit-stem"></div><div class="rr-audit-core"><span>${success ? "&#10003;" : "X"}</span></div></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
  });
}

const pickIcon = L.divIcon({
  className: "",
  html: `<div class="rr-pick"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const teamIcon = L.divIcon({
  className: "",
  html: `<div class="rr-team"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Dark, monochrome tiles - Carto Dark Matter (free, no key)
const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const LABELS_URL = "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png";
const ATTRIB = "&copy; OpenStreetMap &copy; CARTO";

interface Props {
  markers: MapMarker[];
  teams?: TeamMarker[];
  showTeams?: boolean;
  selectedId?: string | null;
  newId?: string | null;
  onSelect?: (m: MapMarker) => void;
  onMapClick?: (lat: number, lng: number) => void;
  pickedCoord?: { lat: number; lng: number } | null;
  pickMode?: boolean;
  center?: [number, number];
  recenterToken?: number;
  coverageAreas?: CoverageArea[];
  focusAnimation?: {
    target: [number, number];
    startZoom?: number;
    endZoom?: number;
    token: string;
  };
  zoom?: number;
  className?: string;
}

export function OccurrenceMap({
  markers,
  teams = [],
  showTeams = false,
  selectedId,
  newId,
  onSelect,
  onMapClick,
  pickedCoord,
  pickMode = false,
  center = [-8.0476, -34.877],
  recenterToken = 0,
  coverageAreas = [],
  focusAnimation,
  zoom = 12,
  className,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const coverageLayerRef = useRef<L.LayerGroup | null>(null);
  const teamLayerRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef<L.Marker | null>(null);
  const clickRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);
  const lastFocusTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    }).setView(center, zoom);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIB, subdomains: "abcd" }).addTo(map);
    L.tileLayer(LABELS_URL, {
      maxZoom: 19,
      attribution: "",
      subdomains: "abcd",
      opacity: 0.55,
      pane: "shadowPane",
    }).addTo(map);
    coverageLayerRef.current = L.layerGroup().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    teamLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 60);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // click handler binding
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (clickRef.current) map.off("click", clickRef.current);
    if (onMapClick) {
      const fn = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng);
      clickRef.current = fn;
      map.on("click", fn);
    }
    const el = map.getContainer();
    el.style.cursor = pickMode ? "crosshair" : "";
  }, [onMapClick, pickMode]);

  // re-center when prop changes meaningfully
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView(center, map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], recenterToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusAnimation || lastFocusTokenRef.current === focusAnimation.token) return;
    lastFocusTokenRef.current = focusAnimation.token;
    const startZoom = focusAnimation.startZoom ?? 12;
    const endZoom = focusAnimation.endZoom ?? 17;
    map.setView(focusAnimation.target, startZoom, { animate: false });
    window.setTimeout(() => {
      map.flyTo(focusAnimation.target, endZoom, { animate: true, duration: 1.7 });
    }, 250);
  }, [focusAnimation]);

  const coverageSig = useMemo(
    () =>
      coverageAreas
        .map((a) => `${a.id}:${a.color || ""}:${a.points.map((p) => p.join(",")).join(";")}`)
        .join("|"),
    [coverageAreas],
  );

  useEffect(() => {
    const layer = coverageLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    coverageAreas.forEach((area) => {
      const color = area.color || "#3ddc84";
      L.polygon(area.points, {
        color,
        weight: 1.6,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.13,
        dashArray: "7 8",
        className: "rr-coverage",
        interactive: false,
      }).addTo(layer);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverageSig]);

  const sig = useMemo(
    () =>
      markers
        .map((m) => `${m.id}:${m.lat}:${m.lng}:${m.priority}:${m.status}:${m.outcome || ""}`)
        .join("|"),
    [markers],
  );

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markers.forEach((m) => {
      const selected = selectedId === m.id;
      const isNew = newId === m.id || !!m.isNew;
      const marker = L.marker([m.lat, m.lng], {
        icon: m.outcome
          ? auditIcon(m.outcome, selected)
          : beaconIcon(String(m.priority || "normal"), selected, isNew),
        riseOnHover: true,
        zIndexOffset: m.outcome ? 1200 : selected ? 1000 : m.priority === "critico" ? 500 : 0,
      });
      marker.on("click", () => onSelect?.(m));
      marker.addTo(layer);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, selectedId, newId]);

  useEffect(() => {
    const layer = teamLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showTeams) return;
    teams.forEach((t) => {
      const m = L.marker([t.lat, t.lng], { icon: teamIcon });
      if (t.label)
        m.bindTooltip(t.label, { direction: "top", offset: [0, -8], className: "rr-tt" });
      m.addTo(layer);
    });
  }, [teams, showTeams]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickRef.current) {
      pickRef.current.remove();
      pickRef.current = null;
    }
    if (pickedCoord) {
      pickRef.current = L.marker([pickedCoord.lat, pickedCoord.lng], { icon: pickIcon }).addTo(map);
    }
  }, [pickedCoord]);

  return <div ref={elRef} className={className || "h-full w-full"} />;
}
