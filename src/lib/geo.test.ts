import { describe, expect, it } from "vitest";
import { createCircularCoverageArea, normalizeCityName } from "./geo";

describe("geo utilities", () => {
  it("normalizes city names without depending on external services", () => {
    expect(normalizeCityName("Jaboatao dos Guararapes")).toBe("jaboatao dos guararapes");
    expect(normalizeCityName("São Lourenço da Mata")).toBe("sao lourenco da mata");
  });

  it("creates a predictable local coverage polygon around a base coordinate", () => {
    const area = createCircularCoverageArea("base-recife", "Base Recife", [-8.0476, -34.877]);
    expect(area.id).toBe("coverage-base recife");
    expect(area.label).toBe("Base Recife");
    expect(area.points).toHaveLength(40);
    expect(area.points[0][0]).toBeCloseTo(-8.0476, 3);
  });
});
