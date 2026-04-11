import { AudioStatus, type AudioStatusProps } from "@/components/AudioStatus";

type AudioWidgetProps = AudioStatusProps;

export function AudioWidget(props: AudioWidgetProps) {
  return <AudioStatus {...props} />;
}
