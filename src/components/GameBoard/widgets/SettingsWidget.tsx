import { SettingsPanel, type SettingsPanelProps } from "@/components/SettingsPanel";

type SettingsWidgetProps = SettingsPanelProps;

export function SettingsWidget(props: SettingsWidgetProps) {
  return <SettingsPanel {...props} />;
}
