import { describe, expect, it } from "vitest";
import {
  createCircularCoverageArea,
  loadLocalCoverageAreasForCities,
  normalizeCityName,
} from "./geo";

describe("geo utilities", () => {
  it("normalizes city names without depending on external services", () => {
    expect(normalizeCityName("Jaboatao dos Guararapes")).toBe("jaboatao dos guararapes");
    expect(normalizeCityName("S\u00e3o Louren\u00e7o da Mata")).toBe("sao lourenco da mata");
  });

  it("creates a predictable local coverage polygon around a base coordinate", () => {
    const area = createCircularCoverageArea("base-recife", "Base Recife", [-8.0476, -34.877]);
    expect(area.id).toBe("coverage-base recife");
    expect(area.label).toBe("Base Recife");
    expect(area.points).toHaveLength(40);
    expect(area.points[0][0]).toBeCloseTo(-8.0476, 3);
  });

  it("loads local municipality boundaries for covered cities", async () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-34.9, -8.1],
                [-34.8, -8.1],
                [-34.8, -8.0],
                [-34.9, -8.1],
              ],
            ],
          },
          properties: {
            id: "2611606",
            name: "Recife",
            normalized_name: "recife",
            uf: "PE",
          },
        },
      ],
    };
    const fetcher = async () =>
      ({
        ok: true,
        json: async () => geojson,
      }) as Response;

    const areas = await loadLocalCoverageAreasForCities(["Recife"], fetcher);

    expect(areas).toHaveLength(1);
    expect(areas[0].label).toBe("Recife");
    expect(areas[0].points[0]).toEqual([-8.1, -34.9]);
  });
});
