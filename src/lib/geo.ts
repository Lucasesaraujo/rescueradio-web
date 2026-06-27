import type { CoverageArea } from "@/components/OccurrenceMap";

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
