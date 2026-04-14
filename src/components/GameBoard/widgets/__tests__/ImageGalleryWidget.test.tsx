/**
 * ImageGalleryWidget wiring — verifies the widget consumes useImageBus() and
 * delegates rendering to ScrapbookGallery.
 *
 * Story 33-17: the widget is a thin adapter that pulls images from the
 * context and hands them to the pure presentational ScrapbookGallery.
 *
 * Per CLAUDE.md: "Every test suite needs a wiring test that verifies the
 * component is wired into the system — imported, called, and reachable from
 * production code paths."
 */
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ImageGalleryWidget } from "../ImageGalleryWidget";

describe("ImageGalleryWidget wiring", () => {
  it("renders the Scrapbook empty state when the image bus is empty", () => {
    // Default context value has no images — widget should fall through to
    // ScrapbookGallery empty state.
    const { getByTestId } = render(<ImageGalleryWidget />);
    expect(getByTestId("scrapbook-empty")).toBeInTheDocument();
  });

  it("imports ScrapbookGallery from the widgets directory", async () => {
    const src = (await import("../ImageGalleryWidget.tsx?raw")) as unknown as {
      default: string;
    };
    expect(src.default).toContain("ScrapbookGallery");
    // Hook delegation must remain in place — the widget owns the context
    // read, ScrapbookGallery is pure.
    expect(src.default).toContain("useImageBus");
  });

  it("widgetRegistry labels the gallery tab 'Scrapbook'", async () => {
    const mod = await import("@/components/GameBoard/widgetRegistry");
    expect(mod.WIDGET_REGISTRY.gallery.label).toBe("Scrapbook");
  });
});
