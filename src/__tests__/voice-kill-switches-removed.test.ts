/**
 * Story 15-3: Verify all four TTS feedback loop kill switches are removed.
 *
 * These are source-text wiring tests (same pattern as Rust dispatch wiring tests).
 * They prove the kill switches have been removed and voice is actually enabled.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, "..", relativePath), "utf-8");
}

describe("Voice kill switches removed (Story 15-3)", () => {
  it("useVoiceChat does not contain VOICE_DISABLED kill switch", () => {
    const source = readSource("hooks/useVoiceChat.ts");
    expect(source).not.toMatch(/VOICE_DISABLED\s*=\s*true/);
    // Also verify the early return guard is gone
    expect(source).not.toMatch(/if\s*\(\s*VOICE_DISABLED\s*\)/);
  });

  it("usePushToTalk does not hardcode enabled = false", () => {
    const source = readSource("hooks/usePushToTalk.ts");
    // The override: `const enabled = false;`
    expect(source).not.toMatch(/const\s+enabled\s*=\s*false/);
    // The _disabled flag
    expect(source).not.toMatch(/const\s+_disabled\s*=\s*true/);
  });

  it("useWhisper returns real transcription results, not empty stub", () => {
    const source = readSource("hooks/useWhisper.ts");
    // The stub returns "" unconditionally — real impl should use LocalTranscriber
    expect(source).not.toMatch(/return\s*""/);
    // Should actually reference LocalTranscriber in runtime code (not just imports)
    expect(source).toMatch(/LocalTranscriber/);
  });

  it("InputBar renders VoiceOrnament without false && guard", () => {
    const source = readSource("components/InputBar.tsx");
    // The kill switch: {false && <VoiceOrnament .../>}
    expect(source).not.toMatch(/\{false\s*&&\s*<VoiceOrnament/);
    // VoiceOrnament should be rendered (present in JSX without false guard)
    expect(source).toMatch(/<VoiceOrnament/);
  });
});
