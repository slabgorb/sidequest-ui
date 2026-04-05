import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { THEME } from "../shared/constants";

interface Props {
  data: { label: string; value: number }[];
}

const COLORS = [THEME.purple, THEME.teal, THEME.amber, THEME.green, THEME.red, THEME.sky];

export function DonutChart({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const size = 160;
    const radius = size / 2;
    const innerRadius = radius * 0.55;

    svg.attr("width", size + 120).attr("height", size);

    const g = svg.append("g").attr("transform", `translate(${radius},${radius})`);

    const pie = d3.pie<{ label: string; value: number }>().value((d) => d.value).sort(null);
    const arc = d3.arc<d3.PieArcDatum<{ label: string; value: number }>>()
      .innerRadius(innerRadius)
      .outerRadius(radius - 2);

    const arcs = g.selectAll("path").data(pie(data)).enter().append("path");

    arcs
      .attr("d", arc)
      .attr("fill", (_, i) => COLORS[i % COLORS.length])
      .attr("stroke", THEME.bg)
      .attr("stroke-width", 2)
      .append("title")
      .text((d) => `${d.data.label}: ${d.data.value} (${Math.round((d.data.value / d3.sum(data, (d) => d.value)!) * 100)}%)`);

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${size + 8}, 10)`);
    const total = d3.sum(data, (d) => d.value);
    data.forEach((d, i) => {
      const row = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
      row.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", COLORS[i % COLORS.length]);
      row
        .append("text")
        .attr("x", 14)
        .attr("y", 9)
        .attr("fill", THEME.text)
        .attr("font-size", 11)
        .text(`${d.label} ${d.value} (${Math.round((d.value / (total || 1)) * 100)}%)`);
    });
  }, [data]);

  if (data.length === 0) {
    return <div style={{ color: THEME.muted, fontSize: 11 }}>No data yet</div>;
  }

  return <svg ref={svgRef} />;
}
