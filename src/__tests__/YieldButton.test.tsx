import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { YieldButton } from "../components/YieldButton";

describe("YieldButton", () => {
  it("calls onYield when clicked", () => {
    const onYield = vi.fn();
    render(<YieldButton onYield={onYield} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: /yield/i }));
    expect(onYield).toHaveBeenCalledTimes(1);
  });

  it("disables when no active encounter", () => {
    const onYield = vi.fn();
    render(<YieldButton onYield={onYield} disabled />);
    fireEvent.click(screen.getByRole("button", { name: /yield/i }));
    expect(onYield).not.toHaveBeenCalled();
  });
});
