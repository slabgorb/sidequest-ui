import { useState, type ReactNode } from "react";
import { BookOpen, User, Map, Package, BookMarked, Image } from "lucide-react";
import type { WidgetId } from "./widgetRegistry";

interface MobileTab {
  id: WidgetId;
  label: string;
  icon: ReactNode;
}

const TABS: MobileTab[] = [
  { id: "narrative", label: "Story", icon: <BookOpen size={18} /> },
  { id: "character", label: "Character", icon: <User size={18} /> },
  { id: "map", label: "Map", icon: <Map size={18} /> },
  { id: "inventory", label: "Items", icon: <Package size={18} /> },
  { id: "gallery", label: "Gallery", icon: <Image size={18} /> },
  { id: "knowledge", label: "Journal", icon: <BookMarked size={18} /> },
];

interface MobileTabViewProps {
  renderWidget: (id: WidgetId) => ReactNode;
  availableWidgets: Set<WidgetId>;
  children?: ReactNode; // InputBar slot
}

export function MobileTabView({ renderWidget, availableWidgets, children }: MobileTabViewProps) {
  const [activeTab, setActiveTab] = useState<WidgetId>("narrative");

  const visibleTabs = TABS.filter(t => t.id === "narrative" || availableWidgets.has(t.id));

  return (
    <div className="flex flex-col h-screen">
      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {renderWidget(activeTab)}
      </div>

      {/* Input bar */}
      {children && (
        <div className="border-t border-border/50 px-4 py-3 bg-card/50 shrink-0">
          {children}
        </div>
      )}

      {/* Tab bar */}
      <nav className="flex border-t border-border/50 bg-card shrink-0" role="tablist">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
              activeTab === tab.id
                ? "text-[var(--primary,hsl(var(--primary)))]"
                : "text-muted-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
