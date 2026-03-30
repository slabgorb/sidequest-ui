import { useMemo } from "react";
import type { GameSnapshot } from "../types";

export interface DiffEntry {
  path: string;
  type: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
}

function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix: string,
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const bVal = before[key];
    const aVal = after[key];

    if (!(key in before)) {
      entries.push({ path, type: "added", after: aVal });
    } else if (!(key in after)) {
      entries.push({ path, type: "removed", before: bVal });
    } else if (
      typeof bVal === "object" &&
      bVal !== null &&
      typeof aVal === "object" &&
      aVal !== null &&
      !Array.isArray(bVal) &&
      !Array.isArray(aVal)
    ) {
      entries.push(
        ...diffObjects(
          bVal as Record<string, unknown>,
          aVal as Record<string, unknown>,
          path,
        ),
      );
    } else if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      entries.push({ path, type: "changed", before: bVal, after: aVal });
    }
  }

  return entries;
}

export function useTurnDiff(
  before: GameSnapshot | null,
  after: GameSnapshot | null,
): DiffEntry[] {
  return useMemo(() => {
    if (!before || !after) return [];
    return diffObjects(
      before as Record<string, unknown>,
      after as Record<string, unknown>,
      "",
    );
  }, [before, after]);
}
