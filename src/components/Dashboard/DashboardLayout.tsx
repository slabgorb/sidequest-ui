import { useCallback, useEffect, useState } from "react";
import type { DashboardState, DashboardTab } from "./types";
import { ConnectionBadge } from "./shared/ConnectionBadge";
import { TabBar, TABS } from "./shared/TabBar";
import { TimelineTab } from "./tabs/Timeline/TimelineTab";
import { SubsystemsTab } from "./tabs/Subsystems/SubsystemsTab";
import { StateTab } from "./tabs/State/StateTab";
import { PersistenceTab } from "./tabs/Persistence/PersistenceTab";
import { ConsoleTab } from "./tabs/Console/ConsoleTab";

interface DashboardLayoutProps {
  state: DashboardState;
}

export function DashboardLayout({ state }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("timeline");

  // Keyboard shortcuts: 1-5 to switch tabs
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= TABS.length) {
        setActiveTab(TABS[idx - 1].id);
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        background: "#1a1a2e",
        color: "#eee",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "#333", background: "#12122a" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: "#ddd" }}>
            GM Dashboard
          </span>
          <ConnectionBadge connected={state.connected} />
        </div>
        <div className="text-xs font-mono" style={{ color: "#666" }}>
          SideQuest Observability
        </div>
      </div>

      {/* Tab bar */}
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        turnCount={state.turns.length}
        eventCount={state.rawEvents.length}
      />

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "timeline" && <TimelineTab turns={state.turns} />}
        {activeTab === "subsystems" && (
          <SubsystemsTab
            turns={state.turns}
            histogram={state.histogram}
            tropes={state.tropes}
          />
        )}
        {activeTab === "state" && <StateTab turns={state.turns} />}
        {activeTab === "persistence" && (
          <PersistenceTab snapshot={state.latestSnapshot} turns={state.turns} />
        )}
        {activeTab === "console" && (
          <ConsoleTab events={state.rawEvents} alerts={state.alerts} />
        )}
      </div>
    </div>
  );
}
