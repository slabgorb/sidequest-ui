import { useState, useCallback, useRef, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PTTState } from "@/hooks/usePushToTalk";

export interface InputBarProps {
  onSend: (text: string, aside: boolean) => void;
  disabled?: boolean;
  mobile?: boolean;
  thinking?: boolean;
  micEnabled: boolean;
  onMicToggle: () => void;
  pttState: PTTState;
  onPttStart: () => void;
  onPttStop: () => void;
  transcript: string | null;
  onTranscriptEdit: (text: string) => void;
  onTranscriptConfirm: () => void;
  onTranscriptDiscard: () => void;
  duration: number;
  waitingForPlayer?: string;
}

function RecordingIndicator({ duration }: { duration: number }) {
  return (
    <span className="text-xs tabular-nums text-foreground/70">
      {Math.floor(duration)}s
    </span>
  );
}

function VoiceOrnament({
  micEnabled,
  onMicToggle,
  pttState,
  onPttStart,
  onPttStop,
  duration,
  mobile,
}: {
  micEnabled: boolean;
  onMicToggle: () => void;
  pttState: PTTState;
  onPttStart: () => void;
  onPttStop: () => void;
  duration: number;
  mobile?: boolean;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHold = useRef(false);

  const handleDown = () => {
    isHold.current = false;
    if (!micEnabled) return;
    pressTimer.current = setTimeout(() => {
      isHold.current = true;
      onPttStart();
    }, 200);
  };

  const handleUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (!micEnabled) {
      onMicToggle();
      return;
    }
    if (isHold.current) {
      onPttStop();
    } else {
      onMicToggle();
    }
    isHold.current = false;
  };

  const handleLeave = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (isHold.current) {
      onPttStop();
      isHold.current = false;
    }
  };

  return (
    <button
      data-testid="ptt-button"
      data-mic={micEnabled ? "on" : "off"}
      className={cn(
        "flex items-center justify-center rounded-full transition-all shrink-0",
        mobile ? "w-11 h-11" : "w-8 h-8",
        !micEnabled && "text-muted-foreground/20 hover:text-muted-foreground/40",
        micEnabled && pttState === "idle" && "text-muted-foreground/40 hover:text-muted-foreground/70",
        micEnabled && pttState === "recording" && "text-foreground animate-pulse",
        micEnabled && pttState === "transcribing" && "text-muted-foreground/60",
        micEnabled && pttState === "preview" && "text-muted-foreground/40",
      )}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onMouseLeave={handleLeave}
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
      aria-label={micEnabled ? "Hold to speak · Click to disable voice" : "Enable voice"}
      title={micEnabled ? "Hold to speak · Click to disable" : "Enable voice"}
    >
      {pttState === "recording" ? (
        <RecordingIndicator duration={duration} />
      ) : micEnabled ? (
        <span className="text-sm">✦</span>
      ) : (
        <span className="text-sm">◇</span>
      )}
    </button>
  );
}

export default function InputBar({
  onSend,
  disabled,
  mobile,
  thinking,
  micEnabled,
  onMicToggle,
  pttState,
  onPttStart,
  onPttStop,
  transcript,
  onTranscriptEdit,
  onTranscriptConfirm,
  onTranscriptDiscard,
  duration,
  waitingForPlayer,
}: InputBarProps) {
  const [text, setText] = useState("");
  const [aside, setAside] = useState(false);

  const isPreview = pttState === "preview";

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, aside);
    setText("");
  }, [text, aside, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const handlePreviewKeys = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onTranscriptConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onTranscriptDiscard();
      }
    },
    [onTranscriptConfirm, onTranscriptDiscard],
  );

  const placeholder =
    waitingForPlayer ? `Waiting for ${waitingForPlayer}…` :
    pttState === "recording" ? "Listening..." :
    pttState === "transcribing" ? "Transcribing..." :
    isPreview ? "" :
    thinking ? "The narrator is thinking..." :
    aside ? "What do you whisper?" :
    "What do you do?";

  return (
    <div data-testid="input-bar" className="flex items-center gap-2">
      <VoiceOrnament
        micEnabled={micEnabled}
        onMicToggle={onMicToggle}
        pttState={pttState}
        onPttStart={onPttStart}
        onPttStop={onPttStop}
        duration={duration}
        mobile={mobile}
      />
      <div className="flex items-center flex-1">
        {aside && (
          <span className="text-muted-foreground/40 text-lg pl-1 select-none">(</span>
        )}
        <Input
          value={isPreview ? (transcript ?? "") : text}
          onChange={isPreview
            ? (e) => onTranscriptEdit(e.target.value)
            : (e) => setText(e.target.value)
          }
          onKeyDown={isPreview ? handlePreviewKeys : handleKeyDown}
          disabled={disabled || pttState === "recording" || pttState === "transcribing"}
          placeholder={placeholder}
          className={cn(aside && "text-muted-foreground/70 italic")}
          {...(mobile ? { "data-mobile": "true" } : {})}
        />
        {aside && (
          <span className="text-muted-foreground/40 text-lg pr-1 select-none">)</span>
        )}
      </div>
      <button
        data-testid="aside-toggle"
        className={cn(
          "text-sm transition-colors px-1.5",
          aside
            ? "text-muted-foreground/60"
            : "text-muted-foreground/25 hover:text-muted-foreground/45"
        )}
        onClick={() => setAside(!aside)}
        aria-label={aside ? "Speaking aside (click to speak normally)" : "Click to speak aside"}
        title={aside ? "Speaking aside" : "Aside"}
      >
        (…)
      </button>
    </div>
  );
}
