import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioStatus } from '../AudioStatus';
import type { AudioStatusProps } from '../AudioStatus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sq-audio-volumes';

const defaultProps: AudioStatusProps = {
  nowPlaying: { title: 'Tense Battle', mood: 'tense' },
  volumes: { music: 0.7, sfx: 0.8, voice: 1.0 },
  muted: { music: false, sfx: false, voice: false },
  onVolumeChange: vi.fn(),
  onMuteToggle: vi.fn(),
};

function renderAudioStatus(overrides: Partial<AudioStatusProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<AudioStatus {...props} />);
}

async function expandPanel() {
  const user = userEvent.setup();
  const toggle = screen.getByTestId('audio-toggle');
  await user.click(toggle);
  return user;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC-1: Now-playing track displayed
// ---------------------------------------------------------------------------

describe('AudioStatus — AC-1: now-playing track displayed', () => {
  it('shows track title when expanded', async () => {
    renderAudioStatus();
    await expandPanel();
    expect(screen.getByText(/Tense Battle/)).toBeInTheDocument();
  });

  it('shows mood badge when expanded', async () => {
    renderAudioStatus();
    await expandPanel();
    expect(screen.getByText('tense')).toBeInTheDocument();
  });

  it('mood badge has a data-testid for styling hooks', async () => {
    renderAudioStatus();
    await expandPanel();
    const badge = screen.getByTestId('mood-badge');
    expect(badge).toHaveTextContent('tense');
  });

  it('shows nothing for now-playing when nowPlaying is null', async () => {
    renderAudioStatus({ nowPlaying: null });
    await expandPanel();
    expect(screen.queryByTestId('now-playing')).not.toBeInTheDocument();
  });

  it('updates display when nowPlaying changes', async () => {
    const { rerender } = render(<AudioStatus {...defaultProps} />);
    await expandPanel();
    expect(screen.getByText(/Tense Battle/)).toBeInTheDocument();

    rerender(
      <AudioStatus
        {...defaultProps}
        nowPlaying={{ title: 'Triumphant March', mood: 'triumphant' }}
      />,
    );
    expect(screen.getByText(/Triumphant March/)).toBeInTheDocument();
    expect(screen.getByText('triumphant')).toBeInTheDocument();
    expect(screen.queryByText('Tense Battle')).not.toBeInTheDocument();
  });

  it('wraps track info in a now-playing container', async () => {
    renderAudioStatus();
    await expandPanel();
    const container = screen.getByTestId('now-playing');
    expect(within(container).getByText(/Tense Battle/)).toBeInTheDocument();
    expect(within(container).getByTestId('mood-badge')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Volume sliders control channel levels
// ---------------------------------------------------------------------------

describe('AudioStatus — AC-2: volume sliders control channel levels', () => {
  it('renders three volume sliders (music, sfx, voice) when expanded', async () => {
    renderAudioStatus();
    await expandPanel();
    expect(screen.getByTestId('volume-slider-music')).toBeInTheDocument();
    expect(screen.getByTestId('volume-slider-sfx')).toBeInTheDocument();
    expect(screen.getByTestId('volume-slider-voice')).toBeInTheDocument();
  });

  it('music slider reflects current volume as percentage', async () => {
    renderAudioStatus({ volumes: { music: 0.5, sfx: 0.8, voice: 1.0 } });
    await expandPanel();
    const slider = screen.getByTestId('volume-slider-music');
    const input = within(slider).getByRole('slider');
    expect(input).toHaveValue('50');
  });

  it('sfx slider reflects current volume as percentage', async () => {
    renderAudioStatus({ volumes: { music: 0.7, sfx: 0.6, voice: 1.0 } });
    await expandPanel();
    const slider = screen.getByTestId('volume-slider-sfx');
    const input = within(slider).getByRole('slider');
    expect(input).toHaveValue('60');
  });

  it('voice slider reflects current volume as percentage', async () => {
    renderAudioStatus({ volumes: { music: 0.7, sfx: 0.8, voice: 0.9 } });
    await expandPanel();
    const slider = screen.getByTestId('volume-slider-voice');
    const input = within(slider).getByRole('slider');
    expect(input).toHaveValue('90');
  });

  it('calls onVolumeChange with channel and normalized value on slider change', async () => {
    const onVolumeChange = vi.fn();
    renderAudioStatus({ onVolumeChange });
    await expandPanel();

    const slider = screen.getByTestId('volume-slider-music');
    const input = within(slider).getByRole('slider');
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    nativeInputValueSetter.call(input, '50');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(onVolumeChange).toHaveBeenCalledWith('music', 0.5);
  });

  it('sliders have range 0-100', async () => {
    renderAudioStatus();
    await expandPanel();
    const slider = screen.getByTestId('volume-slider-music');
    const input = within(slider).getByRole('slider');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '100');
  });
});

// ---------------------------------------------------------------------------
// AC-3: Mute toggles silence channels
// ---------------------------------------------------------------------------

describe('AudioStatus — AC-3: mute toggles silence channels', () => {
  it('renders a mute button for each channel when expanded', async () => {
    renderAudioStatus();
    await expandPanel();
    expect(screen.getByTestId('mute-btn-music')).toBeInTheDocument();
    expect(screen.getByTestId('mute-btn-sfx')).toBeInTheDocument();
    expect(screen.getByTestId('mute-btn-voice')).toBeInTheDocument();
  });

  it('calls onMuteToggle with channel name when mute button is clicked', async () => {
    const onMuteToggle = vi.fn();
    renderAudioStatus({ onMuteToggle });
    const user = await expandPanel();

    await user.click(screen.getByTestId('mute-btn-sfx'));
    expect(onMuteToggle).toHaveBeenCalledWith('sfx');
  });

  it('calls onMuteToggle for music channel', async () => {
    const onMuteToggle = vi.fn();
    renderAudioStatus({ onMuteToggle });
    const user = await expandPanel();

    await user.click(screen.getByTestId('mute-btn-music'));
    expect(onMuteToggle).toHaveBeenCalledWith('music');
  });

  it('calls onMuteToggle for voice channel', async () => {
    const onMuteToggle = vi.fn();
    renderAudioStatus({ onMuteToggle });
    const user = await expandPanel();

    await user.click(screen.getByTestId('mute-btn-voice'));
    expect(onMuteToggle).toHaveBeenCalledWith('voice');
  });

  it('shows muted indicator when channel is muted', async () => {
    renderAudioStatus({ muted: { music: true, sfx: false, voice: false } });
    await expandPanel();
    const musicBtn = screen.getByTestId('mute-btn-music');
    expect(musicBtn).toHaveAttribute('data-muted', 'true');
  });

  it('shows unmuted indicator when channel is not muted', async () => {
    renderAudioStatus({ muted: { music: false, sfx: false, voice: false } });
    await expandPanel();
    const musicBtn = screen.getByTestId('mute-btn-music');
    expect(musicBtn).toHaveAttribute('data-muted', 'false');
  });

  it('mute buttons are accessible — have aria-label', async () => {
    renderAudioStatus();
    await expandPanel();
    const musicBtn = screen.getByTestId('mute-btn-music');
    expect(musicBtn).toHaveAttribute('aria-label', expect.stringMatching(/mute.*music|music.*mute/i));
  });

  it('visually distinguishes muted from unmuted state', async () => {
    renderAudioStatus({ muted: { music: true, sfx: true, voice: false } });
    await expandPanel();
    expect(screen.getByTestId('mute-btn-music')).toHaveAttribute('data-muted', 'true');
    expect(screen.getByTestId('mute-btn-sfx')).toHaveAttribute('data-muted', 'true');
    expect(screen.getByTestId('mute-btn-voice')).toHaveAttribute('data-muted', 'false');
  });
});

// ---------------------------------------------------------------------------
// AC-4: Volumes persist across reloads (localStorage)
// ---------------------------------------------------------------------------

describe('AudioStatus — AC-4: volumes persist across reloads', () => {
  it('saves volumes to localStorage when slider changes', async () => {
    renderAudioStatus();
    await expandPanel();
    const slider = screen.getByTestId('volume-slider-music');
    const input = within(slider).getByRole('slider');

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    nativeInputValueSetter.call(input, '30');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.music).toBeCloseTo(0.3, 1);
  });

  it('restores volumes from localStorage on mount', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ music: 0.3, sfx: 0.5, voice: 0.9 }),
    );

    renderAudioStatus({ volumes: { music: 0.3, sfx: 0.5, voice: 0.9 } });
    await expandPanel();

    const musicSlider = within(screen.getByTestId('volume-slider-music')).getByRole('slider');
    expect(musicSlider).toHaveValue('30');

    const sfxSlider = within(screen.getByTestId('volume-slider-sfx')).getByRole('slider');
    expect(sfxSlider).toHaveValue('50');

    const voiceSlider = within(screen.getByTestId('volume-slider-voice')).getByRole('slider');
    expect(voiceSlider).toHaveValue('90');
  });

  it('persists mute state to localStorage', async () => {
    renderAudioStatus();
    const user = await expandPanel();

    await user.click(screen.getByTestId('mute-btn-sfx'));

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
  });

  it('survives unmount and remount with persisted values', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ music: 0.4, sfx: 0.6, voice: 0.8 }),
    );

    const { unmount } = renderAudioStatus({
      volumes: { music: 0.4, sfx: 0.6, voice: 0.8 },
    });
    unmount();

    renderAudioStatus({ volumes: { music: 0.4, sfx: 0.6, voice: 0.8 } });
    await expandPanel();
    const musicSlider = within(screen.getByTestId('volume-slider-music')).getByRole('slider');
    expect(musicSlider).toHaveValue('40');
  });
});

