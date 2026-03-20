import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { ZoomIn, ZoomOut, RotateCcw, Building2, User, Target, XCircle } from "lucide-react";
import type { NetworkNode, NetworkEdge } from "@/lib/kycService";

interface Props {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
  onNodeDoubleClick?: (node: NetworkNode) => void;
}

export default function NetworkGraph({ nodes, edges, width = 700, height = 500, onNodeClick, onNodeDoubleClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const onNodeClickRef = useRef(onNodeClick);
  const onNodeDoubleClickRef = useRef(onNodeDoubleClick);
  onNodeClickRef.current = onNodeClick;
  onNodeDoubleClickRef.current = onNodeDoubleClick;
  const [, setForceUpdate] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node?: NetworkNode; edge?: NetworkEdge } | null>(null);
  const prevDataSignatureRef = useRef<string>("");

  const hasClosedNode = useMemo(() => nodes.some(n => (n as any).etatAdministratif === "F" || (n as any).etatAdministratif === "C"), [nodes]);

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
    // Skip re-render if data hasn't actually changed (prevents D3 simulation restart)
    const dataSignature = nodes.map(n => n.id).sort().join(",") + "|" + edges.map(e => e.source + "-" + e.target).sort().join(",");
    if (dataSignature === prevDataSignatureRef.current) return;
    prevDataSignatureRef.current = dataSignature;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (!nodes || nodes.length === 0) return;
    if (nodes.length === 1 && (!edges || edges.length === 0)) return;
    const nodeIds = new Set(nodes.map(n => n.id));
    const safeEdges = (edges ?? []).filter(e => e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target));

    const defs = svg.append("defs");

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;
    setForceUpdate(v => v + 1);

    // Connection count for sizing
    const connectionCount = new Map<string, number>();
    safeEdges.forEach(e => {
      connectionCount.set(e.source, (connectionCount.get(e.source) ?? 0) + 1);
      connectionCount.set(e.target, (connectionCount.get(e.target) ?? 0) + 1);
    });

    // Build simulation data — hierarchical initial positions
    const simNodes = nodes.map(n => ({
      ...n,
      x: n.isSource ? width / 2 : width / 2 + (Math.random() - 0.5) * 250,
      y: n.isSource ? height * 0.3 : n.type === "person" ? height * 0.15 + Math.random() * height * 0.2 : height * 0.55 + Math.random() * height * 0.3,
      fx: n.isSource ? width / 2 : undefined,
      fy: n.isSource ? height * 0.3 : undefined,
    }));
    const simEdges = safeEdges.map(e => ({ ...e, source: e.source, target: e.target }));

    const simulation = d3.forceSimulation(simNodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(simEdges as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d: any) => d.id)
        .distance(180))
      .force("charge", d3.forceManyBody().strength(-600))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(65));

    // Pre-calculate all positions silently before rendering
    simulation.stop();
    for (let i = 0; i < 300; i++) simulation.tick();
    // Freeze all nodes at their final positions
    simNodes.forEach(n => { n.fx = (n as any).x; n.fy = (n as any).y; });

    // #6: Role-based edge coloring
    const roleColor = (label: string): string => {
      const l = (label ?? "").toLowerCase();
      if (l.includes("président") || l.includes("president") || l.includes("gérant") || l.includes("gerant")) return "#3b82f6";
      if (l.includes("associé") || l.includes("associe")) return "#10b981";
      if (l.includes("directeur")) return "#8b5cf6";
      return "#64748b";
    };

    // #5: Edge width by role
    const edgeWidth = (label: string): number => {
      const l = (label ?? "").toLowerCase();
      if (l.includes("président") || l.includes("president") || l.includes("gérant") || l.includes("gerant")) return 2;
      if (l.includes("associé") || l.includes("associe")) return 1.5;
      if (l.includes("représentant") || l.includes("representant")) return 1;
      return 0.8;
    };

    // #5: Dashed for indirect/représentant links
    const edgeDash = (label: string): string => {
      const l = (label ?? "").toLowerCase();
      if (l.includes("représentant") || l.includes("representant")) return "4 2";
      return "";
    };

    // Arrow marker
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 0 10 6")
      .attr("refX", 10).attr("refY", 3)
      .attr("markerWidth", 8).attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0L10,3L0,6")
      .attr("fill", "#475569");

    // Edges — curved paths instead of straight lines
    const linkPath = (d: any): string => {
      const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
      const dx = tx - sx, dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Curve offset proportional to distance
      const offset = Math.min(dist * 0.15, 30);
      const mx = (sx + tx) / 2 - (dy / dist) * offset;
      const my = (sy + ty) / 2 + (dx / dist) * offset;
      return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
    };

    const link = g.append("g")
      .selectAll("path")
      .data(simEdges)
      .join("path")
      .attr("d", linkPath)
      .attr("fill", "none")
      .attr("stroke", d => roleColor(d.label))
      .attr("stroke-width", d => edgeWidth(d.label))
      .attr("stroke-dasharray", d => edgeDash(d.label))
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead)")
      .style("cursor", "pointer");

    // #8: Edge tooltip on hover
    link.on("mouseenter", function (event, d: any) {
      d3.select(this).attr("stroke-opacity", 1).attr("stroke-width", edgeWidth(d.label) + 1);
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) {
        setTooltip({
          x: event.clientX - svgRect.left,
          y: event.clientY - svgRect.top - 10,
          edge: d,
        });
      }
    }).on("mouseleave", function (_event, d: any) {
      d3.select(this).attr("stroke-opacity", 0.6).attr("stroke-width", edgeWidth(d.label));
      setTooltip(null);
    });

    // Edge labels with background rect for readability
    const linkLabelGroup = g.append("g")
      .selectAll("g")
      .data(simEdges)
      .join("g")
      .attr("transform", (d: any) => {
        const mx = (d.source.x + d.target.x) / 2;
        const my = (d.source.y + d.target.y) / 2;
        return `translate(${mx},${my - 4})`;
      });

    // Background rect behind label text
    linkLabelGroup.each(function (d: any) {
      const el = d3.select(this);
      const labelText = ((d.label ?? "") as string).split(" (")[0];
      if (!labelText) return;
      // Approximate text width
      const textWidth = labelText.length * 4.5 + 6;
      el.append("rect")
        .attr("x", -textWidth / 2)
        .attr("y", -6)
        .attr("width", textWidth)
        .attr("height", 12)
        .attr("rx", 3)
        .attr("fill", "rgba(15, 23, 42, 0.75)")
        .attr("stroke", "rgba(148, 163, 184, 0.1)")
        .attr("stroke-width", 0.5);
      el.append("text")
        .text(labelText)
        .attr("font-size", "8px")
        .attr("fill", roleColor(d.label))
        .attr("fill-opacity", 0.9)
        .attr("text-anchor", "middle")
        .attr("dy", 3);
    });

    // Nodes — positioned at their final coordinates, no drag
    const node = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .style("cursor", "pointer")
      // #9: Fade-in + scale animation (positions are final, only opacity/scale animate)
      .style("opacity", 0)
      .attr("transform", (d: any) => `translate(${d.x},${d.y}) scale(0.5)`);

    // #9: Animate in (fade + scale only, positions stay fixed)
    node.transition().duration(400).delay((_d, i) => i * 60)
      .style("opacity", 1)
      .attr("transform", (d: any) => `translate(${d.x},${d.y}) scale(1)`);

    // Click handler
    node.on("click", (_event, d: any) => {
      if (onNodeClickRef.current) {
        onNodeClickRef.current(d as NetworkNode);
      } else if (d.type === "company" && d.siren) {
        window.open(`https://www.pappers.fr/entreprise/${d.siren}`, "_blank", "noopener,noreferrer");
      }
    });

    // #13: Double-click handler
    node.on("dblclick", (_event, d: any) => {
      _event.stopPropagation();
      if (onNodeDoubleClickRef.current) {
        onNodeDoubleClickRef.current(d as NetworkNode);
      }
    });

    // #7: Tooltip on hover
    node.on("mouseenter", function (event, d: any) {
      d3.select(this).select(".node-shape").attr("stroke-width", 3.5);
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) {
        setTooltip({
          x: event.clientX - svgRect.left,
          y: event.clientY - svgRect.top - 10,
          node: d as NetworkNode,
        });
      }
    }).on("mouseleave", function () {
      d3.select(this).select(".node-shape").attr("stroke-width", (d: any) => d.isSource ? 3 : 1.5);
      setTooltip(null);
    });

    // Node sizes — larger for readability
    const nodeSize = (d: any) => {
      const count = connectionCount.get(d.id) ?? 1;
      if (d.isSource) return 32;
      if (d.type === "person") return Math.min(18 + count * 3, 28);
      return Math.min(16 + count * 3, 26);
    };

    // #2: Colors
    const isClosed = (d: any) => d.etatAdministratif === "F" || d.etatAdministratif === "C";

    node.each(function (d: any) {
      const el = d3.select(this);
      const size = nodeSize(d);

      if (d.isSource) {
        // Hexagon for client — larger with thicker border
        const hex = (s: number) => {
          const pts = [];
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            pts.push(`${Math.cos(angle) * s},${Math.sin(angle) * s}`);
          }
          return pts.join(" ");
        };
        el.append("polygon")
          .attr("points", hex(size))
          .attr("fill", "rgba(59, 130, 246, 0.15)")
          .attr("stroke", "#3b82f6")
          .attr("stroke-width", 3)
          .attr("class", "node-shape");
      } else if (d.type === "person") {
        // Circle for persons
        el.append("circle")
          .attr("r", size)
          .attr("fill", "rgba(249, 115, 22, 0.08)")
          .attr("stroke", "#f97316")
          .attr("stroke-width", 1.5)
          .attr("class", "node-shape");
      } else {
        // Rounded rectangle for companies — wider
        const w = Math.max(size * 2.5, 130);
        const h = Math.max(size * 1.6, 55);
        el.append("rect")
          .attr("x", -w / 2).attr("y", -h / 2)
          .attr("width", w).attr("height", h)
          .attr("rx", 6).attr("ry", 6)
          .attr("fill", isClosed(d) ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)")
          .attr("stroke", isClosed(d) ? "#ef4444" : "#10b981")
          .attr("stroke-width", 1.5)
          .attr("class", "node-shape");
      }
    });

    // Node labels — larger font
    node.append("text")
      .text(d => d.label || "—")
      .attr("font-size", d => d.isSource ? "12px" : "12px")
      .attr("font-weight", "600")
      .attr("fill", "#e2e8f0")
      .attr("text-anchor", "middle")
      .attr("dy", (d: any) => nodeSize(d) + 16);

    // SIREN + ville label for companies
    node.filter(d => d.type === "company" && !!d.siren && !d.isSource)
      .append("text")
      .text(d => {
        const ville = (d as any).ville;
        return ville ? `${d.siren} — ${ville}` : (d.siren ?? "");
      })
      .attr("font-size", "8px")
      .attr("fill", "#64748b")
      .attr("text-anchor", "middle")
      .attr("dy", (d: any) => nodeSize(d) + 28);

    // #12: Auto-fit zoom with generous padding
    {
      const nodePositions = simNodes.map(n => ({ x: (n as any).x ?? 0, y: (n as any).y ?? 0 }));
      if (nodePositions.length >= 2) {
        const xs = nodePositions.map(p => p.x);
        const ys = nodePositions.map(p => p.y);
        const x0 = Math.min(...xs) - 80;
        const y0 = Math.min(...ys) - 80;
        const x1 = Math.max(...xs) + 80;
        const y1 = Math.max(...ys) + 80;
        const bw = x1 - x0;
        const bh = y1 - y0;
        if (bw > 0 && bh > 0) {
          const scale = Math.min(width / bw, height / bh, 1.2) * 0.85;
          const tx = (width - bw * scale) / 2 - x0 * scale;
          const ty = (height - bh * scale) / 2 - y0 * scale;
          svg.transition().duration(600)
            .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        }
      }
    }

    return () => {
      node.on("click", null);
      node.on("dblclick", null);
      node.on("mouseenter", null);
      node.on("mouseleave", null);
      link.on("mouseenter", null);
      link.on("mouseleave", null);
      svg.on(".zoom", null);
      svg.selectAll("*").remove();
    };
  }, [nodes, edges, width, height]);

  // Empty state
  if (nodes.length === 0 || (nodes.length === 1 && (!edges || edges.length === 0))) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-4">
        <div className="w-20 h-20 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center">
          <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth="1.2">
            <circle cx="24" cy="12" r="4" />
            <circle cx="12" cy="32" r="4" />
            <circle cx="36" cy="32" r="4" />
            <line x1="24" y1="16" x2="12" y2="28" />
            <line x1="24" y1="16" x2="36" y2="28" />
            <line x1="12" y1="32" x2="36" y2="32" strokeDasharray="3 3" />
          </svg>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">Aucun reseau de direction detecte</p>
          <p className="text-slate-300 dark:text-slate-600 text-xs max-w-[260px]">Les relations entre dirigeants et societes apparaitront ici apres le screening.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10 print:hidden">
        <button onClick={handleZoomIn} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] hover:bg-white/[0.12] border border-gray-300 dark:border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all duration-200" aria-label="Zoomer"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={handleZoomOut} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] hover:bg-white/[0.12] border border-gray-300 dark:border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all duration-200" aria-label="Dezoomer"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={handleReset} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] hover:bg-white/[0.12] border border-gray-300 dark:border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all duration-200" aria-label="Reinitialiser"><RotateCcw className="w-3.5 h-3.5" /></button>
      </div>

      <svg
        ref={svgRef}
        role="img"
        aria-label="Graphe du reseau de relations entre entites"
        width={width}
        height={height}
        className="w-full rounded-lg"
        viewBox={`0 0 ${width} ${height}`}
      />

      {/* #7/#8: Tooltip card */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          <div className="bg-slate-900 border border-white/10 rounded-lg shadow-xl px-3 py-2 text-xs max-w-[220px]">
            {tooltip.node && (
              <>
                <p className="font-semibold text-white truncate">{tooltip.node.label}</p>
                {tooltip.node.siren && <p className="text-slate-400 font-mono text-[10px]">SIREN {tooltip.node.siren}</p>}
                {(tooltip.node as any).formeJuridique && <p className="text-slate-400 text-[10px]">{(tooltip.node as any).formeJuridique}</p>}
                {(tooltip.node as any).ville && <p className="text-slate-400 text-[10px]">{(tooltip.node as any).ville}</p>}
                <p className="text-slate-500 text-[10px] mt-1">
                  {tooltip.node.isSource ? "Client analyse" : tooltip.node.type === "person" ? "Personne physique" : "Societe"}
                </p>
              </>
            )}
            {tooltip.edge && (
              <>
                <p className="font-medium text-white">{tooltip.edge.label || "Lien"}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legend — compact single line, conditionally show "Fermee" */}
      <div className="flex items-center gap-5 mt-2.5 px-2 text-[10px] text-slate-400 print:hidden">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 flex items-center justify-center"><Target className="w-3.5 h-3.5 text-blue-500" /></div>
          <span>Client</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-2.5 rounded border border-emerald-500 bg-emerald-500/10" />
          <span>Societe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border border-orange-500 bg-orange-500/10" />
          <span>Personne</span>
        </div>
        {hasClosedNode && (
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-2.5 rounded border border-red-500 bg-red-500/10" />
            <span>Fermee</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-blue-500 rounded" />
          <span>Dirigeant</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t border-dashed border-slate-500" />
          <span>Indirect</span>
        </div>
      </div>
    </div>
  );
}
