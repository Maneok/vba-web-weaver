import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { NetworkNode, NetworkEdge } from "@/lib/kycService";

interface Props {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
}

export default function NetworkGraph({ nodes, edges, width = 700, height = 500, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Build simulation data
    const simNodes = nodes.map(n => ({ ...n, x: width / 2, y: height / 2 }));
    const simEdges = edges.map(e => ({
      ...e,
      source: e.source,
      target: e.target,
    }));

    const simulation = d3.forceSimulation(simNodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(simEdges as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d: any) => d.id)
        .distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    // Edges
    const link = g.append("g")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", "rgba(148, 163, 184, 0.2)")
      .attr("stroke-width", 1.5);

    // Edge labels
    const linkLabel = g.append("g")
      .selectAll("text")
      .data(simEdges)
      .join("text")
      .text(d => d.label)
      .attr("font-size", "8px")
      .attr("fill", "#64748b")
      .attr("text-anchor", "middle");

    // Nodes - size proportional to connections
    const connectionCount = new Map<string, number>();
    edges.forEach(e => {
      connectionCount.set(e.source, (connectionCount.get(e.source) ?? 0) + 1);
      connectionCount.set(e.target, (connectionCount.get(e.target) ?? 0) + 1);
    });

    const node = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .style("cursor", "pointer")
      .call(d3.drag<SVGGElement, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Click handler
    node.on("click", (_event, d: any) => {
      if (onNodeClick) {
        onNodeClick(d as NetworkNode);
      } else {
        // Default: open Pappers for companies
        if (d.type === "company" && d.siren) {
          window.open(`https://www.pappers.fr/entreprise/${d.siren}`, "_blank");
        }
      }
    });

    // Node circles - size proportional to connections
    node.append("circle")
      .attr("r", d => {
        const count = connectionCount.get(d.id) ?? 1;
        if (d.isSource) return 22;
        if (d.type === "company") return Math.min(12 + count * 2, 20);
        return Math.min(10 + count * 2, 18);
      })
      .attr("fill", d => {
        if (d.isSource) return "rgba(59, 130, 246, 0.3)";
        if (d.type === "company") return "rgba(16, 185, 129, 0.15)";
        return "rgba(249, 115, 22, 0.15)";
      })
      .attr("stroke", d => {
        if (d.isSource) return "#3b82f6";
        if (d.type === "company") return "#10b981";
        return "#f97316";
      })
      .attr("stroke-width", d => d.isSource ? 2.5 : 1.5);

    // Node icons
    node.append("text")
      .text(d => d.type === "company" ? "\u{1F3E2}" : "\u{1F464}")
      .attr("font-size", d => d.isSource ? "14px" : "10px")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central");

    // Node labels
    node.append("text")
      .text(d => d.label.length > 20 ? d.label.slice(0, 18) + "\u2026" : d.label)
      .attr("font-size", "9px")
      .attr("fill", "#e2e8f0")
      .attr("text-anchor", "middle")
      .attr("dy", d => (d.isSource ? 30 : d.type === "company" ? 26 : 22));

    // SIREN label for companies
    node.filter(d => d.type === "company" && !!d.siren && !d.isSource)
      .append("text")
      .text(d => d.siren ?? "")
      .attr("font-size", "7px")
      .attr("fill", "#64748b")
      .attr("text-anchor", "middle")
      .attr("dy", d => (d.type === "company" ? 38 : 34));

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkLabel
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [nodes, edges, width, height, onNodeClick]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-slate-500 text-sm">
        Aucune donnee de reseau disponible
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="w-full"
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: "rgba(0,0,0,0.1)", borderRadius: "8px" }}
    />
  );
}
