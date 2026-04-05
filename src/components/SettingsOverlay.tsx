import { useCallback, useEffect, type ReactNode } from 'react';
import { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';

export interface SettingsOverlayProps {
  settingsProps?: SettingsPanelProps;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (el.getAttribute('contenteditable') != null) return true;
  return false;
}

export function SettingsOverlay({ settingsProps, isOpen, onToggle, onClose, children }: SettingsOverlayProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isTextInput(document.activeElement)) return;

      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {children}
      {isOpen && (
        <div
          data-testid="settings-backdrop"
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
          onClick={onClose}
        >
          <div
            className="bg-background border rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {settingsProps && <SettingsPanel {...settingsProps} />}
          </div>
        </div>
      )}
    </>
  );
}
