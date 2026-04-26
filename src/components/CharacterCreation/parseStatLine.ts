/**
 * Detect the stat-line shape the server emits for `character_preview.stats`
 * (see `chargen_summary.py` ~line 193 — `"  ".join(f"{name} {val}" for ...)`)
 * and split it into (label, value) pairs. Returns `null` for any other
 * value so non-stat rows fall through to the default plain-text render.
 *
 * Conservative on purpose: only values whose every token pair matches
 * `<2-4 uppercase letters> <signed integer>` are reformatted. Prose like
 * "Returned from the Colonies" or class names like "Beastkin" stay text.
 *
 * Lives in its own module (instead of next to `CharacterCreation`) because
 * react-refresh requires component files to export only components — and
 * the unit test for this helper imports it directly.
 */
export function parseStatLine(value: unknown): Array<[string, string]> | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 4 || tokens.length % 2 !== 0) return null;
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const label = tokens[i];
    const num = tokens[i + 1];
    if (!/^[A-Z]{2,4}$/.test(label)) return null;
    if (!/^-?\d+$/.test(num)) return null;
    pairs.push([label, num]);
  }
  return pairs;
}
