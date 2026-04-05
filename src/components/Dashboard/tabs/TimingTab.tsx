import { useMemo } from "react";
import type { WatcherEvent, TurnCompleteFields } from "@/types/watcher";
import { Histogram } from "../charts/Histogram";
import { ScatterPlot } from "../charts/ScatterPlot";
import { TokenBarChart } from "../charts/TokenBarChart";
import { DonutChart } from "../charts/DonutChart";
import { THEME, AGENT_COLORS } from "../shared/constants";

interface Props {
  turns: WatcherEvent[];
}

export function TimingTab({ turns }: Props) {
  const turnFields = useMemo(
    () => turns.map((t) => t.fields as TurnCompleteFields),
    [turns],
  );

  // Durations for histogram
  const durations = useMemo(
    () =>
      turnFields
        .map((f) => ({ ms: f.agent_duration_ms || 0, agent: f.agent_name || "?" }))
        .filter((d) => d.ms > 0),
    [turnFields],
  );

  // Scatter data
  const scatterData = useMemo(
    () =>
      turnFields.map((f, i) => ({
        turnIndex: i + 1,
        durationMs: f.agent_duration_ms || 0,
        agent: f.agent_name || "?",
        degraded: !!f.is_degraded,
      })),
    [turnFields],
  );

  // Token data
  const tokenData = useMemo(
    () =>
      turnFields.map((f, i) => ({
        turnIndex: i + 1,
        tokensIn: f.token_count_in || 0,
        tokensOut: f.token_count_out || 0,
      })),
    [turnFields],
  );

  // Extraction tier distribution
  const tierData = useMemo(() => {
    const counts: Record<string, number> = {};
    turnFields.forEach((f) => {
      const tier = f.extraction_tier || "unknown";
      counts[tier] = (counts[tier] || 0) + 1;
    });
    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }, [turnFields]);

  // Per-agent breakdown
  const agentBreakdown = useMemo(() => {
    const agents: Record<string, number[]> = {};
    turnFields.forEach((f) => {
      const name = f.agent_name || "?";
      if (!agents[name]) agents[name] = [];
      agents[name].push(f.agent_duration_ms || 0);
    });
    return Object.entries(agents)
      .map(([name, durs]) => ({
        name,
        avg: durs.reduce((a, b) => a + b, 0) / durs.length,
        count: durs.length,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [turnFields]);

  // Stats
  const sortedDurs = [...durations.map((d) => d.ms)].sort((a, b) => a - b);
  const p50 =
    sortedDurs.length > 0
      ? (sortedDurs[Math.floor(sortedDurs.length * 0.5)] / 1000).toFixed(1) + "s"
      : "—";
  const p95 =
    sortedDurs.length > 0
      ? (sortedDurs[Math.floor(sortedDurs.length * 0.95)] / 1000).toFixed(1) + "s"
      : "—";
  const p99 =
    sortedDurs.length > 0
      ? (sortedDurs[Math.floor(sortedDurs.length * 0.99)] / 1000).toFixed(1) + "s"
      : "—";
  const degradedCount = turnFields.filter((f) => f.is_degraded).length;
  const degradedPct =
    turnFields.length > 0
      ? Math.round((degradedCount / turnFields.length) * 100)
      : 0;

  return (
    <div style={{ padding: 16 }}>
      {/* Summary stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="p50" value={p50} />
        <StatCard label="p95" value={p95} />
        <StatCard label="p99" value={p99} />
        <StatCard
          label="Degraded"
          value={`${degradedCount}/${turnFields.length} (${degradedPct}%)`}
          alert={degradedPct > 10}
        />
      </div>

      {/* Charts grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card title="Agent Duration Histogram">
          <Histogram durations={durations} />
        </Card>
        <Card title="Per-Agent Breakdown">
          {agentBreakdown.length === 0 ? (
            <div style={{ color: THEME.muted, fontSize: 11 }}>No data yet</div>
          ) : (
            agentBreakdown.map((a) => (
              <div
                key={a.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  fontSize: 12,
                }}
              >
                <span style={{ color: AGENT_COLORS[a.name] || THEME.text }}>{a.name}</span>
                <span style={{ color: THEME.muted }}>
                  avg: {(a.avg / 1000).toFixed(1)}s ({a.count} turns)
                </span>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card title="Turn Duration Over Time">
        <ScatterPlot data={scatterData} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card title="Token Usage (in/out per turn)">
          <TokenBarChart data={tokenData} />
        </Card>
        <Card title="Extraction Tier Distribution">
          <DonutChart data={tierData} />
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div
      style={{
        background: THEME.surface,
        border: `1px solid ${THEME.border}`,
        borderRadius: 6,
        padding: "12px 20px",
        textAlign: "center",
        minWidth: 100,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: "bold",
          color: alert ? THEME.red : THEME.accent,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: THEME.muted,
          textTransform: "uppercase",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: THEME.surface,
        border: `1px solid ${THEME.border}`,
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          color: THEME.accent,
          fontSize: 12,
          fontWeight: "bold",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
