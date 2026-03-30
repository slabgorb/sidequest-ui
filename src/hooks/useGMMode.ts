import { useState, useEffect, useCallback } from "react";

export function useGMMode(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("gm") === "true";
  });

  const toggle = useCallback(() => setEnabled((prev) => !prev), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+G / Cmd+Shift+G or Ctrl+Shift+` / Cmd+Shift+`
      // Supports both Ctrl (Windows/Linux) and Cmd (macOS)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "G" || e.key === "`")) {
        e.preventDefault();
        setEnabled((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return [enabled, toggle];
}
