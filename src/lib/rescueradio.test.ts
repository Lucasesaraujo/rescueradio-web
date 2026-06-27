import { describe, expect, it } from "vitest";
import {
  normalizeChatMessage,
  normalizeOccurrence,
  normalizeOperation,
  normalizeProfile,
  profileToApiPayload,
} from "./rescueradio";

describe("rescueradio normalizers", () => {
  it("normalizes profile aliases and completeness", () => {
    const profile = normalizeProfile({
      nome_operacional: "Alpha",
      base_id: "base-central",
      funcao: "socorrista",
      competencias: ["APH"],
    });
    expect(profile?.operational_name).toBe("Alpha");
    expect(profile?.function).toBe("socorrista");
    expect(profile?.complete).toBe(true);
  });

  it("serializes profile payload for the API", () => {
    expect(
      profileToApiPayload({
        nome_operacional: " Bravo ",
        base_id: "base-central",
        contato: "radio 2",
        status: "disponivel",
        competencias: "APH, resgate",
      }),
    ).toEqual({
      full_name: "Bravo",
      display_name: undefined,
      callsign: undefined,
      operational_name: "Bravo",
      base_id: "base-central",
      function: "",
      contact: "radio 2",
      email: "",
      status: "disponivel",
      skills: ["APH", "resgate"],
    });
  });

  it("normalizes operation and occurrence aliases", () => {
    const operation = normalizeOperation({
      id: "op-1",
      occurrence: { title: "Colisao", type: "transito", priority: "critico" },
      members: ["ana"],
      closing_summary: "encerrada",
    });
    expect(operation.titulo).toBe("Colisao");
    expect(operation.tipo).toBe("transito");
    expect(operation.participantes).toEqual(["ana"]);
    expect(normalizeOccurrence({ endereco: "Rua A" }).address_text).toBe("Rua A");
  });

  it("normalizes chat message transport payload", () => {
    const message = normalizeChatMessage({
      usuario: "operador",
      corpo_texto: "[CRITICO] Chegando",
      timestamp_iso: "2026-06-26T10:00:00Z",
    });
    expect(message.author).toBe("operador");
    expect(message.text).toContain("Chegando");
    expect(message.timestamp).toBe("2026-06-26T10:00:00Z");
  });
});
