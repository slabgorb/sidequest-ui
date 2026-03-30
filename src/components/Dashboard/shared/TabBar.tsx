import type { DashboardTab } from "../types";

const TABS: { id: DashboardTab; label: string; shortcut: string }[] = [
  { id: "timeline", label: "Timeline", shortcut: "1" },
  { id: "subsystems", label: "Subsystems", shortcut: "2" },
  { id: "state", label: "State", shortcut: "3" },
  { id: "persistence", label: "Persistence", shortcut: "4" },
  { id: "console", label: "Console", shortcut: "5" },
];

interface TabBarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  turnCount: number;
  eventCount: number;
}

export function TabBar({ activeTab, onTabChange, turnCount, eventCount }: TabBarProps) {
  return (
    <div
      className="flex items-center border-b"
      style={{ borderColor: "#333", background: "#16162a" }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className="px-4 py-2 text-xs font-mono transition-colors"
          style={{
            color: activeTab === tab.id ? "#eee" : "#888",
            borderBottom:
              activeTab === tab.id ? "2px solid #58a" : "2px solid transparent",
            background: activeTab === tab.id ? "#1a1a2e" : "transparent",
          }}
        >
          {tab.label}
          <span className="ml-1 opacity-50">{tab.shortcut}</span>
        </button>
      ))}
      <div className="ml-auto px-4 text-xs font-mono" style={{ color: "#666" }}>
        {turnCount} turns / {eventCount} events
      </div>
    </div>
  );
}

export { TABS };
