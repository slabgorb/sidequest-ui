# SideQuest UI

React/TypeScript game client for the SideQuest AI Narrator. Connects to the
[Rust API](https://github.com/slabgorb/sidequest-api) via WebSocket for
real-time game sessions.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Screens                                         │
│  ConnectScreen → NarrativeView                   │
├─────────────────────────────────────────────────┤
│  Components                                      │
│  GameLayout, InputBar, CharacterSheet,           │
│  PartyPanel, InventoryPanel, CombatOverlay,      │
│  MapOverlay, JournalView, AudioStatus            │
├─────────────────────────────────────────────────┤
│  Providers                                       │
│  GameStateProvider (characters, location, quests) │
│  ThemeProvider (genre-driven CSS variables)       │
├─────────────────────────────────────────────────┤
│  Hooks                                           │
│  useGameSocket — WebSocket connection             │
│  useAudio / useMusicPlayer / useSfxPlayer         │
│  useVoiceChat / usePushToTalk                     │
│  useSlashCommands — /command parsing              │
│  useGenreTheme — genre-driven styling             │
├─────────────────────────────────────────────────┤
│  Audio Engine                                    │
│  AudioEngine, AudioCache, LocalTranscriber       │
│  (Whisper via @huggingface/transformers)          │
└─────────────────────────────────────────────────┘
```

## Quick Start

```bash
npm install
npm run dev       # Start dev server at localhost:5173
npm run build     # Type-check + production build
npm run lint      # ESLint
npx vitest run    # Run tests
```

The dev server expects the Rust API at `localhost:3000` (WebSocket at `/ws`,
REST at `/api/*`).

## Key Features

- **WebSocket game session** — Real-time narration, state deltas, voice audio
- **Genre theming** — CSS variables driven by genre pack `theme.yaml`
- **Audio engine** — Three-channel mixer (music with crossfade, SFX, voice)
- **Local speech-to-text** — Whisper running in-browser via `@huggingface/transformers`
- **Push-to-talk** — WebRTC voice input with server-side TTS playback
- **Slash commands** — `/look`, `/inventory`, `/map` etc. parsed client-side

## Stack

- React 19 + TypeScript 5.9
- Vite 8
- Tailwind CSS 4 + shadcn/ui (base-nova style)
- Vitest + React Testing Library
- lucide-react for icons

## Related Repos

- [orc-quest](https://github.com/slabgorb/orc-quest) — Orchestrator (sprint tracking, ADRs, genre packs)
- [sidequest-api](https://github.com/slabgorb/sidequest-api) — Rust backend
- [sidequest-daemon](https://github.com/slabgorb/sidequest-daemon) — Python media services
