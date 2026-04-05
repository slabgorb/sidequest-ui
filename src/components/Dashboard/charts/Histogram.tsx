import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { AGENT_COLORS, THEME } from "../shared/constants";

interface Props {
  durations: { ms: number; agent: string }[];
}

export function Histogram({ durations }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || durations.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 180;
    const margin = { top: 10, right: 10, bottom: 30, left: 40 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const values = durations.map((d) => d.ms / 1000);
    const x = d3.scaleLinear().domain([0, d3.max(values) || 10]).nice().range([0, w]);
    const bins = d3.bin().domain(x.domain() as [number, number]).thresholds(10)(values);
    const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length) || 1]).range([h, 0]);

    // Bars
    g.selectAll("rect")
      .data(bins)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.x0 || 0) + 1)
      .attr("y", (d) => y(d.length))
      .attr("width", (d) => Math.max(x(d.x1 || 0) - x(d.x0 || 0) - 2, 1))
      .attr("height", (d) => h - y(d.length))
      .attr("rx", 2)
      .attr("fill", THEME.purple);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d) => `${d}s`))
      .selectAll("text")
      .attr("fill", THEME.muted);

    g.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .attr("fill", THEME.muted);

    // Style axis lines
    g.selectAll(".domain, line").attr("stroke", THEME.border);
  }, [durations]);

  if (durations.length === 0) {
    return <div style={{ color: THEME.muted, fontSize: 11 }}>No data yet</div>;
  }

  return <svg ref={svgRef} width="100%" />;
}
