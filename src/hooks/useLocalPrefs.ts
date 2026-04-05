import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Generic hook for persisting typed client preferences to localStorage.
 *
 * @param key - localStorage key
 * @param defaults - default values (also defines the shape of T)
 * @returns [prefs, setPref] — prefs is the full object, setPref merges a partial update
 */
export function useLocalPrefs<T extends Record<string, unknown>>(
  key: string,
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const defaultsRef = useRef(defaults);

  const [prefs, setPrefs] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<T>;
      // Merge with defaults so new fields always have values
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  });

  // Persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {
      // localStorage full or unavailable — non-critical
    }
  }, [key, prefs]);

  // Sync across tabs via storage event
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return;
      try {
        const parsed = e.newValue ? (JSON.parse(e.newValue) as Partial<T>) : {};
        setPrefs({ ...defaultsRef.current, ...parsed });
      } catch {
        // ignore corrupt cross-tab data
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const setPref = useCallback(
    (patch: Partial<T>) => {
      setPrefs((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  return [prefs, setPref];
}
