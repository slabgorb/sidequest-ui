import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OfflineBanner } from "../OfflineBanner";

describe("OfflineBanner", () => {
  it("renders nothing when online", () => {
    const { container } = render(<OfflineBanner offline={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the read-only notice when offline", () => {
    render(<OfflineBanner offline={true} />);
    const banner = screen.getByTestId("offline-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/narrator unreachable/i);
    expect(banner.textContent).toMatch(/read-only/i);
  });
});
