import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ReconnectBanner } from "../ReconnectBanner";

// Story 37-26 — ReconnectBanner behavior.
// AC-4: "Reconnecting..." banner visible when readyState !== OPEN,
// but only AFTER a first successful OPEN (B1 fix: no banner on initial load).

describe("ReconnectBanner (37-26)", () => {
  it("renders nothing on initial mount with readyState CLOSED (no prior OPEN)", () => {
    const { container } = render(<ReconnectBanner readyState={WebSocket.CLOSED} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on initial mount with readyState CONNECTING (no prior OPEN)", () => {
    const { container } = render(<ReconnectBanner readyState={WebSocket.CONNECTING} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when readyState is OPEN", () => {
    const { container } = render(<ReconnectBanner readyState={WebSocket.OPEN} />);
    expect(container.firstChild).toBeNull();
  });

  it("stays hidden through first-time connect flow (CLOSED → CONNECTING → OPEN)", () => {
    const { container, rerender } = render(<ReconnectBanner readyState={WebSocket.CLOSED} />);
    expect(container.firstChild).toBeNull();
    rerender(<ReconnectBanner readyState={WebSocket.CONNECTING} />);
    expect(container.firstChild).toBeNull();
    rerender(<ReconnectBanner readyState={WebSocket.OPEN} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows banner after OPEN → CLOSED (true reconnect)", () => {
    const { rerender } = render(<ReconnectBanner readyState={WebSocket.OPEN} />);
    rerender(<ReconnectBanner readyState={WebSocket.CLOSED} />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });

  it("shows banner after OPEN → CONNECTING (reconnect in progress)", () => {
    const { rerender } = render(<ReconnectBanner readyState={WebSocket.OPEN} />);
    rerender(<ReconnectBanner readyState={WebSocket.CONNECTING} />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });

  it("shows banner after OPEN → CLOSING", () => {
    const { rerender } = render(<ReconnectBanner readyState={WebSocket.OPEN} />);
    rerender(<ReconnectBanner readyState={WebSocket.CLOSING} />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });

  it("hides banner again once readyState returns to OPEN", () => {
    const { container, rerender } = render(<ReconnectBanner readyState={WebSocket.OPEN} />);
    rerender(<ReconnectBanner readyState={WebSocket.CLOSED} />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
    rerender(<ReconnectBanner readyState={WebSocket.OPEN} />);
    expect(container.firstChild).toBeNull();
  });

  it("exposes role=status / live region for a11y", () => {
    const { rerender } = render(<ReconnectBanner readyState={WebSocket.OPEN} />);
    rerender(<ReconnectBanner readyState={WebSocket.CLOSED} />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent(/reconnecting/i);
  });
});
