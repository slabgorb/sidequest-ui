import { KnowledgeJournal, type KnowledgeEntry } from "@/components/KnowledgeJournal";

interface KnowledgeWidgetProps {
  entries: KnowledgeEntry[];
}

export function KnowledgeWidget({ entries }: KnowledgeWidgetProps) {
  return <KnowledgeJournal entries={entries} />;
}
