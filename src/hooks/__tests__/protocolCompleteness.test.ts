/**
 * Story 26-7: Protocol completeness tests.
 *
 * These tests verify that 4 message types the Rust API sends are defined
 * in the UI protocol and handled by useStateMirror. Currently all FAIL (RED).
 *
 * Message types: JOURNAL_REQUEST, JOURNAL_RESPONSE, ITEM_DEPLETED, RESOURCE_MIN_REACHED
 */
import { describe, it, expect } from 'vitest';
import { MessageType } from '../../types/protocol';

// ---------------------------------------------------------------------------
// AC-1: Protocol type definitions exist
// ---------------------------------------------------------------------------

describe('Protocol type completeness', () => {
  it('MessageType enum includes JOURNAL_REQUEST', () => {
    expect(MessageType.JOURNAL_REQUEST).toBe('JOURNAL_REQUEST');
  });

  it('MessageType enum includes JOURNAL_RESPONSE', () => {
    expect(MessageType.JOURNAL_RESPONSE).toBe('JOURNAL_RESPONSE');
  });

  it('MessageType enum includes ITEM_DEPLETED', () => {
    expect(MessageType.ITEM_DEPLETED).toBe('ITEM_DEPLETED');
  });

  it('MessageType enum includes RESOURCE_MIN_REACHED', () => {
    expect(MessageType.RESOURCE_MIN_REACHED).toBe('RESOURCE_MIN_REACHED');
  });
});
