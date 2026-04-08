import { NarrativeView } from "@/screens/NarrativeView";
import type { GameMessage } from "@/types/protocol";

interface NarrativeWidgetProps {
  messages: GameMessage[];
  thinking?: boolean;
}

export function NarrativeWidget({ messages, thinking }: NarrativeWidgetProps) {
  return <NarrativeView messages={messages} thinking={thinking} />;
}
