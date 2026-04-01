import { useContext } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ThemeProvider,
  ThemeContext,
  DEFAULT_THEME,
  type GenreTheme,
  type ThemeContextValue,
} from '../ThemeProvider';

/** Helper that consumes ThemeContext inside a provider and returns the ref. */
function ThemeConsumer({ onTheme }: { onTheme: (v: ThemeContextValue) => void }) {
  const value = useContext(ThemeContext);
  onTheme(value);
  return <div data-testid="consumer">{value.theme.name}</div>;
}

const LOW_FANTASY: GenreTheme = {
  name: 'low_fantasy',
  colors: {
    '--primary': 'oklch(0.3 0.05 250)',
    '--secondary': 'oklch(0.5 0.03 40)',
    '--background': 'oklch(0.15 0.01 260)',
    '--foreground': 'oklch(0.9 0 0)',
  },
  fontFamily: '"Cinzel", serif',
};

const ROAD_WARRIOR: GenreTheme = {
  name: 'road_warrior',
  colors: {
    '--primary': 'oklch(0.6 0.15 30)',
    '--accent': 'oklch(0.5 0.2 50)',
  },
  fontFamily: '"Rajdhani", sans-serif',
};

beforeEach(() => {
  // Reset documentElement inline styles between tests
  document.documentElement.style.cssText = '';
});

describe('ThemeProvider', () => {
  it('renders children without crashing', () => {
    render(
      <ThemeProvider>
        <span data-testid="child">hello</span>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('provides default theme via context when no initialTheme', () => {
    let captured: ThemeContextValue | undefined;

    render(
      <ThemeProvider>
        <ThemeConsumer onTheme={(v) => { captured = v; }} />
      </ThemeProvider>,
    );

    expect(captured).toBeDefined();
    expect(captured!.theme).toEqual(DEFAULT_THEME);
    expect(captured!.theme.name).toBe('default');
    expect(typeof captured!.setTheme).toBe('function');
  });

  it('injects CSS variables from theme colors into document.documentElement.style', () => {
    render(
      <ThemeProvider initialTheme={LOW_FANTASY}>
        <ThemeConsumer onTheme={() => {}} />
      </ThemeProvider>,
    );

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--primary')).toBe('oklch(0.3 0.05 250)');
    expect(style.getPropertyValue('--secondary')).toBe('oklch(0.5 0.03 40)');
    expect(style.getPropertyValue('--background')).toBe('oklch(0.15 0.01 260)');
    expect(style.getPropertyValue('--foreground')).toBe('oklch(0.9 0 0)');
  });

  it('switches CSS variables when setTheme called with new genre theme', () => {
    let captured: ThemeContextValue | undefined;

    render(
      <ThemeProvider initialTheme={LOW_FANTASY}>
        <ThemeConsumer onTheme={(v) => { captured = v; }} />
      </ThemeProvider>,
    );

    act(() => {
      captured!.setTheme(ROAD_WARRIOR);
    });

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--primary')).toBe('oklch(0.6 0.15 30)');
    expect(style.getPropertyValue('--accent')).toBe('oklch(0.5 0.2 50)');
  });

  it('cleans up old CSS variables when theme changes (no stale vars)', () => {
    let captured: ThemeContextValue | undefined;

    render(
      <ThemeProvider initialTheme={LOW_FANTASY}>
        <ThemeConsumer onTheme={(v) => { captured = v; }} />
      </ThemeProvider>,
    );

    // LOW_FANTASY sets --secondary, --background, --foreground
    expect(document.documentElement.style.getPropertyValue('--secondary')).toBe('oklch(0.5 0.03 40)');

    act(() => {
      captured!.setTheme(ROAD_WARRIOR);
    });

    // ROAD_WARRIOR does NOT have --secondary, --background, --foreground
    // They must be cleaned up
    expect(document.documentElement.style.getPropertyValue('--secondary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--foreground')).toBe('');
  });

  it('context returns current theme and setTheme', () => {
    let captured: ThemeContextValue | undefined;

    render(
      <ThemeProvider initialTheme={LOW_FANTASY}>
        <ThemeConsumer onTheme={(v) => { captured = v; }} />
      </ThemeProvider>,
    );

    expect(captured!.theme.name).toBe('low_fantasy');
    expect(captured!.theme.colors).toEqual(LOW_FANTASY.colors);
    expect(typeof captured!.setTheme).toBe('function');
  });

  it('falls back to default colors when theme.colors is empty/undefined', () => {
    const noColors: GenreTheme = { name: 'bare' };

    let captured: ThemeContextValue | undefined;

    render(
      <ThemeProvider initialTheme={noColors}>
        <ThemeConsumer onTheme={(v) => { captured = v; }} />
      </ThemeProvider>,
    );

    // Should not crash, theme should be the bare one
    expect(captured!.theme.name).toBe('bare');
    // No CSS variables should be set
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
  });

  it('applies font-family from theme if provided', () => {
    render(
      <ThemeProvider initialTheme={LOW_FANTASY}>
        <ThemeConsumer onTheme={() => {}} />
      </ThemeProvider>,
    );

    expect(document.documentElement.style.getPropertyValue('--font-family')).toBe('"Cinzel", serif');
  });
});
