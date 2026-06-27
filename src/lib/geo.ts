import type { CoverageArea } from "@/components/OccurrenceMap";

const LOCAL_BOUNDARY_FILES = [
  "/geo/municipios-pe.json",
  "/geo/municipios-ba.json",
  "/geo/municipios-ce.json",
];
const boundaryCache = new Map<string, Promise<any>>();
let municipalityIndexCache: Promise<MunicipalitySearchResult[]> | null = null;

export interface MunicipalitySearchResult {
  id: string;
  name: string;
  normalizedName: string;
  uf: string;
  state?: string;
  latitude: number;
  longitude: number;
}

export function normalizeCityName(city: string) {
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createCircularCoverageArea(
  id: string,
  label: string,
  center: [number, number],
  radiusKm = 12,
  color = "#3ddc84",
): CoverageArea {
  const [lat, lng] = center;
  const points: [number, number][] = [];
  const steps = 40;
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    points.push([lat + Math.sin(angle) * latDelta, lng + Math.cos(angle) * lngDelta]);
  }

  return {
    id: `coverage-${normalizeCityName(id)}`,
    label,
    color,
    points,
  };
}

function geoJsonToCoverageAreas(geojson: any, wantedCities: Set<string>): CoverageArea[] {
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  const areas: CoverageArea[] = [];

  features.forEach((feature: any) => {
    const properties = feature?.properties || {};
    const name = String(properties.name || properties.nome || properties.id || "");
    const normalized = normalizeCityName(properties.normalized_name || name);
    if (!wantedCities.has(normalized)) return;

    const geometry = feature?.geometry;
    const polygons =
      geometry?.type === "Polygon"
        ? [geometry.coordinates]
        : geometry?.type === "MultiPolygon"
          ? geometry.coordinates
          : [];

    polygons.forEach((polygon: any, polygonIndex: number) => {
      const outerRing = polygon?.[0];
      if (!Array.isArray(outerRing) || outerRing.length < 3) return;
      const points = outerRing
        .map((coord: any) => [Number(coord[1]), Number(coord[0])] as [number, number])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
      if (points.length < 3) return;

      areas.push({
        id: `municipio-${properties.uf || "br"}-${properties.id || normalized}-${polygonIndex}`,
        label: name,
        color: "#3ddc84",
        points,
      });
    });
  });

  return areas;
}

async function loadBoundaryFile(path: string, fetcher: typeof fetch) {
  if (fetcher !== fetch) {
    const response = await fetcher(path);
    if (!response.ok) throw new Error(`Boundary asset failed: ${path}`);
    return response.json();
  }
  if (!boundaryCache.has(path)) {
    boundaryCache.set(
      path,
      fetcher(path).then((response) => {
        if (!response.ok) throw new Error(`Boundary asset failed: ${path}`);
        return response.json();
      }),
    );
  }
  return boundaryCache.get(path)!;
}

function titleFromNormalizedName(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readableMunicipalityName(properties: any) {
  const raw = String(properties.name || properties.nome || "");
  if (raw && !raw.includes("Ã")) return raw;
  return titleFromNormalizedName(String(properties.normalized_name || raw || properties.id || ""));
}

function collectGeometryCoordinates(node: any, output: Array<[number, number]>) {
  if (!Array.isArray(node)) return;
  if (node.length >= 2 && typeof node[0] === "number" && typeof node[1] === "number") {
    const lng = Number(node[0]);
    const lat = Number(node[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) output.push([lat, lng]);
    return;
  }
  node.forEach((child) => collectGeometryCoordinates(child, output));
}

function centerFromGeometry(geometry: any): [number, number] | null {
  const points: Array<[number, number]> = [];
  collectGeometryCoordinates(geometry?.coordinates, points);
  if (!points.length) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  points.forEach(([lat, lng]) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  });

  if (![minLat, maxLat, minLng, maxLng].every(Number.isFinite)) return null;
  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
}

function geoJsonToMunicipalities(geojson: any): MunicipalitySearchResult[] {
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  return features
    .map((feature: any) => {
      const properties = feature?.properties || {};
      const normalizedName = normalizeCityName(properties.normalized_name || properties.name || "");
      const center = centerFromGeometry(feature?.geometry);
      if (!normalizedName || !center) return null;
      return {
        id: String(properties.id || `${properties.uf || "BR"}-${normalizedName}`),
        name: readableMunicipalityName(properties),
        normalizedName,
        uf: String(properties.uf || "").toUpperCase(),
        state: properties.state,
        latitude: center[0],
        longitude: center[1],
      } satisfies MunicipalitySearchResult;
    })
    .filter(Boolean) as MunicipalitySearchResult[];
}

async function loadLocalMunicipalityIndex(fetcher: typeof fetch = fetch) {
  if (!municipalityIndexCache || fetcher !== fetch) {
    municipalityIndexCache = Promise.all(
      LOCAL_BOUNDARY_FILES.map((path) =>
        loadBoundaryFile(path, fetcher).catch(() => ({ features: [] })),
      ),
    ).then((collections) =>
      collections.flatMap(geoJsonToMunicipalities).sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  return municipalityIndexCache;
}

export async function searchLocalMunicipalities(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<MunicipalitySearchResult[]> {
  const normalizedQuery = normalizeCityName(query);
  if (normalizedQuery.length < 2) return [];
  const terms = normalizedQuery.split(" ").filter(Boolean);
  const municipalities = await loadLocalMunicipalityIndex(fetcher);

  return municipalities
    .map((city) => {
      const startsWithScore = city.normalizedName.startsWith(normalizedQuery) ? 100 : 0;
      const termScore = terms.every((term) => city.normalizedName.includes(term)) ? 50 : 0;
      const exactScore = city.normalizedName === normalizedQuery ? 200 : 0;
      return { city, score: exactScore + startsWithScore + termScore };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name))
    .slice(0, 12)
    .map((item) => item.city);
}

export async function loadLocalCoverageAreasForCities(
  cities: string[],
  fetcher: typeof fetch = fetch,
): Promise<CoverageArea[]> {
  const wantedCities = new Set(cities.map(normalizeCityName).filter(Boolean));
  if (!wantedCities.size) return [];

  const collections = await Promise.all(
    LOCAL_BOUNDARY_FILES.map((path) =>
      loadBoundaryFile(path, fetcher).catch(() => ({ features: [] })),
    ),
  );

  const areas = collections.flatMap((collection) =>
    geoJsonToCoverageAreas(collection, wantedCities),
  );
  const foundLabels = new Set(areas.map((area) => normalizeCityName(area.label)));

  return areas.filter((area, index) => {
    const key = `${normalizeCityName(area.label)}:${area.points[0]?.join(",")}`;
    return (
      foundLabels.has(normalizeCityName(area.label)) &&
      areas.findIndex(
        (candidate) =>
          `${normalizeCityName(candidate.label)}:${candidate.points[0]?.join(",")}` === key,
      ) === index
    );
  });
}
