/**
 * Story 14-6: ImagePacingSlider — configurable image generation cooldown.
 *
 * RED phase — this component doesn't exist yet.
 *
 * ACs tested:
 *   AC1: Slider renders with current cooldown value
 *   AC2: Slider interaction changes the cooldown setting
 *   AC3: Fires onChange with the new value (sent to server as SESSION_EVENT)
 *   AC4: Displays value in seconds with label
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ImagePacingSlider } from '../ImagePacingSlider';

// =========================================================================
// AC1: Slider renders with current cooldown value
// =========================================================================

describe('ImagePacingSlider — renders', () => {
  it('renders a slider input', () => {
    render(
      <ImagePacingSlider value={60} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('shows the current value in seconds', () => {
    render(
      <ImagePacingSlider value={60} onChange={vi.fn()} />,
    );
    // Should display "60s" or "60 seconds" somewhere
    expect(screen.getByText(/60/)).toBeInTheDocument();
  });

  it('renders an accessible label', () => {
    render(
      <ImagePacingSlider value={60} onChange={vi.fn()} />,
    );
    expect(
      screen.getByRole('slider', { name: /image.*pacing|image.*cooldown/i }),
    ).toBeInTheDocument();
  });

  it('displays "off" or "0" when cooldown is zero', () => {
    render(
      <ImagePacingSlider value={0} onChange={vi.fn()} />,
    );
    // When cooldown is 0, should indicate throttling is disabled
    expect(
      screen.getByText(/off|no throttle|0/i),
    ).toBeInTheDocument();
  });
});

// =========================================================================
// AC2: Slider interaction changes the cooldown
// =========================================================================

describe('ImagePacingSlider — interaction', () => {
  it('calls onChange when slider value changes', async () => {
    const onChange = vi.fn();
    render(
      <ImagePacingSlider value={60} onChange={onChange} />,
    );

    const slider = screen.getByRole('slider');
    // Simulate changing the slider to 30
    await userEvent.clear(slider);
    await userEvent.type(slider, '30');

    // onChange should have been called with a number
    expect(onChange).toHaveBeenCalled();
    const calledWith = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(typeof calledWith).toBe('number');
  });
});

// =========================================================================
// AC4: Slider range and step
// =========================================================================

describe('ImagePacingSlider — range', () => {
  it('slider has min of 0', () => {
    render(
      <ImagePacingSlider value={30} onChange={vi.fn()} />,
    );
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '0');
  });

  it('slider has max of at least 120', () => {
    render(
      <ImagePacingSlider value={30} onChange={vi.fn()} />,
    );
    const slider = screen.getByRole('slider');
    const max = Number(slider.getAttribute('max'));
    expect(max).toBeGreaterThanOrEqual(120);
  });

  it('slider has step of 5 or 10 for usable granularity', () => {
    render(
      <ImagePacingSlider value={30} onChange={vi.fn()} />,
    );
    const slider = screen.getByRole('slider');
    const step = Number(slider.getAttribute('step'));
    expect([5, 10, 15]).toContain(step);
  });
});

// =========================================================================
// AC3: Type contract — value is a number (seconds)
// =========================================================================

describe('ImagePacingSlider — type contract', () => {
  it('accepts typical cooldown values without error', () => {
    const values = [0, 15, 30, 45, 60, 90, 120];
    for (const v of values) {
      const { unmount } = render(
        <ImagePacingSlider value={v} onChange={vi.fn()} />,
      );
      expect(screen.getByRole('slider')).toBeInTheDocument();
      unmount();
    }
  });
});
