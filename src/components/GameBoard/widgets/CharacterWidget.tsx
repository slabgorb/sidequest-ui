import { CharacterPanel, type CharacterPanelProps } from "@/components/CharacterPanel";

type CharacterWidgetProps = CharacterPanelProps;

export function CharacterWidget(props: CharacterWidgetProps) {
  return <CharacterPanel {...props} />;
}
