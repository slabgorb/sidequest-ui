import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ReconnectBanner } from "../ReconnectBanner";

// Story 37-26 — ReconnectBanner is a pure presentational component.
// The "are we actually reconnecting?" logic lives in useWebSocket and is
// threaded through useGameSocket as `isReconnecting`. This suite tests the
// render contract only; the semantics (first-load silence, intentional-close
// silence) are tested in useWebSocket-isReconnecting.test.ts.

describe("ReconnectBanner (37-26)", () => {
  it("renders nothing when visible is false", () => {
    const { container } = render(<ReconnectBanner visible={false} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('renders "Reconnecting..." when visible is true', () => {
    render(<ReconnectBanner visible={true} />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });

  it("exposes role=status / live region for a11y", () => {
    render(<ReconnectBanner visible={true} />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent(/reconnecting/i);
  });

  it("toggles cleanly on prop flip", () => {
    const { rerender } = render(<ReconnectBanner visible={false} />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<ReconnectBanner visible={true} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(<ReconnectBanner visible={false} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
