import { KnowledgeJournal, type KnowledgeEntry } from "@/components/KnowledgeJournal";

interface KnowledgeWidgetProps {
  entries: KnowledgeEntry[];
  /** Character backstory — absorbed from the old Lore panel. Renders as
   *  a header section above the discovered-facts list. */
  backstory?: string;
}

export function KnowledgeWidget({ entries, backstory }: KnowledgeWidgetProps) {
  return <KnowledgeJournal entries={entries} backstory={backstory} />;
}
