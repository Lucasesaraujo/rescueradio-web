import type { CoverageArea } from "@/components/OccurrenceMap";

const LOCAL_BOUNDARY_FILES = [
  "/geo/municipios-pe.json",
  "/geo/municipios-ba.json",
  "/geo/municipios-ce.json",
];
const boundaryCache = new Map<string, Promise<any>>();

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
