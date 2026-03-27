import { useState, useEffect, useCallback } from "react";

export function useGMMode(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("gm") === "true";
  });

  const toggle = useCallback(() => setEnabled((prev) => !prev), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+G or Ctrl+Shift+` (backtick) — two shortcuts because
      // Ctrl+Shift+G conflicts with "Find Previous" in some browsers
      if (e.ctrlKey && e.shiftKey && (e.key === "G" || e.key === "`")) {
        e.preventDefault();
        setEnabled((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return [enabled, toggle];
}
