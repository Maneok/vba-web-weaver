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

export default function NetworkGraph({ nodes, edges, width = 700, height = 450, onNodeClick, onNodeDoubleClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const onNodeClickRef = useRef(onNodeClick);
  const onNodeDoubleClickRef = useRef(onNodeDoubleClick);
  onNodeClickRef.current = onNodeClick;
  onNodeDoubleClickRef.current = onNodeDoubleClick;
  const [, setForceUpdate] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node?: NetworkNode; edge?: NetworkEdge } | null>(null);
  const prevDataSignatureRef = useRef<string>("");

  // #50: Responsive scale factor
  const mobile = width < 500;
  const S = mobile ? 0.7 : 1;

  const hasClosedNode = useMemo(() => nodes.some(n => (n as any).etatAdministratif === "F" || (n as any).etatAdministratif === "C"), [nodes]);

  // #41: Node type counts for legend
  const typeCounts = useMemo(() => {
    let person = 0, company = 0, closed = 0;
    nodes.forEach(n => {
      if (n.isSource) return;
      if (n.type === "person") person++;
      else {
        company++;
        if ((n as any).etatAdministratif === "F" || (n as any).etatAdministratif === "C") closed++;
      }
    });
    return { person, company, closed };
  }, [nodes]);

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

    // --- #8-9-16-20: Drop shadow filters ---
    const mkShadow = (id: string, color: string) => {
      const f = defs.append("filter").attr("id", id).attr("x", "-30%").attr("y", "-30%").attr("width", "160%").attr("height", "160%");
      f.append("feDropShadow").attr("dx", 0).attr("dy", 2 * S).attr("stdDeviation", 3 * S).attr("flood-color", color).attr("flood-opacity", 0.35);
    };
    mkShadow("shadow-blue", "rgba(59,130,246,0.4)");
    mkShadow("shadow-orange", "rgba(249,115,22,0.3)");
    mkShadow("shadow-green", "rgba(16,185,129,0.3)");
    mkShadow("shadow-red", "rgba(239,68,68,0.3)");

    // --- #8: Radial gradient for client hexagon ---
    const clientGrad = defs.append("radialGradient").attr("id", "client-grad").attr("cx", "50%").attr("cy", "40%").attr("r", "60%");
    clientGrad.append("stop").attr("offset", "0%").attr("stop-color", "rgba(96,165,250,0.25)");
    clientGrad.append("stop").attr("offset", "100%").attr("stop-color", "rgba(29,78,216,0.08)");

    // --- #11: Pulse animation for client border ---
    const style = svg.append("style");
    style.text(`
      @keyframes pulse-stroke { 0%,100% { stroke-opacity: 1; } 50% { stroke-opacity: 0.5; } }
      .client-hex { animation: pulse-stroke 3s ease-in-out infinite; }
    `);

    // --- #37: Subtle grid lines background ---
    const gridPat = defs.append("pattern").attr("id", "grid-lines").attr("width", 40).attr("height", 40).attr("patternUnits", "userSpaceOnUse");
    gridPat.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 40).attr("y2", 0).attr("stroke", "rgba(148,163,184,0.03)").attr("stroke-width", 0.5);
    gridPat.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 40).attr("stroke", "rgba(148,163,184,0.03)").attr("stroke-width", 0.5);
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", "url(#grid-lines)");

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;
    setForceUpdate(v => v + 1);

    // Connection count
    const connectionCount = new Map<string, number>();
    safeEdges.forEach(e => {
      connectionCount.set(e.source, (connectionCount.get(e.source) ?? 0) + 1);
      connectionCount.set(e.target, (connectionCount.get(e.target) ?? 0) + 1);
    });

    // --- #1-5: Simulation with hierarchical forces ---
    const simNodes = nodes.map(n => ({
      ...n,
      x: n.isSource ? width / 2 : width / 2 + (Math.random() - 0.5) * 280,
      y: n.isSource ? height * 0.30 : n.type === "person" ? height * 0.15 + Math.random() * height * 0.2 : height * 0.55 + Math.random() * height * 0.3,
      fx: n.isSource ? width / 2 : undefined,
      fy: n.isSource ? height * 0.30 : undefined,
    }));
    const simEdges = safeEdges.map(e => ({ ...e, source: e.source, target: e.target }));

    const simulation = d3.forceSimulation(simNodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(simEdges as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d: any) => d.id)
        .distance(220 * S))
      .force("charge", d3.forceManyBody().strength(-900))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(85 * S))
      // #5: Vertical separation force
      .force("y", d3.forceY().y((d: any) => d.type === "person" ? height * 0.15 : d.isSource ? height * 0.35 : height * 0.70).strength(0.2));

    simulation.stop();
    for (let i = 0; i < 300; i++) simulation.tick();
    simNodes.forEach(n => { n.fx = (n as any).x; n.fy = (n as any).y; });

    // --- Role helpers ---
    // #30: More saturated colors
    const roleColor = (label: string): string => {
      const l = (label ?? "").toLowerCase();
      if (l.includes("président") || l.includes("president") || l.includes("gérant") || l.includes("gerant")) return "#60a5fa";
      if (l.includes("associé") || l.includes("associe")) return "#34d399";
      if (l.includes("directeur")) return "#a78bfa";
      return "#94a3b8";
    };

    // #29: Edge widths
    const edgeWidth = (label: string): number => {
      const l = (label ?? "").toLowerCase();
      if (l.includes("président") || l.includes("president") || l.includes("gérant") || l.includes("gerant")) return 2 * S;
      if (l.includes("associé") || l.includes("associe")) return 1.5 * S;
      if (l.includes("représentant") || l.includes("representant")) return 1 * S;
      return 1 * S;
    };

    const edgeDash = (label: string): string => {
      const l = (label ?? "").toLowerCase();
      if (l.includes("représentant") || l.includes("representant")) return "5 3";
      return "";
    };

    // #31: Elegant thin arrow marker
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 0 12 8")
      .attr("refX", 11).attr("refY", 4)
      .attr("markerWidth", 10 * S).attr("markerHeight", 8 * S)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,1 L10,4 L0,7")
      .attr("fill", "none")
      .attr("stroke", "#64748b")
      .attr("stroke-width", 1.2);

    // --- #28: Curved edges (quadratic bezier) ---
    const linkPath = (d: any): string => {
      const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
      const dx = tx - sx, dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const offset = Math.min(dist * 0.12, 25);
      const mx = (sx + tx) / 2 - (dy / dist) * offset;
      const my = (sy + ty) / 2 + (dx / dist) * offset;
      return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
    };

    // #48: Links layer — initially hidden, fade in after nodes
    const linkGroup = g.append("g").style("opacity", 0);

    const link = linkGroup
      .selectAll("path")
      .data(simEdges)
      .join("path")
      .attr("d", linkPath)
      .attr("fill", "none")
      .attr("stroke", d => roleColor(d.label))
      .attr("stroke-width", d => edgeWidth(d.label))
      .attr("stroke-dasharray", d => edgeDash(d.label))
      .attr("stroke-opacity", 0.5)
      .attr("marker-end", "url(#arrow)")
      .style("cursor", "pointer");

    // Edge hover
    link.on("mouseenter", function (event, d: any) {
      d3.select(this).attr("stroke-opacity", 1).attr("stroke-width", edgeWidth(d.label) + 1.5);
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) setTooltip({ x: event.clientX - svgRect.left, y: event.clientY - svgRect.top - 10, edge: d });
    }).on("mouseleave", function (_event, d: any) {
      d3.select(this).attr("stroke-opacity", 0.5).attr("stroke-width", edgeWidth(d.label));
      setTooltip(null);
    });

    // --- #32-34: Edge labels at 40% from source, with pill background ---
    const linkLabelGroup = linkGroup
      .selectAll("g.link-label")
      .data(simEdges)
      .join("g")
      .attr("class", "link-label")
      .attr("transform", (d: any) => {
        // #34: Position at 40% of path (closer to source)
        const t = 0.4;
        const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const offset = Math.min(dist * 0.12, 25);
        const cx = (sx + tx) / 2 - (dy / dist) * offset;
        const cy = (sy + ty) / 2 + (dx / dist) * offset;
        // Quadratic bezier at t
        const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * tx;
        const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ty;
        return `translate(${px},${py})`;
      });

    // #8: Deduplicate link labels — if all labels are the same, show only on first link
    const allLinkLabels = simEdges.map(e => ((e.label ?? "") as string).split(" (")[0]).filter(Boolean);
    const allSameLabel = allLinkLabels.length > 1 && allLinkLabels.every(l => l === allLinkLabels[0]);
    const shownLinkLabels = new Set<number>();

    linkLabelGroup.each(function (d: any, idx: number) {
      const el = d3.select(this);
      const labelText = ((d.label ?? "") as string).split(" (")[0];
      if (!labelText) return;
      // If all links have the same label, only show on first
      if (allSameLabel) {
        if (shownLinkLabels.size > 0) return;
        shownLinkLabels.add(idx);
      }
      // #32: Pill-shaped background
      const textW = labelText.length * 4.8 * S + 12;
      const textH = 16 * S;
      el.append("rect")
        .attr("x", -textW / 2).attr("y", -textH / 2)
        .attr("width", textW).attr("height", textH)
        .attr("rx", 8).attr("ry", 8)
        .attr("fill", "rgba(15, 23, 42, 0.7)")
        .attr("stroke", "rgba(148, 163, 184, 0.08)")
        .attr("stroke-width", 0.5);
      // #33: 9px font
      el.append("text")
        .text(labelText)
        .attr("font-size", `${9 * S}px`)
        .attr("font-weight", "500")
        .attr("fill", roleColor(d.label))
        .attr("fill-opacity", 0.95)
        .attr("text-anchor", "middle")
        .attr("dy", 3 * S)
        .attr("letter-spacing", "0.2px");
    });

    // #48: Fade in links after a delay
    linkGroup.transition().duration(400).delay(300).style("opacity", 1);

    // --- Nodes ---
    const node = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .style("cursor", "pointer")
      .style("opacity", 0)
      .attr("transform", (d: any) => `translate(${d.x},${d.y}) scale(0.5)`);

    // #46-47: Slower fade-in with ease-out
    node.transition().duration(500).delay((_d, i) => i * 80).ease(d3.easeQuadOut)
      .style("opacity", 1)
      .attr("transform", (d: any) => `translate(${d.x},${d.y}) scale(1)`);

    // Click
    node.on("click", (_event, d: any) => {
      if (onNodeClickRef.current) onNodeClickRef.current(d as NetworkNode);
      else if (d.type === "company" && d.siren) window.open(`https://www.pappers.fr/entreprise/${d.siren}`, "_blank", "noopener,noreferrer");
    });
    node.on("dblclick", (_event, d: any) => {
      _event.stopPropagation();
      if (onNodeDoubleClickRef.current) onNodeDoubleClickRef.current(d as NetworkNode);
    });

    // Hover
    node.on("mouseenter", function (event, d: any) {
      d3.select(this).select(".node-shape").attr("stroke-width", 4 * S);
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) setTooltip({ x: event.clientX - svgRect.left, y: event.clientY - svgRect.top - 10, node: d as NetworkNode });
    }).on("mouseleave", function () {
      d3.select(this).select(".node-shape").attr("stroke-width", (d: any) => d.isSource ? 3 * S : 1.5 * S);
      setTooltip(null);
    });

    const isClosed = (d: any) => d.etatAdministratif === "F" || d.etatAdministratif === "C";

    // --- #6-21: Node shapes ---
    node.each(function (d: any) {
      const el = d3.select(this);

      if (d.isSource) {
        // #6-11: Client hexagon
        const sz = 35 * S;
        const hex = (s: number) => {
          const pts = [];
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            pts.push(`${Math.cos(angle) * s},${Math.sin(angle) * s}`);
          }
          return pts.join(" ");
        };
        el.append("polygon")
          .attr("points", hex(sz))
          .attr("fill", "url(#client-grad)")
          .attr("stroke", "#3b82f6")
          .attr("stroke-width", 3 * S)
          .attr("class", "node-shape client-hex")
          .attr("filter", "url(#shadow-blue)");
        // #10: Building icon in center
        el.append("path")
          .attr("d", "M-7,-5 L0,-9 L7,-5 L7,7 L-7,7 Z M-3,1 L-3,7 L3,7 L3,1 Z M-1,3 L1,3 L1,5 L-1,5 Z")
          .attr("fill", "none")
          .attr("stroke", "#93c5fd")
          .attr("stroke-width", 1)
          .attr("transform", `scale(${S})`);
      } else if (d.type === "person") {
        // #12-16: Person circle
        const r = 26 * S;
        el.append("circle")
          .attr("r", r)
          .attr("fill", "rgba(249, 115, 22, 0.06)")
          .attr("stroke", "#f97316")
          .attr("stroke-width", 1.5 * S)
          .attr("class", "node-shape")
          .attr("filter", "url(#shadow-orange)");
        // #15: Simple person icon
        el.append("circle").attr("cy", -4 * S).attr("r", 4 * S).attr("fill", "none").attr("stroke", "#fdba74").attr("stroke-width", 1);
        el.append("path")
          .attr("d", `M${-7 * S},${8 * S} A${7 * S},${7 * S} 0 0,1 ${7 * S},${8 * S}`)
          .attr("fill", "none").attr("stroke", "#fdba74").attr("stroke-width", 1);
      } else {
        // #17-21: Company rectangle
        const w = 140 * S, h = 52 * S;
        const closed = isClosed(d);
        el.append("rect")
          .attr("x", -w / 2).attr("y", -h / 2)
          .attr("width", w).attr("height", h)
          .attr("rx", 10 * S).attr("ry", 10 * S)
          .attr("fill", closed ? "rgba(239, 68, 68, 0.05)" : "rgba(16, 185, 129, 0.05)")
          .attr("stroke", closed ? "#ef4444" : "#10b981")
          .attr("stroke-width", 1.5 * S)
          .attr("stroke-dasharray", closed ? "6 3" : "")
          .attr("class", "node-shape")
          .attr("filter", closed ? "url(#shadow-red)" : "url(#shadow-green)");
        // #21: Red X overlay for closed companies
        if (closed) {
          const cs = 8 * S;
          el.append("line").attr("x1", -cs).attr("y1", -cs).attr("x2", cs).attr("y2", cs)
            .attr("stroke", "#ef4444").attr("stroke-width", 1.5).attr("stroke-opacity", 0.4);
          el.append("line").attr("x1", cs).attr("y1", -cs).attr("x2", -cs).attr("y2", cs)
            .attr("stroke", "#ef4444").attr("stroke-width", 1.5).attr("stroke-opacity", 0.4);
        }
      }
    });

    // --- #22-27: Labels with background ---
    // Helper: add text with semi-transparent background
    const addLabel = (sel: d3.Selection<any, any, any, any>, getText: (d: any) => string, opts: {
      dy: (d: any) => number; fontSize: number; fontWeight: string; fill: string; italic?: boolean; letterSpacing?: string;
    }) => {
      sel.each(function (d: any) {
        const el = d3.select(this);
        const text = getText(d);
        if (!text) return;
        const fs = opts.fontSize * S;
        const tw = text.length * fs * 0.58 + 8;
        const th = fs + 6;
        const dyVal = opts.dy(d);
        // #27: Background rect
        el.append("rect")
          .attr("x", -tw / 2).attr("y", dyVal - th / 2 - 1)
          .attr("width", tw).attr("height", th)
          .attr("rx", 3).attr("fill", "rgba(15,23,42,0.6)");
        el.append("text")
          .text(text)
          .attr("font-size", `${fs}px`)
          .attr("font-weight", opts.fontWeight)
          .attr("font-style", opts.italic ? "italic" : "normal")
          .attr("fill", opts.fill)
          .attr("text-anchor", "middle")
          .attr("dy", dyVal + 1)
          .attr("letter-spacing", opts.letterSpacing ?? "0.2px");
      });
    };

    // #22: Node name — bold 12px
    addLabel(node, d => d.label || "—", {
      dy: (d: any) => d.isSource ? 35 * S + 18 * S : d.type === "person" ? 26 * S + 18 * S : 52 * S / 2 + 16 * S,
      fontSize: 12, fontWeight: "700", fill: "#e2e8f0",
    });

    // #23: Sub-label for companies: "SIREN — VILLE"
    addLabel(node.filter(d => d.type === "company" && !!d.siren && !d.isSource), d => {
      const ville = (d as any).ville;
      return ville ? `${d.siren} — ${ville}` : (d.siren ?? "");
    }, {
      dy: (d: any) => 52 * S / 2 + 30 * S,
      fontSize: 8, fontWeight: "400", fill: "#64748b",
    });

    // #24: Sub-label for persons: role in italic
    addLabel(node.filter(d => d.type === "person" && !d.isSource), d => {
      // Find the role from edges connected to this person
      const edge = simEdges.find((e: any) => (e.source?.id ?? e.source) === d.id || (e.target?.id ?? e.target) === d.id);
      return edge ? ((edge as any).label ?? "").split(" (")[0] : "";
    }, {
      dy: () => 26 * S + 32 * S,
      fontSize: 9, fontWeight: "400", fill: "#94a3b8", italic: true,
    });

    // #25: Client sub-label "(Client analyse)"
    addLabel(node.filter(d => d.isSource), () => "(Client analyse)", {
      dy: () => 35 * S + 32 * S,
      fontSize: 8, fontWeight: "400", fill: "#60a5fa",
    });

    // --- #49: Auto-fit zoom with ease-in-out ---
    {
      const nodePositions = simNodes.map(n => ({ x: (n as any).x ?? 0, y: (n as any).y ?? 0 }));
      if (nodePositions.length >= 2) {
        const xs = nodePositions.map(p => p.x);
        const ys = nodePositions.map(p => p.y);
        const pad = 100 * S;
        const x0 = Math.min(...xs) - pad;
        const y0 = Math.min(...ys) - pad;
        const x1 = Math.max(...xs) + pad;
        const y1 = Math.max(...ys) + pad;
        const bw = x1 - x0, bh = y1 - y0;
        if (bw > 0 && bh > 0) {
          const scale = Math.min(width / bw, height / bh, 1.0) * 0.85;
          const tx = (width - bw * scale) / 2 - x0 * scale;
          const ty = (height - bh * scale) / 2 - y0 * scale;
          svg.transition().duration(800).ease(d3.easeCubicInOut)
            .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        }
      }
    }

    return () => {
      node.on("click", null).on("dblclick", null).on("mouseenter", null).on("mouseleave", null);
      link.on("mouseenter", null).on("mouseleave", null);
      svg.on(".zoom", null);
      svg.selectAll("*").remove();
    };
  }, [nodes, edges, width, height, S]);

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

      {/* #42-45: Rich tooltip with fade-in */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none animate-[fadeIn_150ms_ease-out]"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          <div className="bg-slate-900/95 border border-white/[0.08] rounded-xl shadow-2xl px-4 py-2.5 text-xs max-w-[280px] backdrop-blur-sm">
            {tooltip.node && (
              <>
                <p className="font-bold text-white truncate text-[13px]">{tooltip.node.label}</p>
                {tooltip.node.siren && <p className="text-slate-400 font-mono text-[10px] mt-0.5">SIREN {tooltip.node.siren}</p>}
                {(tooltip.node as any).formeJuridique && <p className="text-slate-400 text-[10px]">{(tooltip.node as any).formeJuridique}</p>}
                {(tooltip.node as any).ville && <p className="text-slate-400 text-[10px]">{(tooltip.node as any).ville}</p>}
                {/* #42: Show etatAdministratif */}
                {(tooltip.node as any).etatAdministratif && (
                  <p className={`text-[10px] mt-0.5 ${(tooltip.node as any).etatAdministratif === "A" ? "text-emerald-400" : "text-red-400"}`}>
                    {(tooltip.node as any).etatAdministratif === "A" ? "Active" : "Fermee"}
                  </p>
                )}
                <p className="text-slate-500 text-[10px] mt-1 pt-1 border-t border-white/[0.06]">
                  {tooltip.node.isSource ? "Client analyse" : tooltip.node.type === "person" ? "Personne physique" : "Societe"}
                </p>
              </>
            )}
            {tooltip.edge && (
              <p className="font-medium text-white">{tooltip.edge.label || "Lien"}</p>
            )}
          </div>
        </div>
      )}

      {/* #38-41: Legend bottom-left with pill backgrounds and counts */}
      <div className="flex items-center gap-2 mt-2.5 px-2 text-[10px] text-slate-400 print:hidden flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-800/40 rounded-full px-2.5 py-1">
          <Target className="w-3 h-3 text-blue-500" />
          <span>Client</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800/40 rounded-full px-2.5 py-1">
          <div className="w-3 h-2 rounded border border-emerald-500 bg-emerald-500/10" />
          <span>Societe ({typeCounts.company})</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800/40 rounded-full px-2.5 py-1">
          <div className="w-2.5 h-2.5 rounded-full border border-orange-500 bg-orange-500/10" />
          <span>Personne ({typeCounts.person})</span>
        </div>
        {hasClosedNode && (
          <div className="flex items-center gap-1.5 bg-slate-800/40 rounded-full px-2.5 py-1">
            <div className="w-3 h-2 rounded border border-dashed border-red-500 bg-red-500/10" />
            <span>Fermee ({typeCounts.closed})</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 bg-slate-800/40 rounded-full px-2.5 py-1">
          <div className="w-3.5 h-0.5 bg-blue-400 rounded" />
          <span>Dirigeant</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800/40 rounded-full px-2.5 py-1">
          <div className="w-3.5 h-0 border-t border-dashed border-slate-400" />
          <span>Indirect</span>
        </div>
      </div>
    </div>
  );
}
