import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import InputBar from '../InputBar';

const defaultProps = {
  onSend: vi.fn(),
  micEnabled: false,
  onMicToggle: vi.fn(),
  pttState: "idle" as const,
  onPttStart: vi.fn(),
  onPttStop: vi.fn(),
  transcript: null,
  onTranscriptEdit: vi.fn(),
  onTranscriptConfirm: vi.fn(),
  onTranscriptDiscard: vi.fn(),
  duration: 0,
};

describe('InputBar', () => {
  it('renders a text input field', () => {
    render(<InputBar {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders an aside toggle button', () => {
    render(<InputBar {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /aside/i }),
    ).toBeInTheDocument();
  });

  it('submits input text on Enter with aside=false by default', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<InputBar {...defaultProps} onSend={onSend} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'open the door{Enter}');

    expect(onSend).toHaveBeenCalledWith('open the door', false);
  });

  it('submits with aside=true when aside toggle is active', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<InputBar {...defaultProps} onSend={onSend} />);

    const toggle = screen.getByRole('button', { name: /aside/i });
    await user.click(toggle);

    const input = screen.getByRole('textbox');
    await user.type(input, 'whisper to ally{Enter}');

    expect(onSend).toHaveBeenCalledWith('whisper to ally', true);
  });

  it('clears input after submit', async () => {
    const user = userEvent.setup();
    render(<InputBar {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'hello{Enter}');

    expect(input).toHaveValue('');
  });

  it('disables input and submit when disabled prop is true', () => {
    render(<InputBar {...defaultProps} disabled />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('does not call onSend when input is empty', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<InputBar {...defaultProps} onSend={onSend} />);

    const input = screen.getByRole('textbox');
    await user.type(input, '{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not submit on Shift+Enter', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<InputBar {...defaultProps} onSend={onSend} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'some text{Shift>}{Enter}{/Shift}');

    expect(onSend).not.toHaveBeenCalled();
  });
});
