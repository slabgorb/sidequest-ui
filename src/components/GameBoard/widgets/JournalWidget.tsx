import { JournalView } from "@/components/JournalView";
import type { JournalEntry } from "@/providers/GameStateProvider";

interface JournalWidgetProps {
  entries: JournalEntry[];
}

export function JournalWidget({ entries }: JournalWidgetProps) {
  return <JournalView entries={entries} />;
}
