import { useState, type ReactNode } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { WidgetId } from "./widgetRegistry";

export interface WidgetWrapperProps {
  widgetId: WidgetId;
  title: string;
  closable?: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

export function WidgetWrapper({
  widgetId,
  title,
  closable = true,
  onClose,
  children,
  className,
}: WidgetWrapperProps) {
  const [minimized, setMinimized] = useState(false);

  return (
    <div
      data-widget={widgetId}
      className={`flex flex-col h-full rounded-[var(--border-radius,0.375rem)] border border-[var(--border,hsl(var(--border)))] bg-[var(--surface,hsl(var(--card)))] overflow-hidden ${className ?? ""}`}
    >
      {/* Header — drag handle */}
      <div className="widget-drag-handle flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border,hsl(var(--border)))] bg-[color-mix(in_srgb,var(--primary,hsl(var(--primary)))_10%,var(--surface,hsl(var(--card))))] cursor-grab active:cursor-grabbing select-none shrink-0">
        <span className="text-xs font-medium text-[var(--primary,hsl(var(--foreground)))] font-[var(--font-ui,inherit)] flex-1 truncate">
          {title}
        </span>
        <button
          type="button"
          onClick={() => setMinimized(prev => !prev)}
          className="p-0.5 rounded hover:bg-[var(--border,hsl(var(--border)))] text-[var(--primary,hsl(var(--muted-foreground)))] transition-colors"
          aria-label={minimized ? "Expand widget" : "Minimize widget"}
        >
          {minimized ? <Plus size={12} /> : <Minus size={12} />}
        </button>
        {closable && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 rounded hover:bg-[var(--border,hsl(var(--border)))] text-[var(--primary,hsl(var(--muted-foreground)))] transition-colors"
            aria-label="Close widget"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Body */}
      {!minimized && (
        <div className="flex-1 overflow-auto min-h-0" role="region" aria-label={title}>
          {children}
        </div>
      )}
    </div>
  );
}
