import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("uses known status labels", () => {
    render(<StatusBadge status="critico" />);
    expect(screen.getByText("Critico")).toBeInTheDocument();
  });

  it("allows explicit labels for unknown states", () => {
    render(<StatusBadge status="custom" label="Sistema online" />);
    expect(screen.getByText("Sistema online")).toBeInTheDocument();
  });
});
