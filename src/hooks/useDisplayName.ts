import { useCallback, useState } from 'react';

const KEY = 'sq:display-name';

export function useDisplayName() {
  const [name, setState] = useState<string | null>(() => localStorage.getItem(KEY));
  const setName = useCallback((n: string) => {
    localStorage.setItem(KEY, n);
    setState(n);
  }, []);
  return { name, setName };
}
