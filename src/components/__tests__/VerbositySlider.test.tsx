/**
 * Story 14-3: VerbositySlider — narrator verbosity control.
 *
 * RED phase — this component doesn't exist yet.
 *
 * ACs tested:
 *   AC2: Slider renders with three discrete labeled positions (concise/standard/verbose)
 *   AC2: Slider interaction changes the setting
 *   AC6: Setting propagates via callback (will be sent to server as SESSION_EVENT)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { VerbositySlider } from '../VerbositySlider';
import type { NarratorVerbosity } from '@/types/protocol';

// =========================================================================
// AC2: Slider renders with three labeled positions
// =========================================================================

describe('VerbositySlider — renders', () => {
  it('renders three verbosity labels', () => {
    render(
      <VerbositySlider value="standard" onChange={vi.fn()} />,
    );
    expect(screen.getByText(/concise/i)).toBeInTheDocument();
    expect(screen.getByText(/standard/i)).toBeInTheDocument();
    expect(screen.getByText(/verbose/i)).toBeInTheDocument();
  });

  it('shows the current value as selected', () => {
    render(
      <VerbositySlider value="verbose" onChange={vi.fn()} />,
    );
    // The active position should have an aria-pressed or aria-checked attribute
    // or a visually distinct state. We check for the accessible role.
    const verboseOption = screen.getByRole('radio', { name: /verbose/i });
    expect(verboseOption).toBeChecked();
  });

  it('renders an accessible group label', () => {
    render(
      <VerbositySlider value="standard" onChange={vi.fn()} />,
    );
    expect(screen.getByRole('radiogroup', { name: /verbosity/i })).toBeInTheDocument();
  });
});

// =========================================================================
// AC2: Slider interaction changes the setting
// =========================================================================

describe('VerbositySlider — interaction', () => {
  it('calls onChange with "concise" when concise is selected', async () => {
    const onChange = vi.fn();
    render(
      <VerbositySlider value="standard" onChange={onChange} />,
    );

    const conciseOption = screen.getByRole('radio', { name: /concise/i });
    await userEvent.click(conciseOption);

    expect(onChange).toHaveBeenCalledWith('concise');
  });

  it('calls onChange with "verbose" when verbose is selected', async () => {
    const onChange = vi.fn();
    render(
      <VerbositySlider value="standard" onChange={onChange} />,
    );

    const verboseOption = screen.getByRole('radio', { name: /verbose/i });
    await userEvent.click(verboseOption);

    expect(onChange).toHaveBeenCalledWith('verbose');
  });

  it('does not fire onChange when clicking already-selected value', async () => {
    const onChange = vi.fn();
    render(
      <VerbositySlider value="standard" onChange={onChange} />,
    );

    const standardOption = screen.getByRole('radio', { name: /standard/i });
    await userEvent.click(standardOption);

    // Should not fire — value is already standard
    expect(onChange).not.toHaveBeenCalled();
  });
});

// =========================================================================
// AC6: Type contract — NarratorVerbosity is the value type
// =========================================================================

describe('VerbositySlider — type contract', () => {
  it('accepts all three NarratorVerbosity values', () => {
    const values: NarratorVerbosity[] = ['concise', 'standard', 'verbose'];
    for (const v of values) {
      const { unmount } = render(
        <VerbositySlider value={v} onChange={vi.fn()} />,
      );
      // Should render without error for all three values
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      unmount();
    }
  });
});
