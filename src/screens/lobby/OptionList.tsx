import { useCallback, useRef } from "react";

/**
 * A single selectable row in an `OptionList`.
 *
 * `annotation` is an optional suffix (e.g., "· 2 here" for a world that
 * has active players in it). `hint` is an optional lowercase tag shown
 * next to the label (e.g., "mythic", "gritty") for genre rows.
 */
export interface OptionItem {
  slug: string;
  label: string;
  hint?: string;
  annotation?: React.ReactNode;
}

export interface OptionListProps {
  /** Accessibility label describing what the list is for (e.g., "Genre"). */
  ariaLabel: string;
  items: OptionItem[];
  /** Currently selected slug, or `null` if nothing is selected. */
  selected: string | null;
  /** Called when the user picks a different item. */
  onSelect: (slug: string) => void;
  /** Disable all interaction (during connect). */
  disabled?: boolean;
}

/**
 * Scrollable radio-group used for both genre and world selection in the lobby.
 *
 * Pattern: WAI-ARIA radiogroup. Arrow keys move selection through the items;
 * Home/End jump to ends. The selected row gets a subtle border accent. The
 * component is fully keyboard-navigable and does not require a mouse.
 */
export function OptionList({
  ariaLabel,
  items,
  selected,
  onSelect,
  disabled = false,
}: OptionListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || items.length === 0) return;
      const currentIndex = items.findIndex((i) => i.slug === selected);

      let nextIndex = currentIndex;
      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
          nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
          break;
        case "ArrowUp":
        case "ArrowLeft":
          nextIndex =
            currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      onSelect(items[nextIndex].slug);

      // Move focus to the new radio to match WAI-ARIA roving-tabindex pattern.
      const nextEl = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-slug="${items[nextIndex].slug}"]`,
      );
      nextEl?.focus();
    },
    [items, selected, onSelect, disabled],
  );

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className="flex flex-col w-full"
    >
      {items.map((item) => {
        const isSelected = item.slug === selected;
        return (
          <button
            key={item.slug}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-slug={item.slug}
            tabIndex={isSelected || (!selected && item === items[0]) ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelect(item.slug)}
            className={`
              flex items-baseline justify-between
              w-full text-left px-3 py-1.5
              bg-transparent border-0 border-l-2
              transition-colors cursor-pointer
              disabled:cursor-default disabled:opacity-40
              focus-visible:outline-none focus-visible:bg-muted/20
              ${
                isSelected
                  ? "border-l-foreground/60 text-foreground"
                  : "border-l-transparent text-foreground/60 hover:border-l-muted-foreground/40 hover:text-foreground/85"
              }
            `}
          >
            <span className="flex items-baseline gap-2">
              <span className="text-base tracking-wide">{item.label}</span>
              {item.hint && (
                <span className="text-xs italic text-muted-foreground/50">
                  {item.hint}
                </span>
              )}
            </span>
            {item.annotation && (
              <span className="text-xs text-muted-foreground/70 tabular-nums">
                {item.annotation}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
