import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { MessageType, type GameMessage } from '@/types/protocol';
import {
  GameStateProvider,
  useGameState,
  type ClientGameState,
} from '@/providers/GameStateProvider';
import { useStateMirror } from '@/hooks/useStateMirror';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  return createElement(GameStateProvider, null, children);
}

function imageHandout(
  url: string,
  description: string,
  render_id: string,
): GameMessage {
  return {
    type: MessageType.IMAGE,
    payload: {
      url,
      tier: 'handout',
      description,
      handout: true,
      render_id,
    },
    player_id: 'server',
  };
}

function imageNonHandout(url: string): GameMessage {
  return {
    type: MessageType.IMAGE,
    payload: {
      url,
      tier: 'scene',
      description: 'A scenic view',
      handout: false,
    },
    player_id: 'server',
  };
}

// ---------------------------------------------------------------------------
// AC-1: Handout images cached in journal
// ---------------------------------------------------------------------------

describe('AC-1: Handout images cached in journal', () => {
  it('stores IMAGE message with handout=true in journal array', () => {
    const messages = [
      imageHandout('/renders/letter.png', 'A weathered letter', 'abc123'),
    ];

    const { result } = renderHook(
      () => {
        useStateMirror(messages);
        return useGameState();
      },
      { wrapper },
    );

    expect(result.current.state.journal).toBeDefined();
    expect(result.current.state.journal).toHaveLength(1);
    expect(result.current.state.journal![0]).toMatchObject({
      type: 'handout',
      url: '/renders/letter.png',
      description: 'A weathered letter',
      render_id: 'abc123',
    });
  });

  it('does not store IMAGE messages without handout=true', () => {
    const messages = [imageNonHandout('/renders/scene.png')];

    const { result } = renderHook(
      () => {
        useStateMirror(messages);
        return useGameState();
      },
      { wrapper },
    );

    expect(result.current.state.journal ?? []).toHaveLength(0);
  });

  it('stores multiple handouts in order', () => {
    const messages = [
      imageHandout('/renders/letter.png', 'Letter', 'id1'),
      imageHandout('/renders/map.png', 'Old map', 'id2'),
      imageHandout('/renders/portrait.png', 'Portrait', 'id3'),
    ];

    const { result } = renderHook(
      () => {
        useStateMirror(messages);
        return useGameState();
      },
      { wrapper },
    );

    expect(result.current.state.journal).toHaveLength(3);
    expect(result.current.state.journal![0].render_id).toBe('id1');
    expect(result.current.state.journal![1].render_id).toBe('id2');
    expect(result.current.state.journal![2].render_id).toBe('id3');
  });
});

// ---------------------------------------------------------------------------
// AC-2: Journal survives page reload (unmount/remount)
// ---------------------------------------------------------------------------

describe('AC-2: Journal survives page reload', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('journal entries persist across unmount/remount via localStorage', () => {
    const messages = [
      imageHandout('/renders/letter.png', 'A letter', 'abc123'),
    ];

    // First mount: receive handout
    const { unmount } = renderHook(
      () => {
        useStateMirror(messages);
        return useGameState();
      },
      { wrapper },
    );
    unmount();

    // Second mount: journal should be restored from localStorage
    const { result } = renderHook(
      () => {
        useStateMirror([]); // no new messages
        return useGameState();
      },
      { wrapper },
    );

    expect(result.current.state.journal).toHaveLength(1);
    expect(result.current.state.journal![0].url).toBe('/renders/letter.png');
  });
});

// ---------------------------------------------------------------------------
// AC-5: Duplicate handouts are not added
// ---------------------------------------------------------------------------

describe('AC-5: Duplicate handouts are not added', () => {
  it('same render_id is not added twice', () => {
    const messages = [
      imageHandout('/renders/letter.png', 'A letter', 'abc123'),
      imageHandout('/renders/letter.png', 'A letter', 'abc123'),
    ];

    const { result } = renderHook(
      () => {
        useStateMirror(messages);
        return useGameState();
      },
      { wrapper },
    );

    expect(result.current.state.journal).toHaveLength(1);
  });

  it('different render_ids are both added', () => {
    const messages = [
      imageHandout('/renders/letter.png', 'First letter', 'id1'),
      imageHandout('/renders/letter2.png', 'Second letter', 'id2'),
    ];

    const { result } = renderHook(
      () => {
        useStateMirror(messages);
        return useGameState();
      },
      { wrapper },
    );

    expect(result.current.state.journal).toHaveLength(2);
  });
});
