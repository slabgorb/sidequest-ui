import { useRef, useEffect } from "react";
import * as d3 from "d3";
import type { TurnSpan } from "@/types/watcher";
import { SPAN_COLORS, THEME } from "../shared/constants";

interface Props {
  spans: TurnSpan[];
  totalMs: number;
}

const ROW_HEIGHT = 22;
const LABEL_WIDTH = 120;
const DUR_WIDTH = 70;

export function FlameChart({ spans, totalMs }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || spans.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const chartWidth = svgRef.current.clientWidth - LABEL_WIDTH - DUR_WIDTH;
    const height = spans.length * ROW_HEIGHT + 24; // extra for axis
    svg.attr("height", height);

    const maxTime = Math.max(totalMs, ...spans.map((s) => (s.start_ms || 0) + (s.duration_ms || 0)));
    const x = d3.scaleLinear().domain([0, maxTime]).range([0, chartWidth]);

    // Rows
    const rows = svg
      .selectAll("g.row")
      .data(spans)
      .enter()
      .append("g")
      .attr("class", "row")
      .attr("transform", (_, i) => `translate(0, ${i * ROW_HEIGHT})`);

    // Labels
    rows
      .append("text")
      .attr("x", LABEL_WIDTH - 8)
      .attr("y", ROW_HEIGHT / 2 + 4)
      .attr("text-anchor", "end")
      .attr("fill", THEME.muted)
      .attr("font-size", 11)
      .text((d) => d.name || d.component);

    // Bars
    rows
      .append("rect")
      .attr("x", (d) => LABEL_WIDTH + x(d.start_ms || 0))
      .attr("y", 1)
      .attr("width", (d) => Math.max(x(d.duration_ms || 1), 2))
      .attr("height", ROW_HEIGHT - 2)
      .attr("rx", 2)
      .attr("fill", (d) => SPAN_COLORS[d.name] || SPAN_COLORS[d.component] || "#666")
      .append("title")
      .text((d) => `${d.name}: ${d.duration_ms}ms`);

    // Duration labels
    rows
      .append("text")
      .attr("x", LABEL_WIDTH + chartWidth + 8)
      .attr("y", ROW_HEIGHT / 2 + 4)
      .attr("fill", THEME.muted)
      .attr("font-size", 11)
      .text((d) => `${d.duration_ms}ms`);

    // Time axis
    const axisY = spans.length * ROW_HEIGHT + 4;
    svg
      .append("text")
      .attr("x", LABEL_WIDTH)
      .attr("y", axisY + 12)
      .attr("fill", THEME.muted)
      .attr("font-size", 10)
      .text("0ms");
    svg
      .append("text")
      .attr("x", LABEL_WIDTH + chartWidth / 2)
      .attr("y", axisY + 12)
      .attr("text-anchor", "middle")
      .attr("fill", THEME.muted)
      .attr("font-size", 10)
      .text(`${Math.round(maxTime / 2)}ms`);
    svg
      .append("text")
      .attr("x", LABEL_WIDTH + chartWidth)
      .attr("y", axisY + 12)
      .attr("text-anchor", "end")
      .attr("fill", THEME.muted)
      .attr("font-size", 10)
      .text(`${maxTime}ms`);
  }, [spans, totalMs]);

  if (spans.length === 0) {
    return <div style={{ color: THEME.muted }}>Select a turn to view spans</div>;
  }

  return <svg ref={svgRef} width="100%" />;
}
