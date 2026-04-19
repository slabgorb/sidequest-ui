import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ReconnectBanner } from "../ReconnectBanner";

// RED tests for story 37-26 — ReconnectBanner component does not yet exist.
// AC-4: "Reconnecting..." banner visible when readyState !== WebSocket.OPEN.

describe("ReconnectBanner (37-26)", () => {
  it("renders nothing when readyState is OPEN", () => {
    const { container } = render(<ReconnectBanner readyState={WebSocket.OPEN} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Reconnecting..." when readyState is CONNECTING', () => {
    render(<ReconnectBanner readyState={WebSocket.CONNECTING} />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });

  it('shows "Reconnecting..." when readyState is CLOSED', () => {
    render(<ReconnectBanner readyState={WebSocket.CLOSED} />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });

  it('shows "Reconnecting..." when readyState is CLOSING', () => {
    render(<ReconnectBanner readyState={WebSocket.CLOSING} />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });

  it("exposes a role=status / live region for a11y", () => {
    render(<ReconnectBanner readyState={WebSocket.CLOSED} />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent(/reconnecting/i);
  });
});
