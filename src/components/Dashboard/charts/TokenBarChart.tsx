import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { THEME } from "../shared/constants";

interface TokenData {
  turnIndex: number;
  tokensIn: number;
  tokensOut: number;
}

interface Props {
  data: TokenData[];
}

export function TokenBarChart({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 160;
    const margin = { top: 10, right: 10, bottom: 30, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand<number>()
      .domain(data.map((d) => d.turnIndex))
      .range([0, w])
      .padding(0.3);

    const maxTokens = d3.max(data, (d) => Math.max(d.tokensIn, d.tokensOut)) || 1000;
    const y = d3.scaleLinear().domain([0, maxTokens]).nice().range([h, 0]);

    const barWidth = x.bandwidth() / 2;

    // In bars (blue)
    g.selectAll(".bar-in")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.turnIndex)!)
      .attr("y", (d) => y(d.tokensIn))
      .attr("width", barWidth)
      .attr("height", (d) => h - y(d.tokensIn))
      .attr("rx", 2)
      .attr("fill", THEME.sky)
      .append("title")
      .text((d) => `T${d.turnIndex} in: ${d.tokensIn}`);

    // Out bars (teal)
    g.selectAll(".bar-out")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.turnIndex)! + barWidth)
      .attr("y", (d) => y(d.tokensOut))
      .attr("width", barWidth)
      .attr("height", (d) => h - y(d.tokensOut))
      .attr("rx", 2)
      .attr("fill", THEME.teal)
      .append("title")
      .text((d) => `T${d.turnIndex} out: ${d.tokensOut}`);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickFormat((d) => `T${d}`))
      .selectAll("text")
      .attr("fill", THEME.muted)
      .attr("font-size", 9);

    g.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .attr("fill", THEME.muted);

    g.selectAll(".domain, line").attr("stroke", THEME.border);

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${margin.left + 10},${margin.top})`);
    legend.append("rect").attr("width", 8).attr("height", 8).attr("fill", THEME.sky);
    legend.append("text").attr("x", 12).attr("y", 8).attr("fill", THEME.muted).attr("font-size", 10).text("in");
    legend.append("rect").attr("x", 30).attr("width", 8).attr("height", 8).attr("fill", THEME.teal);
    legend.append("text").attr("x", 42).attr("y", 8).attr("fill", THEME.muted).attr("font-size", 10).text("out");
  }, [data]);

  if (data.length === 0) {
    return <div style={{ color: THEME.muted, fontSize: 11 }}>No data yet</div>;
  }

  return <svg ref={svgRef} width="100%" />;
}
