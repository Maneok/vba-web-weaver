import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
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
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;
  const [, setForceUpdate] = useState(0);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.4);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
  }, []);

  const handleReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (!nodes || nodes.length === 0) return;
    if (nodes.length === 1 && (!edges || edges.length === 0)) return;
    const nodeIds = new Set(nodes.map(n => n.id));
    const safeEdges = (edges ?? []).filter(e => e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target));

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;
    setForceUpdate(v => v + 1); // trigger re-render so buttons have ref

    // Build simulation data
    const simNodes = nodes.map(n => ({ ...n, x: width / 2, y: height / 2 }));
    const simEdges = safeEdges.map(e => ({
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

    // Role-based edge coloring
    const roleColor = (label: string): string => {
      const l = (label ?? "").toLowerCase();
      if (l.includes("président") || l.includes("president")) return "rgba(59, 130, 246, 0.5)";
      if (l.includes("gérant") || l.includes("gerant")) return "rgba(16, 185, 129, 0.5)";
      if (l.includes("associé") || l.includes("associe")) return "rgba(249, 115, 22, 0.5)";
      if (l.includes("directeur")) return "rgba(139, 92, 246, 0.5)";
      return "rgba(148, 163, 184, 0.2)";
    };

    // Edges
    const link = g.append("g")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", d => roleColor(d.label))
      .attr("stroke-width", 1.5);

    // Edge labels
    const linkLabel = g.append("g")
      .selectAll("text")
      .data(simEdges)
      .join("text")
      .text(d => {
        const parts = (d.label ?? "").split(" (");
        return parts[0];
      })
      .attr("font-size", "8px")
      .attr("fill", d => roleColor(d.label).replace("0.5)", "0.8)"))
      .attr("text-anchor", "middle");

    link.append("title").text(d => d.label);

    // Nodes - size proportional to connections
    const connectionCount = new Map<string, number>();
    safeEdges.forEach(e => {
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

    node.on("click", (_event, d: any) => {
      if (onNodeClickRef.current) {
        onNodeClickRef.current(d as NetworkNode);
      } else {
        if (d.type === "company" && d.siren) {
          window.open(`https://www.pappers.fr/entreprise/${d.siren}`, "_blank", "noopener,noreferrer");
        }
      }
    });

    // Node circles
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

    return () => {
      simulation.stop();
      simulation.on("tick", null);
      node.on("click", null);
      node.on(".drag", null);
      svg.on(".zoom", null);
      svg.selectAll("*").remove();
    };
  }, [nodes, edges, width, height]);

  // C3: Empty state with SVG illustration
  if (nodes.length === 0 || (nodes.length === 1 && (!edges || edges.length === 0))) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-4">
        <div className="w-20 h-20 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center">
          <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth="1.2">
            {/* Network nodes illustration */}
            <circle cx="24" cy="12" r="4" />
            <circle cx="12" cy="32" r="4" />
            <circle cx="36" cy="32" r="4" />
            <line x1="24" y1="16" x2="12" y2="28" />
            <line x1="24" y1="16" x2="36" y2="28" />
            <line x1="12" y1="32" x2="36" y2="32" strokeDasharray="3 3" />
          </svg>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm font-medium">Aucun reseau de direction detecte</p>
          <p className="text-slate-300 dark:text-slate-600 text-xs max-w-[260px]">Les relations entre dirigeants et societes apparaitront ici apres le screening.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* C2: Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10 print:hidden">
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] hover:bg-white/[0.12] border border-gray-300 dark:border-white/[0.08] flex items-center justify-center text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          aria-label="Zoomer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] hover:bg-white/[0.12] border border-gray-300 dark:border-white/[0.08] flex items-center justify-center text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          aria-label="Dezoomer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] hover:bg-white/[0.12] border border-gray-300 dark:border-white/[0.08] flex items-center justify-center text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          aria-label="Reinitialiser le zoom"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <svg
        ref={svgRef}
        role="img"
        aria-label="Graphe du reseau de relations entre entites"
        width={width}
        height={height}
        className="w-full"
        viewBox={`0 0 ${width} ${height}`}
        style={{ background: "rgba(0,0,0,0.1)", borderRadius: "8px" }}
      />

      {/* C1: Legend */}
      <div className="flex items-center gap-4 mt-2 px-2 text-[10px] text-slate-400 dark:text-slate-500 print:hidden">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-blue-500/30" />
          <span>Entreprise cible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-[1.5px] border-emerald-500 bg-emerald-500/15" />
          <span>Societe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-[1.5px] border-orange-500 bg-orange-500/15" />
          <span>Personne physique</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1 bg-slate-500/40 rounded" />
          <span>Lien de direction</span>
        </div>
      </div>
    </div>
  );
}
