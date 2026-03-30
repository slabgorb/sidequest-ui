import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useGMMode } from "@/hooks/useGMMode";

// ---------------------------------------------------------------------------
// Story 3-9: GM Mode toggle hook
// ACs: Toggle works (Ctrl+Shift+G), URL activation (?gm=true)
// ---------------------------------------------------------------------------

describe("useGMMode", () => {
  let originalLocation: Location;

  beforeEach(() => {
    // Save and mock window.location for URL param tests
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, search: "" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  // =========================================================================
  // AC: Toggle works — Ctrl+Shift+G toggles GM Mode
  // =========================================================================

  it("starts disabled by default", () => {
    const { result } = renderHook(() => useGMMode());
    const [enabled] = result.current;
    expect(enabled).toBe(false);
  });

  it("toggles on with Ctrl+Shift+G", () => {
    const { result } = renderHook(() => useGMMode());
    expect(result.current[0]).toBe(false);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "G",
          ctrlKey: true,
          shiftKey: true,
        }),
      );
    });

    expect(result.current[0]).toBe(true);
  });

  it("toggles off with a second Ctrl+Shift+G", () => {
    const { result } = renderHook(() => useGMMode());

    // Toggle on
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "G",
          ctrlKey: true,
          shiftKey: true,
        }),
      );
    });
    expect(result.current[0]).toBe(true);

    // Toggle off
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "G",
          ctrlKey: true,
          shiftKey: true,
        }),
      );
    });
    expect(result.current[0]).toBe(false);
  });

  it("ignores G without Ctrl+Shift modifiers", () => {
    const { result } = renderHook(() => useGMMode());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "G" }));
    });
    expect(result.current[0]).toBe(false);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "G", ctrlKey: true }),
      );
    });
    expect(result.current[0]).toBe(false);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "G", shiftKey: true }),
      );
    });
    expect(result.current[0]).toBe(false);
  });

  it("provides a manual toggle function", () => {
    const { result } = renderHook(() => useGMMode());
    const [, toggle] = result.current;

    act(() => {
      toggle();
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(false);
  });

  // =========================================================================
  // AC: URL activation — ?gm=true opens with GM Mode active
  // =========================================================================

  it("starts enabled when ?gm=true is in the URL", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, search: "?gm=true" },
    });

    const { result } = renderHook(() => useGMMode());
    expect(result.current[0]).toBe(true);
  });

  it("starts disabled when ?gm=false is in the URL", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, search: "?gm=false" },
    });

    const { result } = renderHook(() => useGMMode());
    expect(result.current[0]).toBe(false);
  });

  it("starts disabled when no gm param in URL", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, search: "?other=param" },
    });

    const { result } = renderHook(() => useGMMode());
    expect(result.current[0]).toBe(false);
  });

  // =========================================================================
  // Cleanup: removes event listener on unmount
  // =========================================================================

  it("removes keydown listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useGMMode());

    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
