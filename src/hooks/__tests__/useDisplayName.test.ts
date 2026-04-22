import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDisplayName } from '../useDisplayName';

describe('useDisplayName', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* jsdom may not have it */ }
  });

  it('returns null when unset', () => {
    const { result } = renderHook(() => useDisplayName());
    expect(result.current.name).toBeNull();
  });

  it('persists name to localStorage', () => {
    const { result } = renderHook(() => useDisplayName());
    act(() => result.current.setName('alice'));
    expect(localStorage.getItem('sq:display-name')).toBe('alice');
    expect(result.current.name).toBe('alice');
  });

  it('restores name on rerender', () => {
    localStorage.setItem('sq:display-name', 'bob');
    const { result } = renderHook(() => useDisplayName());
    expect(result.current.name).toBe('bob');
  });
});
