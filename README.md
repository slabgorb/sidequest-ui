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
| **AudioStatus**    | 2-channel mixer UI (music/SFX), mute toggles                |
| **InputBar**       | Text input with aside toggle                                 |
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

Custom hooks under `src/hooks/`:

| Hook                   | Responsibility                                          |
|------------------------|---------------------------------------------------------|
| `useWebSocket`         | Low-level WebSocket transport with reconnect            |
| `useGameSocket`        | Game-message dispatch built on `useWebSocket`           |
| `useStateMirror`       | Sync local game state from server messages              |
| `useWatcherSocket`     | Telemetry WebSocket for GM mode                         |
| `useSlashCommands`     | Parse `/inventory`, `/character`, `/quests`, etc.       |
| `useAudio`             | Core audio context management                           |
| `useAudioCue`          | Play one-shot audio cues (SFX) from server events       |
| `useGenreTheme`        | Inject genre pack CSS variables                         |
| `useChromeArchetype`   | Archetype-driven UI chrome styling                      |
| `useLayoutMode`        | Desktop/mobile layout selection                         |
| `useBreakpoint`        | Responsive breakpoint detection                         |
| `useLocalPrefs`        | Persisted user preferences (volume, panel layout, etc.) |
| `useRunningHeader`     | Scroll-aware running header state                       |
| `useGameBoardLayout`   | Game board panel arrangement                            |
| `useGameBoardHotkeys`  | Keyboard shortcut bindings for game board panels        |

> The full list is authoritative in `src/hooks/`. Former voice hooks
> (`useVoiceChat`, `useVoicePlayback`, `usePushToTalk`, `useWhisper`) were
> removed along with the TTS / WebRTC voice pipeline (2026-04).

## Audio Engine

The audio subsystem uses the Web Audio API with two independent channels:

- **AudioEngine.ts** — 2-channel mixer (music + SFX) with per-channel gain
- **AudioCache.ts** — URL-to-AudioBuffer cache to avoid redundant fetches
- **Crossfader.ts** — Smooth gain-curve transitions between music tracks

The voice channel, `LocalTranscriber.ts`, `Ducker.ts`, and the Kokoro TTS
playback path were all removed in 2026-04. Music-ducking was only ever wired
to duck under TTS voice playback; with voice gone, the entire duck/restore
chain is gone too — the Rust server no longer emits `AudioAction::Duck`
constructions. See `orc-quest/docs/adr/076-narration-protocol-collapse-post-tts.md`.

## WebSocket Protocol

Client-handled message types include `NARRATION`, `NARRATION_END`, `PARTY_STATUS`,
`CHARACTER_SHEET`, `INVENTORY`, `MAP_UPDATE`, `IMAGE`, `AUDIO_CUE`, `CHAPTER_MARKER`,
`SESSION_EVENT`, `TURN_STATUS`, `CHARACTER_CREATION`, `THINKING`, `ERROR`,
`COMBAT_EVENT`, `ACTION_QUEUE`, and the dice protocol triplet (`DICE_REQUEST`,
`DICE_THROW`, `DICE_RESULT`).

See `src/types/` for the authoritative TypeScript payload definitions and
`orc-quest/docs/api-contract.md` for the cross-repo protocol reference.

## Tests

Vitest + React Testing Library + JSDOM. Test files cover integration,
component, hook, and audio behavior.

```bash
npm test              # Watch mode
npx vitest run        # Single run
npx vitest run --ui   # Browser UI
```

## Related Repos

- [orc-quest](https://github.com/slabgorb/orc-quest) — Orchestrator (sprint tracking, ADRs, genre packs)
- [sidequest-api](https://github.com/slabgorb/sidequest-api) — Rust backend
- [sidequest-daemon](https://github.com/slabgorb/sidequest-daemon) — Python media services
