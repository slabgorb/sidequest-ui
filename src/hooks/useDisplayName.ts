import { useCallback, useEffect, useState } from 'react';

// Single source of truth for the persisted display-name key. AppInner and
// ConnectScreen both mount useDisplayName instances; the custom event below
// keeps them synchronized within one tab (the native `storage` event only
// fires across tabs). Cross-tab edits still propagate via `storage`.
const KEY = 'sq:display-name';
const EVENT = 'sq:display-name-changed';

function readName(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function useDisplayName() {
  const [name, setState] = useState<string | null>(() => readName());

  useEffect(() => {
    const sync = () => setState(readName());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setName = useCallback((n: string) => {
    try {
      localStorage.setItem(KEY, n);
    } catch {
      // non-critical — quota or disabled storage
    }
    setState(n);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { name, setName };
}
