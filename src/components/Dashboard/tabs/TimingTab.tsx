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

      {/* Phase breakdown — only renders when phase_durations_ms is present.
          Older servers (pre-phase-timing) don't ship it; the card just
          short-circuits in that case. */}
      <PhaseBreakdownCard turnFields={turnFields} />

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

function PhaseBreakdownCard({ turnFields }: { turnFields: TurnCompleteFields[] }) {
  const latest = useMemo(() => {
    for (let i = turnFields.length - 1; i >= 0; i--) {
      const f = turnFields[i];
      if (f.phase_durations_ms && Object.keys(f.phase_durations_ms).length > 0) {
        return f;
      }
    }
    return null;
  }, [turnFields]);

  const averages = useMemo(() => {
    const totals: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const f of turnFields) {
      const phases = f.phase_durations_ms;
      if (!phases) continue;
      for (const [name, ms] of Object.entries(phases)) {
        totals[name] = (totals[name] || 0) + ms;
        counts[name] = (counts[name] || 0) + 1;
      }
    }
    return Object.entries(totals)
      .map(([name, sum]) => ({ name, avgMs: Math.round(sum / counts[name]), turns: counts[name] }))
      .sort((a, b) => b.avgMs - a.avgMs);
  }, [turnFields]);

  if (!latest && averages.length === 0) {
    return null;
  }

  const latestPhases = latest?.phase_durations_ms ?? {};
  const latestCallCounts = latest?.phase_call_counts ?? {};
  const latestTotal = latest?.total_duration_ms ?? 0;
  const latestUnaccounted = latest?._unaccounted_ms ?? 0;
  const latestRows = Object.entries(latestPhases)
    .map(([name, ms]) => ({ name, ms, calls: latestCallCounts[name] ?? 1 }))
    .sort((a, b) => b.ms - a.ms);

  return (
    <Card title="Phase Breakdown">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div
            style={{
              color: THEME.muted,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            Latest Turn — total {(latestTotal / 1000).toFixed(2)}s
          </div>
          {latestRows.length === 0 ? (
            <div style={{ color: THEME.muted, fontSize: 11 }}>No phase data yet</div>
          ) : (
            <>
              {latestRows.map((p) => (
                <PhaseRow
                  key={p.name}
                  name={p.name}
                  ms={p.ms}
                  calls={p.calls}
                  totalMs={latestTotal || 1}
                />
              ))}
              {latestUnaccounted > 0 && (
                <PhaseRow
                  name="_unaccounted"
                  ms={latestUnaccounted}
                  calls={1}
                  totalMs={latestTotal || 1}
                  muted
                />
              )}
            </>
          )}
        </div>
        <div>
          <div
            style={{
              color: THEME.muted,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            Average across {averages[0]?.turns ?? 0} turn(s)
          </div>
          {averages.length === 0 ? (
            <div style={{ color: THEME.muted, fontSize: 11 }}>No phase data yet</div>
          ) : (
            averages.map((p) => (
              <div
                key={p.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "3px 0",
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              >
                <span style={{ color: THEME.text }}>{p.name}</span>
                <span style={{ color: THEME.muted }}>{(p.avgMs / 1000).toFixed(2)}s</span>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function PhaseRow({
  name,
  ms,
  calls,
  totalMs,
  muted,
}: {
  name: string;
  ms: number;
  calls: number;
  totalMs: number;
  muted?: boolean;
}) {
  const pct = totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 8,
        alignItems: "center",
        padding: "3px 0",
        fontSize: 12,
        fontFamily: "monospace",
      }}
    >
      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${pct}%`,
            background: muted ? THEME.border : THEME.accent,
            opacity: muted ? 0.4 : 0.25,
          }}
        />
        <span
          style={{
            position: "relative",
            color: muted ? THEME.muted : THEME.text,
            fontStyle: muted ? "italic" : "normal",
          }}
        >
          {name}
          {calls > 1 ? ` ×${calls}` : ""}
        </span>
      </div>
      <span style={{ color: THEME.muted, minWidth: 50, textAlign: "right" }}>
        {(ms / 1000).toFixed(2)}s
      </span>
      <span style={{ color: THEME.muted, minWidth: 32, textAlign: "right" }}>{pct}%</span>
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
