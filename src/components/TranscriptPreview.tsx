import type { PTTState } from "@/hooks/usePushToTalk";

interface TranscriptPreviewProps {
  transcript: string;
  state: PTTState;
  onConfirm: () => void;
  onDiscard: () => void;
  onEdit: (text: string) => void;
}

export function TranscriptPreview({
  transcript,
  state,
  onConfirm,
  onDiscard,
  onEdit,
}: TranscriptPreviewProps) {
  if (state === "idle") return null;

  if (state === "recording") {
    return <div className="transcript-preview">Recording...</div>;
  }

  if (state === "transcribing") {
    return <div className="transcript-preview">Transcribing...</div>;
  }

  return (
    <div className="transcript-preview">
      <input
        type="text"
        value={transcript}
        onChange={(e) => onEdit(e.target.value)}
        autoFocus
      />
      <div className="transcript-actions">
        <button onClick={onConfirm}>Confirm (Enter)</button>
        <button onClick={onDiscard}>Discard (Esc)</button>
      </div>
    </div>
  );
}
