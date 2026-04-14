# TECH_DEBT.md

Tracked technical debt in `sidequest-ui`. The full test suite went from
"hidden lint errors + 1 flaky test" to "honest green" on 2026-04-14.

## How CI handles these

`.github/workflows/ci.yml` runs `eslint . --cache=false`, `tsc --noEmit`,
and `vitest run` on every PR and push. The `--cache=false` flag is
deliberate — the eslint cache hid 39 errors for an unknown duration after
`eslint-plugin-react-hooks` was bumped to v7 (which added new rules like
`set-state-in-effect` and `refs`). Honest green means we pay the full
lint cost on every CI run.

## Skipped tests

| File | Test | Why |
|---|---|---|
| `src/dice/__tests__/useDiceThrowGesture.test.ts` | `produces higher velocity for faster drags` (AC-2) | Both gestures (50px in 100ms vs 50px in 10ms) saturate `MAX_THROW_SPEED=15` (`PX_TO_VELOCITY=0.03` → saturation at 500 px/s; slow gesture is 500 exactly, fast is 5000). Once saturated the only delta is `Math.random()` jitter on Y. The assertion is mathematically unwinnable. **Fix path:** rewrite with sub-saturation gestures (e.g., 50px in 500ms vs 50px in 100ms) AND `vi.spyOn(Math, 'random').mockReturnValue(...)` for determinism. |

## Lint history (resolved 2026-04-14)

39 lint errors fixed in `chore/ui-ci-and-lint-cleanup`:

- **38 in `src/audio/__tests__/web-audio-mock.ts`** — `no-explicit-any`. Each `vi.fn` mock used `ReturnType<typeof vi.fn<(...args: any[]) => any>>`. Replaced with vitest's `Mock` type from a typed import.
- **1 in `src/dice/useDiceThrowGesture.ts:89`** — `react-hooks/refs` (Cannot update ref during render). The `onThrowRef.current = onThrow` was assigned in render body. Wrapped in `useEffect` so the assignment lives in the commit phase.

## Process rule going forward

**Don't run `npm run lint` and trust the cached result for sign-off.**
The cache only checks file mtime, so when a plugin upgrade changes the
ruleset, the cache happily re-uses old PASS verdicts. CI uses
`--cache=false` for this reason. Locally, run `npx eslint . --cache=false`
before claiming a clean lint.

**Don't write tests where the assertion depends on `Math.random()`.**
The flaky test above is the canonical example — a perfectly correct
implementation can fail the assertion when randomness flips ordering.
Either pin `Math.random` with `vi.spyOn` for the test scope, or design
the assertion to be invariant under random jitter.
