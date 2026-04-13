import { KnowledgeJournal } from "@/components/KnowledgeJournal";
import type { KnowledgeEntry } from "@/providers/GameStateProvider";

interface KnowledgeWidgetProps {
  entries: KnowledgeEntry[];
}

export function KnowledgeWidget({ entries }: KnowledgeWidgetProps) {
  return <KnowledgeJournal entries={entries} />;
}
