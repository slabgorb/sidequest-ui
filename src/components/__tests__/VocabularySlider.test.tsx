/**
 * Story 14-4: VocabularySlider — narrator vocabulary/prose complexity control.
 *
 * RED phase — this component doesn't exist yet.
 *
 * ACs tested:
 *   AC2: Slider renders with three discrete labeled positions (accessible/literary/epic)
 *   AC2: Slider interaction changes the setting
 *   AC6: Setting propagates via callback (will be sent to server as SESSION_EVENT)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { VocabularySlider } from '../VocabularySlider';
import type { NarratorVocabulary } from '@/types/protocol';

// =========================================================================
// AC2: Slider renders with three labeled positions
// =========================================================================

describe('VocabularySlider — renders', () => {
  it('renders three vocabulary labels', () => {
    render(
      <VocabularySlider value="literary" onChange={vi.fn()} />,
    );
    expect(screen.getByText(/accessible/i)).toBeInTheDocument();
    expect(screen.getByText(/literary/i)).toBeInTheDocument();
    expect(screen.getByText(/epic/i)).toBeInTheDocument();
  });

  it('shows the current value as selected', () => {
    render(
      <VocabularySlider value="epic" onChange={vi.fn()} />,
    );
    const epicOption = screen.getByRole('radio', { name: /epic/i });
    expect(epicOption).toBeChecked();
  });

  it('renders an accessible group label', () => {
    render(
      <VocabularySlider value="literary" onChange={vi.fn()} />,
    );
    expect(screen.getByRole('radiogroup', { name: /vocabulary/i })).toBeInTheDocument();
  });
});

// =========================================================================
// AC2: Slider interaction changes the setting
// =========================================================================

describe('VocabularySlider — interaction', () => {
  it('calls onChange with "accessible" when accessible is selected', async () => {
    const onChange = vi.fn();
    render(
      <VocabularySlider value="literary" onChange={onChange} />,
    );

    const accessibleOption = screen.getByRole('radio', { name: /accessible/i });
    await userEvent.click(accessibleOption);

    expect(onChange).toHaveBeenCalledWith('accessible');
  });

  it('calls onChange with "epic" when epic is selected', async () => {
    const onChange = vi.fn();
    render(
      <VocabularySlider value="literary" onChange={onChange} />,
    );

    const epicOption = screen.getByRole('radio', { name: /epic/i });
    await userEvent.click(epicOption);

    expect(onChange).toHaveBeenCalledWith('epic');
  });

  it('does not fire onChange when clicking already-selected value', async () => {
    const onChange = vi.fn();
    render(
      <VocabularySlider value="literary" onChange={onChange} />,
    );

    const literaryOption = screen.getByRole('radio', { name: /literary/i });
    await userEvent.click(literaryOption);

    // Should not fire — value is already literary
    expect(onChange).not.toHaveBeenCalled();
  });
});

// =========================================================================
// AC6: Type contract — NarratorVocabulary is the value type
// =========================================================================

describe('VocabularySlider — type contract', () => {
  it('accepts all three NarratorVocabulary values', () => {
    const values: NarratorVocabulary[] = ['accessible', 'literary', 'epic'];
    for (const v of values) {
      const { unmount } = render(
        <VocabularySlider value={v} onChange={vi.fn()} />,
      );
      // Should render without error for all three values
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      unmount();
    }
  });
});
