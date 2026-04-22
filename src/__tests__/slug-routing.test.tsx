import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { installWebAudioMock, installLocalStorageMock } from '@/audio/__tests__/web-audio-mock';
import { AudioEngine } from '@/audio/AudioEngine';
import App from '../App';

beforeEach(() => {
  AudioEngine.resetInstance();
  installWebAudioMock();
  installLocalStorageMock();
});

afterEach(() => {
  AudioEngine.resetInstance();
  vi.unstubAllGlobals();
});

describe('slug routing', () => {
  it('renders GameScreen at /solo/:slug with mode=solo', () => {
    render(
      <MemoryRouter initialEntries={['/solo/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('game-screen')).toHaveAttribute('data-mode', 'solo');
    expect(screen.getByTestId('game-screen')).toHaveAttribute('data-slug', '2026-04-22-moldharrow-keep');
  });

  it('renders GameScreen at /play/:slug with mode=multiplayer', () => {
    render(
      <MemoryRouter initialEntries={['/play/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('game-screen')).toHaveAttribute('data-mode', 'multiplayer');
  });

  it('renders lobby at /', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByTestId('lobby-root')).toBeInTheDocument();
  });
});