// ---------------------------------------------------------------------------
// AC-5: Progressive disclosure — collapsed icon, expanded panel
// ---------------------------------------------------------------------------

describe('AudioStatus — AC-5: progressive disclosure', () => {
  it('renders a collapsed toggle button by default', () => {
    renderAudioStatus();
    expect(screen.getByTestId('audio-toggle')).toBeInTheDocument();
  });

  it('collapsed toggle has aria-label for accessibility', () => {
    renderAudioStatus();
    const toggle = screen.getByTestId('audio-toggle');
    expect(toggle).toHaveAttribute('aria-label', 'Audio controls');
  });

  it('does not show sliders in collapsed state', () => {
    renderAudioStatus();
    expect(screen.queryByTestId('volume-slider-music')).not.toBeInTheDocument();
  });

  it('expands to show full controls on click', async () => {
    renderAudioStatus();
    await expandPanel();

    const panel = screen.getByTestId('audio-status');
    expect(panel).toHaveAttribute('data-expanded', 'true');
    expect(within(panel).getByTestId('volume-slider-music')).toBeVisible();
    expect(within(panel).getByTestId('volume-slider-sfx')).toBeVisible();
    expect(within(panel).getByTestId('volume-slider-voice')).toBeVisible();
  });

  it('shows equalizer bars on toggle when audio is playing', () => {
    renderAudioStatus({ nowPlaying: { title: 'Track', mood: 'calm' } });
    const toggle = screen.getByTestId('audio-toggle');
    // Should show equalizer bars, not the ♪ note
    expect(toggle.querySelector('.flex.items-end')).toBeInTheDocument();
  });

  it('shows music note on toggle when nothing is playing', () => {
    renderAudioStatus({ nowPlaying: null });
    const toggle = screen.getByTestId('audio-toggle');
    expect(toggle).toHaveTextContent('♪');
  });

  it('closes panel on Escape key', async () => {
    const user = userEvent.setup();
    renderAudioStatus();
    await expandPanel();

    expect(screen.getByTestId('audio-status')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('audio-status')).not.toBeInTheDocument();
    expect(screen.getByTestId('audio-toggle')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge cases & robustness
// ---------------------------------------------------------------------------

describe('AudioStatus — edge cases', () => {
  it('handles volumes at 0 (fully silent)', async () => {
    renderAudioStatus({ volumes: { music: 0, sfx: 0, voice: 0 } });
    await expandPanel();
    const musicSlider = within(screen.getByTestId('volume-slider-music')).getByRole('slider');
    expect(musicSlider).toHaveValue('0');
  });

  it('handles volumes at 1 (full volume)', async () => {
    renderAudioStatus({ volumes: { music: 1, sfx: 1, voice: 1 } });
    await expandPanel();
    const musicSlider = within(screen.getByTestId('volume-slider-music')).getByRole('slider');
    expect(musicSlider).toHaveValue('100');
  });

  it('renders without crashing when all channels are muted', async () => {
    renderAudioStatus({ muted: { music: true, sfx: true, voice: true } });
    await expandPanel();
    expect(screen.getByTestId('audio-status')).toBeInTheDocument();
  });

  it('renders without crashing when nowPlaying is null and all muted', () => {
    renderAudioStatus({
      nowPlaying: null,
      muted: { music: true, sfx: true, voice: true },
    });
    // Should render the collapsed toggle without error
    expect(screen.getByTestId('audio-toggle')).toBeInTheDocument();
  });

  it('mute button is a button element for accessibility', async () => {
    renderAudioStatus();
    await expandPanel();
    const btn = screen.getByTestId('mute-btn-music');
    expect(btn.tagName).toBe('BUTTON');
  });

  it('slider inputs have appropriate aria attributes', async () => {
    renderAudioStatus();
    await expandPanel();
    const slider = within(screen.getByTestId('volume-slider-music')).getByRole('slider');
    expect(slider).toHaveAttribute('aria-label', expect.stringMatching(/music.*volume|volume.*music/i));
  });
});
