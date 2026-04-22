import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WS } from 'jest-websocket-mock';
import App from '../../App';

describe('GameScreen event wiring', () => {
  beforeEach(() => { localStorage.setItem('sq:display-name', 'alice'); });
  afterEach(() => { WS.clean(); localStorage.clear(); });

  it('renders narration events received over WS', async () => {
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });
    render(
      <MemoryRouter initialEntries={['/play/2026-04-22-moldharrow-keep']}>
        <App />
      </MemoryRouter>,
    );
    await server.connected;
    await server.nextMessage;  // SESSION_EVENT connect
    act(() => { server.send({ type: 'NARRATION', payload: { seq: 1, text: 'You enter a dim hall.' } }); });
    await waitFor(() => expect(screen.getByTestId('narration-log')).toHaveTextContent('dim hall'));
  });
});
