import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PausedBanner } from '../PausedBanner';

describe('PausedBanner', () => {
  it('renders nothing when not paused', () => {
    const { container } = render(<PausedBanner paused={false} waitingFor={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists waitingFor when paused', () => {
    render(<PausedBanner paused={true} waitingFor={['bob', 'carol']} />);
    expect(screen.getByRole('status')).toHaveTextContent(/bob/);
    expect(screen.getByRole('status')).toHaveTextContent(/carol/);
  });
});
