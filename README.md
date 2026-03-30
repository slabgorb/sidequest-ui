# SideQuest UI

React/TypeScript game client for the SideQuest AI Narrator. Connects to the
[Rust API](https://github.com/slabgorb/sidequest-api) via WebSocket for
real-time game sessions.

## Quick Start

```bash
npm install       # Install dependencies
npm run dev       # Dev server at localhost:5173
npm test          # Run tests (Vitest)
npm run build     # Type-check + production build
npm run lint      # ESLint
```

The dev server proxies four paths to the Rust API at `localhost:8765`:

| Path       | Target                    |
|------------|---------------------------|
| `/ws`      | `ws://localhost:8765`     |
| `/api`     | `http://localhost:8765`   |
| `/genre`   | `http://localhost:8765`   |
| `/renders` | `http://localhost:8765`   |

## Stack

- React 19 + TypeScript 5.9
- Vite 8
- Tailwind CSS 4 + shadcn/ui (base-nova style)
- Vitest 4.1.1 + React Testing Library + JSDOM
- lucide-react for icons

## Session Flow

A game session moves through three phases, each rendered by its own screen:

1. **ConnectScreen** — Server connection, genre/world selection via dropdowns, player name entry. Persists selections in localStorage.
2. **CharacterCreation** — AI-driven multi-turn dialogue. The server offers choices and accepts freeform input to build a character collaboratively.
3. **GameLayout** — Active gameplay. Orchestrates all panels described below.

## Components

| Component          | Purpose                                                      |
|--------------------|--------------------------------------------------------------|
| **NarrativeView**  | Markdown narration (DOMPurify), streaming chunks, images     |
| **PartyPanel**     | Portraits, color-coded HP bars, status effects               |
| **CharacterSheet** | Stats grid, abilities, backstory                             |
| **InventoryPanel** | Items grouped by type, equipped state, gold display          |
| **MapOverlay**     | SVG nodes and connections, fog of war, current location      |
| **JournalView**    | Handout thumbnails with lightbox modal                       |
| **CombatOverlay**  | Enemy HP bars, turn order, health status indicators          |
| **AudioStatus**    | 3-channel mixer UI (music/SFX/voice), mute toggles          |
| **InputBar**       | Text input with aside toggle and push-to-talk button         |
| **GMMode**         | Watcher socket, event stream, trope timeline, state inspector|
| **OverlayManager** | Mobile-aware consolidated panel manager                      |

## Keyboard Shortcuts

| Key | Panel          |
|-----|----------------|
| `P` | Party panel    |
| `C` | Character sheet|
| `I` | Inventory      |
| `M` | Map overlay    |
| `J` | Journal        |

## Hooks

Sixteen custom hooks power the client logic:

| Hook                 | Responsibility                                    |
|----------------------|---------------------------------------------------|
| `useGameSocket`      | WebSocket lifecycle and message dispatch           |
| `useStateMirror`     | Sync local game state from server messages         |
| `useSlashCommands`   | Parse `/inventory`, `/character`, `/quests`, etc.  |
| `useAudio`           | Core audio context management                      |
| `useAudioCue`        | Play one-shot audio cues from server events        |
| `useMusicPlayer`     | Background music playback and crossfade            |
| `useSfxPlayer`       | Sound effect playback                              |
| `useVoiceChat`       | WebRTC peer-to-peer voice                          |
| `useVoicePlayback`   | Server-side TTS audio playback                     |
| `usePushToTalk`      | PTT state machine (record, transcribe, preview)    |
| `useWhisper`         | Local Whisper.js speech-to-text                    |
| `useGenreTheme`      | Inject genre pack CSS variables                    |
| `useGMMode`          | GM debugging dashboard state                       |
| `useWatcherSocket`   | Telemetry WebSocket for GM mode                    |
| `useBreakpoint`      | Responsive breakpoint detection                    |

## Audio Engine

The audio subsystem uses the Web Audio API with three independent channels:

- **AudioEngine.ts** — 3-channel mixer (music, SFX, voice) with per-channel gain
- **AudioCache.ts** — URL-to-AudioBuffer cache to avoid redundant fetches
- **Crossfader.ts** — Smooth gain-curve transitions between music tracks
- **Ducker.ts** — Automatic music ducking when voice audio plays
- **LocalTranscriber.ts** — Loads Whisper model for in-browser speech-to-text

## WebSocket Protocol

The client handles these message types from the server:

```
PARTY_STATUS        CHARACTER_SHEET     INVENTORY
MAP_UPDATE          NARRATION           NARRATION_CHUNK
NARRATION_END       PLAYER_ACTION       CHAPTER_MARKER
CHARACTER_CREATION  SESSION_EVENT       TURN_STATUS
IMAGE               AUDIO_CUE           VOICE_TEXT
VOICE_SIGNAL        THINKING            ERROR
COMBAT_EVENT        ACTION_QUEUE
```

## Tests

27 test files covering integration, component, hook, audio, and WebRTC behavior.
Tests run in JSDOM via Vitest with React Testing Library.

```bash
npm test              # Watch mode
npx vitest run        # Single run
npx vitest run --ui   # Browser UI
```

## Related Repos

- [orc-quest](https://github.com/slabgorb/orc-quest) — Orchestrator (sprint tracking, ADRs, genre packs)
- [sidequest-api](https://github.com/slabgorb/sidequest-api) — Rust backend
- [sidequest-daemon](https://github.com/slabgorb/sidequest-daemon) — Python media services
