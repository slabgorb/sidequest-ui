import { ConfrontationOverlay, type ConfrontationData } from "@/components/ConfrontationOverlay";
import type { DiceRequestPayload, DiceResultPayload, DiceThrowParams } from "@/types/payloads";

interface ConfrontationWidgetProps {
  data: ConfrontationData;
  onBeatSelect?: (beatId: string) => void;
  diceRequest?: DiceRequestPayload | null;
  diceResult?: DiceResultPayload | null;
  playerId?: string;
  onDiceThrow?: (params: DiceThrowParams, face: number[]) => void;
}

export function ConfrontationWidget({ data, onBeatSelect, diceRequest, diceResult, playerId, onDiceThrow }: ConfrontationWidgetProps) {
  return (
    <ConfrontationOverlay
      data={data}
      onBeatSelect={onBeatSelect}
      inline
      diceRequest={diceRequest}
      diceResult={diceResult}
      playerId={playerId}
      onDiceThrow={onDiceThrow}
    />
  );
}
