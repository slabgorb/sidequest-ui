import { useState, useCallback, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface InputBarProps {
  onSend: (text: string, aside: boolean) => void;
  disabled?: boolean;
  mobile?: boolean;
  thinking?: boolean;
  waitingForPlayer?: string;
}

export default function InputBar({
  onSend,
  disabled,
  mobile,
  thinking,
  waitingForPlayer,
}: InputBarProps) {
  const [text, setText] = useState("");
  const [aside, setAside] = useState(false);

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

  const placeholder =
    waitingForPlayer ? `Waiting for ${waitingForPlayer}…` :
    thinking ? "The narrator is thinking..." :
    aside ? "What do you whisper?" :
    "What do you do?";

  return (
    <div data-testid="input-bar" className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center flex-1">
          {aside && (
            <span className="text-muted-foreground/40 text-lg pl-1 select-none">(</span>
          )}
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
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
    </div>
  );
}
