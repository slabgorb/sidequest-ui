import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModePicker } from "../ModePicker";

describe("ModePicker", () => {
  it("defaults to solo", () => {
    const onChange = vi.fn();
    render(<ModePicker value="solo" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: /solo/i })).toBeChecked();
  });

  it("calls onChange('multiplayer') when user picks MP", () => {
    const onChange = vi.fn();
    render(<ModePicker value="solo" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /multiplayer/i }));
    expect(onChange).toHaveBeenCalledWith("multiplayer");
  });
});
