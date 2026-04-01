import { createContext, useState, useEffect, useRef, type ReactNode } from 'react';

export interface GenreTheme {
  name: string;
  colors?: Record<string, string>;
  fontFamily?: string;
  mode?: 'light' | 'dark';
}

export interface ThemeContextValue {
  theme: GenreTheme;
  setTheme: (theme: GenreTheme) => void;
}

export const DEFAULT_THEME: GenreTheme = {
  name: 'default',
};

export const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: GenreTheme;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setTheme] = useState<GenreTheme>(initialTheme ?? DEFAULT_THEME);
  const prevKeysRef = useRef<string[]>([]);

  useEffect(() => {
    const style = document.documentElement.style;

    // Clean up previous CSS variables
    for (const key of prevKeysRef.current) {
      style.removeProperty(key);
    }

    const newKeys: string[] = [];

    // Inject new CSS variables from theme colors
    if (theme.colors) {
      for (const [key, value] of Object.entries(theme.colors)) {
        style.setProperty(key, value);
        newKeys.push(key);
      }
    }

    // Inject font-family if provided
    if (theme.fontFamily) {
      style.setProperty('--font-family', theme.fontFamily);
      newKeys.push('--font-family');
    }

    // Toggle dark/light mode class on <html>
    const mode = theme.mode ?? 'dark';
    document.documentElement.classList.toggle('dark', mode === 'dark');

    prevKeysRef.current = newKeys;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

