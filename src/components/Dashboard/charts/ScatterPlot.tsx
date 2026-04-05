import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { AGENT_COLORS, THEME } from "../shared/constants";

interface DataPoint {
  turnIndex: number;
  durationMs: number;
  agent: string;
  degraded: boolean;
}

interface Props {
  data: DataPoint[];
}

export function ScatterPlot({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 180;
    const margin = { top: 10, right: 10, bottom: 30, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([1, data.length]).range([0, w]);
    const maxDur = d3.max(data, (d) => d.durationMs / 1000) || 10;
    const y = d3.scaleLinear().domain([0, maxDur]).nice().range([h, 0]);

    // Moving average (window = 5)
    const movingAvg = data.map((_, i) => {
      const start = Math.max(0, i - 4);
      const slice = data.slice(start, i + 1);
      return d3.mean(slice, (d) => d.durationMs / 1000) || 0;
    });

    const line = d3.line<number>()
      .x((_, i) => x(i + 1))
      .y((d) => y(d));

    g.append("path")
      .datum(movingAvg)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.3)")
      .attr("stroke-width", 1.5)
      .attr("d", line);

    // Points
    g.selectAll("circle")
      .data(data)
      .enter()
      .append(function (d) {
        // Degraded turns get X marks, normal get circles
        if (d.degraded) {
          return document.createElementNS("http://www.w3.org/2000/svg", "text");
        }
        return document.createElementNS("http://www.w3.org/2000/svg", "circle");
      })
      .each(function (d) {
        const el = d3.select(this);
        if (d.degraded) {
          el.attr("x", x(d.turnIndex))
            .attr("y", y(d.durationMs / 1000))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", THEME.red)
            .attr("font-size", 12)
            .text("✕");
        } else {
          el.attr("cx", x(d.turnIndex))
            .attr("cy", y(d.durationMs / 1000))
            .attr("r", 4)
            .attr("fill", AGENT_COLORS[d.agent] || THEME.purple)
            .attr("stroke", THEME.bg)
            .attr("stroke-width", 1);
        }
      })
      .append("title")
      .text((d) => `T${d.turnIndex}: ${(d.durationMs / 1000).toFixed(1)}s (${d.agent})`);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(Math.min(data.length, 10)).tickFormat((d) => `T${d}`))
      .selectAll("text")
      .attr("fill", THEME.muted);

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}s`))
      .selectAll("text")
      .attr("fill", THEME.muted);

    g.selectAll(".domain, line").attr("stroke", THEME.border);
  }, [data]);

  if (data.length === 0) {
    return <div style={{ color: THEME.muted, fontSize: 11 }}>No data yet</div>;
  }

  return <svg ref={svgRef} width="100%" />;
}
