import '@testing-library/jest-dom/vitest'

// Mock window.matchMedia for components using useBreakpoint.
//
// IMPORTANT: we report "mobile" by default so that GameBoard renders via
// `MobileTabView` instead of the dockview layout engine. Dockview does not
// render panel CONTENT in jsdom (it gates content mounting on real viewport
// geometry and ResizeObserver callbacks), which broke every test that
// asserts on widget output (narration text, character sheet, etc.). The
// mobile tab view renders all widget content in a flat structure that jsdom
// handles natively, which is closer to what the tests were originally
// written against (react-grid-layout). Tests that specifically need the
// desktop dockview path should override matchMedia per-test.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('max-width: 767px'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// App.tsx persists an HMR snapshot to sessionStorage so hot-reloads don't
// lose game state. Tests that render <App /> in a loop leak that snapshot
// across tests — the second test sees a fully-hydrated App skipping the
// ConnectScreen. Wipe both storages before every test.
import { beforeEach } from 'vitest';
beforeEach(() => {
  try { sessionStorage.clear(); } catch { /* jsdom may not have it */ }
  try { localStorage.clear(); } catch { /* jsdom may not have it */ }
});

// jsdom has no ResizeObserver; DockviewComponent (imported by GameBoard)
// constructs one even on the mobile code path because the module loads
// eagerly. Without the polyfill the constructor throws during import and
// every test that pulls in GameBoard crashes at the error boundary.
// A no-op stub is sufficient since tests force MobileTabView, so dockview
// never actually measures anything.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
