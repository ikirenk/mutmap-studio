import React, { useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  GeneStructure,
  LabelCoord,
  MutationRecord,
  StyleConfig,
} from '../types/schema';
import { ChartLegend } from './ChartLegend';
import {
  computeLeaderPolyline,
  computeMode1Layout,
  estimateLabelWidth,
} from './collision';
import { HoveredMutationInfo } from './ProteinDomainChart';
import {
  computeClusterOffsets,
  computeClusterStemPolyline,
  resolveClusterHorizontalPositions,
} from './stackCluster';
import { MutationSymbol } from './symbols';

export interface CdnaExonChartProps {
  svgRef: React.RefObject<SVGSVGElement>;
  gene: GeneStructure;
  mutations: MutationRecord[];
  style: StyleConfig;
  manualPositions: Record<string, LabelCoord>;
  manualClusterPositions: Record<string, LabelCoord>;
  onCommitLabelPosition: (id: string, coord: LabelCoord) => void;
  onResetLabelPosition: (id: string) => void;
  onCommitClusterPosition: (id: string, coord: LabelCoord) => void;
  onResetClusterPosition: (id: string) => void;
  onHoverMutation?: (info: HoveredMutationInfo | null) => void;
}

function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: pt.x, y: pt.y };
}

function getContrastTextColor(hexColor: string): string {
  const c = d3.color(hexColor);
  if (!c) return '#0f172a';
  const rgb = c.rgb();
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.52 ? '#ffffff' : '#0f172a';
}

function formatMode2Label(
  m: MutationRecord,
  count: number,
  style: StyleConfig,
): string {
  const parts: string[] = [];
  if (style.mode2ShowCdnaChange && m.cDNA_change) {
    parts.push(m.cDNA_change);
  }
  if (style.mode2ShowProteinChange && m.protein_change) {
    parts.push(m.protein_change);
  }
  if (parts.length === 0) {
    parts.push(m.cDNA_change || m.protein_change || `#${m.position_bp ?? '?'}`);
  }
  if (style.mode2ShowCount) {
    parts.push(`(${count})`);
  }
  if (style.mode2ShowPhenotype && m.phenotype_or_type) {
    parts.push(`[${m.phenotype_or_type}]`);
  }
  return parts.join(' ');
}

export const CdnaExonChart: React.FC<CdnaExonChartProps> = ({
  svgRef,
  gene,
  mutations,
  style,
  manualPositions,
  manualClusterPositions,
  onCommitLabelPosition,
  onResetLabelPosition,
  onCommitClusterPosition,
  onResetClusterPosition,
  onHoverMutation,
}) => {
  const [dragging, setDragging] = useState<{
    id: string;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [draggingCluster, setDraggingCluster] = useState<{
    id: string;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragMovedRef = useRef(false);
  const dragClusterMovedRef = useRef(false);

  const width = style.width;
  const height = style.height;
  const marginLeft = 64;
  const marginRight = 64;
  const titleOffset = style.showTitle ? 62 : 22;

  const hasLegendBottom =
    style.legendPosition === 'bottom-center' ||
    style.legendPosition === 'bottom-left' ||
    style.legendPosition === 'bottom-right';
  const bottomReserve = hasLegendBottom ? 72 : 34;
  const domainTrackHeight = style.mode2ShowDomainsBelow ? 42 : 0;

  const exonBarHeight = style.mode2BarHeight;
  const exonBarBottomY = height - bottomReserve - domainTrackHeight - 28;
  const exonBarTopY = exonBarBottomY - exonBarHeight;

  const labelFontFamily =
    style.mode2LabelFontFamily === 'inherit'
      ? style.fontFamily
      : style.mode2LabelFontFamily;
  const labelFontSize = style.mode2LabelFontSize;
  const labelFontWeight = style.mode2LabelFontWeight;
  const labelColor = style.mode2LabelColor;
  const labelAngle = style.mode2LabelAngle;

  const xScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([1, Math.max(1, gene.cdnaLengthBp)])
        .range([marginLeft, width - marginRight])
        .clamp(true),
    [gene.cdnaLengthBp, width],
  );

  const plottableMutations = useMemo(() => {
    const valid = mutations.filter((m) => {
      const bp = m.position_bp ?? (m.position_aa ? m.position_aa * 3 : null);
      return bp !== null && bp > 0;
    });
    return [...valid].sort((a, b) => {
      const abp = a.position_bp ?? (a.position_aa ?? 1) * 3;
      const bbp = b.position_bp ?? (b.position_aa ?? 1) * 3;
      return abp - bbp;
    });
  }, [mutations]);

  // Compute stacked symbol clusters, auto-scale if needed, and resolve non-overlapping auto clusterX centers
  const autoClusters = useMemo(() => {
    if (plottableMutations.length === 0) return [];

    const availableTrackWidth = Math.max(120, width - marginRight - marginLeft + 20);
    const minClusterGap = 10;

    const buildLayouts = (scaleFactor: number) =>
      plottableMutations.map((m) => {
        const bp = m.position_bp ?? (m.position_aa ?? 1) * 3;
        const anchorX = Math.max(
          marginLeft,
          Math.min(width - marginRight, xScale(bp)),
        );
        const count =
          style.countMetric === 'family_count'
            ? m.patient_or_allele_count.family_count
            : m.patient_or_allele_count.allele_count;

        const symStyle = style.mutationStyles[m.mutation_type];
        const baseSymSize = Math.min(5.5, symStyle.size * 0.85);
        const symSize = Math.max(2.6, baseSymSize * scaleFactor);
        const layout = computeClusterOffsets(Math.max(1, count), {
          symbolSize: symSize,
          gap: style.mode2SymbolGap * Math.max(0.75, scaleFactor),
          threshold: style.mode2ClusterThreshold,
          maxWidth: style.mode2MaxClusterWidth,
        });

        return { m, count, anchorX, symStyle, symSize, layout };
      });

    let prelim = buildLayouts(1);
    const totalFootprint =
      prelim.reduce((sum, p) => sum + p.layout.maxHalfWidth * 2, 0) +
      Math.max(0, prelim.length - 1) * minClusterGap;

    if (totalFootprint > availableTrackWidth) {
      const ratio = Math.max(0.5, (availableTrackWidth * 0.96) / totalFootprint);
      prelim = buildLayouts(ratio);
    }

    const clusterXMap = resolveClusterHorizontalPositions(
      prelim.map((p) => ({
        id: p.m.id,
        anchorX: p.anchorX,
        halfWidth: p.layout.maxHalfWidth,
      })),
      {
        minX: marginLeft - 10,
        maxX: width - marginRight + 10,
        gap: minClusterGap,
      },
    );

    const maxShift = prelim.reduce((mx, p) => {
      const cx = clusterXMap.get(p.m.id) ?? p.anchorX;
      return Math.max(mx, Math.abs(cx - p.anchorX));
    }, 0);

    const adaptiveBaseOffset =
      maxShift < 2 ? 20 : Math.min(56, Math.round(26 + maxShift * 0.45));
    const autoBaseY = exonBarTopY - adaptiveBaseOffset;

    return prelim.map((p) => {
      const autoClusterX = clusterXMap.get(p.m.id) ?? p.anchorX;
      const labelText = formatMode2Label(p.m, p.count, style);

      return {
        mutation: p.m,
        count: p.count,
        anchorX: p.anchorX,
        autoClusterX,
        autoBaseY,
        symStyle: p.symStyle,
        symSize: p.symSize,
        layout: p.layout,
        labelText,
      };
    });
  }, [plottableMutations, xScale, style, exonBarTopY, width]);

  // Apply manual / live-dragging overrides for each symbol cluster
  const clusters = useMemo(
    () =>
      autoClusters.map((c) => {
        const id = c.mutation.id;
        const manualC = manualClusterPositions[id];
        const isClusterDrag = draggingCluster?.id === id;
        const clusterX = isClusterDrag
          ? draggingCluster.x
          : (manualC?.x ?? c.autoClusterX);
        const baseY = isClusterDrag
          ? draggingCluster.y
          : (manualC?.y ?? c.autoBaseY);
        const clusterBottomY = baseY + c.symSize * 1.25 + 1.5;
        const topY = baseY - (c.layout.totalHeight - c.symSize);

        return {
          ...c,
          clusterX,
          baseY,
          clusterBottomY,
          topY,
          isClusterManual: Boolean(manualC),
          isClusterDrag,
        };
      }),
    [autoClusters, manualClusterPositions, draggingCluster],
  );

  // Auto-position cluster labels cleanly when leader-lines mode is active
  const labelLayoutMap = useMemo(() => {
    if (
      !style.mode2ShowLabels ||
      style.mode2LabelPlacement !== 'leader-lines' ||
      clusters.length === 0
    ) {
      return new Map();
    }
    const maxClusterTop = Math.min(...clusters.map((c) => c.topY));
    const effectiveBarTopY = Math.max(titleOffset + 44, maxClusterTop + 12);

    return computeMode1Layout(
      clusters.map((c) => ({
        id: c.mutation.id,
        anchorX: c.clusterX,
        side: 'top' as const,
        text: c.labelText,
      })),
      {
        minX: marginLeft - 14,
        maxX: width - marginRight + 14,
        barTopY: effectiveBarTopY,
        barBottomY: exonBarBottomY,
        fontSize: labelFontSize,
        symbolSize: 4,
        layoutMode:
          labelAngle === -90
            ? 'vertical-90'
            : labelAngle === -45
              ? 'angled-45'
              : 'horizontal-tiered',
        topBoundaryY: titleOffset + 10,
        bottomBoundaryY: height - bottomReserve,
      },
    );
  }, [
    clusters,
    style.mode2ShowLabels,
    style.mode2LabelPlacement,
    labelFontSize,
    labelAngle,
    titleOffset,
    exonBarBottomY,
    width,
    height,
    bottomReserve,
  ]);

  const bpTicks = useMemo(() => {
    const len = Math.max(1, gene.cdnaLengthBp);
    const raw = xScale.ticks(8).filter((t) => t > 1 && t < len);
    return Array.from(new Set([1, ...raw, len])).sort((a, b) => a - b);
  }, [gene.cdnaLengthBp, xScale]);

  const handleLabelPointerDown = (
    e: React.PointerEvent<SVGGElement>,
    id: string,
    currentX: number,
    currentY: number,
  ) => {
    if (e.button !== 0 || !svgRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const ptr = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
    dragMovedRef.current = false;
    setDragging({
      id,
      x: currentX,
      y: currentY,
      offsetX: currentX - ptr.x,
      offsetY: currentY - ptr.y,
    });
  };

  const handleLabelPointerMove = (e: React.PointerEvent<SVGGElement>, id: string) => {
    if (!dragging || dragging.id !== id || !svgRef.current) return;
    const ptr = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
    const nextX = Math.max(20, Math.min(width - 20, ptr.x + dragging.offsetX));
    const nextY = Math.max(20, Math.min(height - 20, ptr.y + dragging.offsetY));
    dragMovedRef.current = true;
    setDragging((prev) => (prev ? { ...prev, x: nextX, y: nextY } : null));
  };

  const handleLabelPointerUp = (e: React.PointerEvent<SVGGElement>, id: string) => {
    if (!dragging || dragging.id !== id) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (dragMovedRef.current) {
      onCommitLabelPosition(id, {
        x: Math.round(dragging.x * 10) / 10,
        y: Math.round(dragging.y * 10) / 10,
      });
    }
    setDragging(null);
  };

  const handleClusterPointerDown = (
    e: React.PointerEvent<SVGGElement>,
    id: string,
    currentX: number,
    currentY: number,
  ) => {
    if (e.button !== 0 || !svgRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const ptr = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
    dragClusterMovedRef.current = false;
    setDraggingCluster({
      id,
      x: currentX,
      y: currentY,
      offsetX: currentX - ptr.x,
      offsetY: currentY - ptr.y,
    });
  };

  const handleClusterPointerMove = (e: React.PointerEvent<SVGGElement>, id: string) => {
    if (!draggingCluster || draggingCluster.id !== id || !svgRef.current) return;
    const ptr = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
    const nextX = Math.max(20, Math.min(width - 20, ptr.x + draggingCluster.offsetX));
    const nextY = Math.max(
      titleOffset + 20,
      Math.min(exonBarTopY - 14, ptr.y + draggingCluster.offsetY),
    );
    dragClusterMovedRef.current = true;
    setDraggingCluster((prev) => (prev ? { ...prev, x: nextX, y: nextY } : null));
  };

  const handleClusterPointerUp = (e: React.PointerEvent<SVGGElement>, id: string) => {
    if (!draggingCluster || draggingCluster.id !== id) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (dragClusterMovedRef.current) {
      onCommitClusterPosition(id, {
        x: Math.round(draggingCluster.x * 10) / 10,
        y: Math.round(draggingCluster.y * 10) / 10,
      });
    }
    setDraggingCluster(null);
  };

  const resolveLabelCoord = (c: (typeof clusters)[number]) => {
    const id = c.mutation.id;
    const manual = manualPositions[id];
    const isDrag = dragging?.id === id;

    let autoX = c.clusterX;
    let autoY = c.topY - style.mode2LabelOffsetY;
    let boxHeight = Math.max(labelFontSize * 1.45, 14);

    if (style.mode2LabelPlacement === 'leader-lines') {
      const auto = labelLayoutMap.get(id);
      if (auto) {
        autoX = auto.labelX;
        autoY = auto.labelY;
        boxHeight = auto.boxHeight;
      }
    }

    const lx = isDrag ? dragging.x : (manual?.x ?? autoX);
    const ly = isDrag ? dragging.y : (manual?.y ?? autoY);
    return { lx, ly, isManual: Boolean(manual), isDrag, boxHeight };
  };

  const trackStartX = xScale(1);
  const trackEndX = xScale(gene.cdnaLengthBp);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fontFamily={style.fontFamily}
      style={{ userSelect: 'none', display: 'block' }}
    >
      {/* Backdrop */}
      <g id="layer-backdrop">
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={style.backgroundColor === 'transparent' ? 'none' : style.backgroundColor}
        />
      </g>

      {/* Title */}
      {style.showTitle && (
        <g id="layer-title">
          <text
            x={marginLeft}
            y={30}
            fontFamily={style.fontFamily}
            fontSize={style.titleFontSize}
            fontWeight="bold"
            fill="#0f172a"
          >
            {style.title || `${gene.geneSymbol} cDNA / Ekzon Frekans Haritası`}
          </text>
          <text
            x={marginLeft}
            y={48}
            fontFamily={style.fontFamily}
            fontSize={Math.max(10, style.titleFontSize - 6)}
            fill="#475569"
          >
            {`${style.subtitle ? style.subtitle + ' — ' : ''}Metrik: ${
              style.countMetric === 'family_count' ? 'Aile Sayısı' : 'Allel Sayısı'
            } (Küme Eşiği > ${style.mode2ClusterThreshold})`}
          </text>
        </g>
      )}

      {/* cDNA Exon Blocks */}
      <g id="layer-exons">
        <rect
          x={trackStartX}
          y={exonBarTopY}
          width={Math.max(10, trackEndX - trackStartX)}
          height={exonBarHeight}
          fill="#f1f5f9"
          stroke="#64748b"
          strokeWidth={1}
        />
        {gene.exons.map((ex, idx) => {
          const rawX1 = xScale(Math.max(1, ex.startBp));
          const rawX2 = xScale(Math.min(gene.cdnaLengthBp, ex.endBp));
          const gap = idx > 0 ? style.mode2ExonGap / 2 : 0;
          const x1 = rawX1 + gap;
          const w = Math.max(2, rawX2 - rawX1 - style.mode2ExonGap);
          const fitsInside = w >= ex.name.length * (style.domainFontSize * 0.62) + 4;

          return (
            <g key={ex.id}>
              <rect
                x={x1}
                y={exonBarTopY}
                width={w}
                height={exonBarHeight}
                fill={ex.color}
                stroke="#334155"
                strokeWidth={0.9}
              />
              {fitsInside && (
                <text
                  x={x1 + w / 2}
                  y={exonBarTopY + exonBarHeight / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily={style.fontFamily}
                  fontSize={style.domainFontSize}
                  fontWeight="bold"
                  fill={getContrastTextColor(ex.color)}
                >
                  {ex.name}
                </text>
              )}
              {!fitsInside && (
                <text
                  x={x1 + w / 2}
                  y={exonBarBottomY + 11}
                  textAnchor="middle"
                  fontFamily={style.fontFamily}
                  fontSize={Math.max(7.5, style.domainFontSize - 2)}
                  fill="#334155"
                >
                  {ex.name}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* bp Ruler */}
      <g id="layer-axis">
        <line
          x1={trackStartX}
          y1={exonBarBottomY + 18}
          x2={trackEndX}
          y2={exonBarBottomY + 18}
          stroke="#94a3b8"
          strokeWidth={0.9}
        />
        {bpTicks.map((tick) => {
          const tx = xScale(tick);
          return (
            <g key={tick}>
              <line
                x1={tx}
                y1={exonBarBottomY + 15}
                x2={tx}
                y2={exonBarBottomY + 21}
                stroke="#64748b"
                strokeWidth={0.9}
              />
              <text
                x={tx}
                y={exonBarBottomY + 30}
                textAnchor="middle"
                fontFamily={style.fontFamily}
                fontSize={Math.max(8, style.axisFontSize - 1)}
                fill="#475569"
              >
                {tick}
              </text>
            </g>
          );
        })}
        <text
          x={trackEndX + 26}
          y={exonBarBottomY + 30}
          textAnchor="start"
          fontFamily={style.fontFamily}
          fontSize={Math.max(8, style.axisFontSize - 1)}
          fill="#475569"
        >
          bp
        </text>
      </g>

      {/* Optional Protein Domains Below Exons */}
      {style.mode2ShowDomainsBelow && gene.domains.length > 0 && (
        <g id="layer-domains-below">
          {(() => {
            const domTopY = exonBarBottomY + 42;
            const domH = 18;
            return (
              <>
                <text
                  x={trackStartX - 8}
                  y={domTopY + domH / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontFamily={style.fontFamily}
                  fontSize={Math.max(8, style.axisFontSize - 1.5)}
                  fill="#64748b"
                >
                  Domain
                </text>
                {gene.domains.map((dom) => {
                  const bpStart = Math.max(1, (dom.start - 1) * 3 + 1);
                  const bpEnd = Math.min(gene.cdnaLengthBp, dom.end * 3);
                  const x1 = xScale(bpStart);
                  const x2 = xScale(bpEnd);
                  const w = Math.max(2, x2 - x1);
                  const label = dom.shortName?.trim() || dom.name;
                  const fits = w >= label.length * (style.domainFontSize * 0.55) + 4;
                  return (
                    <g key={`below-${dom.id}`}>
                      <rect
                        x={x1}
                        y={domTopY}
                        width={w}
                        height={domH}
                        rx={2}
                        fill={dom.color}
                        fillOpacity={0.85}
                        stroke="#475569"
                        strokeWidth={0.6}
                      />
                      {fits && (
                        <text
                          x={x1 + w / 2}
                          y={domTopY + domH / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontFamily={style.fontFamily}
                          fontSize={Math.max(7.5, style.domainFontSize - 1)}
                          fontWeight="bold"
                          fill={getContrastTextColor(dom.color)}
                        >
                          {label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </>
            );
          })()}
        </g>
      )}

      {/* Angled non-crossing stems connecting exact exon bp anchor to cluster base */}
      <g id="layer-stems">
        {clusters.map((c) => {
          const isHover = hoveredId === c.mutation.id;
          const stemPoints = computeClusterStemPolyline(
            c.anchorX,
            exonBarTopY,
            c.clusterX,
            c.clusterBottomY,
          );
          return (
            <g key={`stem-${c.mutation.id}`}>
              <polyline
                points={stemPoints}
                fill="none"
                stroke={isHover || c.isClusterDrag ? c.symStyle.color : style.mode2StemColor}
                strokeWidth={
                  isHover || c.isClusterDrag ? style.mode2StemWidth + 0.75 : style.mode2StemWidth
                }
                strokeLinejoin="round"
              />
              <circle
                cx={c.anchorX}
                cy={exonBarTopY}
                r={isHover || c.isClusterDrag ? 3 : 2}
                fill={c.symStyle.color}
              />
            </g>
          );
        })}
      </g>

      {/* Draggable Stacked / Clustered Mutation Symbols */}
      <g id="layer-stacks">
        {clusters.map((c) => {
          const id = c.mutation.id;
          const isHover = hoveredId === id;
          return (
            <g
              key={`stack-${id}`}
              style={{ cursor: c.isClusterDrag ? 'grabbing' : 'grab' }}
              onPointerDown={(e) => handleClusterPointerDown(e, id, c.clusterX, c.baseY)}
              onPointerMove={(e) => handleClusterPointerMove(e, id)}
              onPointerUp={(e) => handleClusterPointerUp(e, id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onResetClusterPosition(id);
              }}
              onMouseEnter={(e) => {
                setHoveredId(id);
                onHoverMutation?.({
                  mutation: c.mutation,
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
              }}
              onMouseMove={(e) => {
                onHoverMutation?.({
                  mutation: c.mutation,
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
              }}
              onMouseLeave={() => {
                setHoveredId(null);
                onHoverMutation?.(null);
              }}
            >
              {/* Invisible grab area for dragging the entire symbol pyramid/column */}
              <rect
                data-export-ignore="true"
                x={c.clusterX - c.layout.maxHalfWidth - 4}
                y={c.topY - c.symSize - 4}
                width={c.layout.maxHalfWidth * 2 + 8}
                height={c.layout.totalHeight + 8}
                rx={5}
                fill={
                  isHover || c.isClusterDrag ? 'rgba(99, 102, 241, 0.08)' : 'transparent'
                }
                stroke={
                  c.isClusterDrag
                    ? '#4f46e5'
                    : c.isClusterManual
                      ? 'rgba(79, 70, 229, 0.4)'
                      : isHover
                        ? '#94a3b8'
                        : 'none'
                }
                strokeWidth={1}
                strokeDasharray={c.isClusterManual && !c.isClusterDrag ? '3,2' : undefined}
              />
              {c.layout.points.map((pt, idx) => (
                <MutationSymbol
                  key={idx}
                  shape={c.symStyle.shape}
                  cx={c.clusterX + pt.dx}
                  cy={c.baseY + pt.dy}
                  size={isHover || c.isClusterDrag ? c.symSize * 1.12 : c.symSize}
                  color={c.symStyle.color}
                  strokeWidth={1.3}
                />
              ))}
            </g>
          );
        })}
      </g>

      {/* Leader Lines for Cluster Labels (only in leader-lines mode) */}
      {style.mode2ShowLabels && style.mode2LabelPlacement === 'leader-lines' && (
        <g id="layer-leaders">
          {clusters.map((c) => {
            const { lx, ly, boxHeight } = resolveLabelCoord(c);
            const isHover = hoveredId === c.mutation.id;
            const points = computeLeaderPolyline(
              c.clusterX,
              c.topY - 4,
              exonBarBottomY,
              lx,
              ly,
              boxHeight,
            );
            return (
              <polyline
                key={`leader-${c.mutation.id}`}
                points={points}
                fill="none"
                stroke={isHover ? c.symStyle.color : '#94a3b8'}
                strokeWidth={isHover ? 1.5 : 0.85}
                strokeDasharray={style.mode2LeaderDashed ? '2,2' : undefined}
              />
            );
          })}
        </g>
      )}

      {/* Draggable Cluster Labels */}
      {style.mode2ShowLabels && (
        <g id="layer-labels">
          {clusters.map((c) => {
            const id = c.mutation.id;
            const { lx, ly, isManual, isDrag, boxHeight } = resolveLabelCoord(c);
            const isHover = hoveredId === id;
            const estW = estimateLabelWidth(c.labelText, labelFontSize, 0);
            const isRotated = labelAngle !== 0;

            return (
              <g
                key={`clabel-${id}`}
                transform={`translate(${lx.toFixed(1)}, ${ly.toFixed(1)})${
                  isRotated ? ` rotate(${labelAngle})` : ''
                }`}
                style={{ cursor: isDrag ? 'grabbing' : 'grab' }}
                onPointerDown={(e) => handleLabelPointerDown(e, id, lx, ly)}
                onPointerMove={(e) => handleLabelPointerMove(e, id)}
                onPointerUp={(e) => handleLabelPointerUp(e, id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onResetLabelPosition(id);
                }}
                onMouseEnter={(e) => {
                  setHoveredId(id);
                  onHoverMutation?.({
                    mutation: c.mutation,
                    clientX: e.clientX,
                    clientY: e.clientY,
                  });
                }}
                onMouseLeave={() => {
                  setHoveredId(null);
                  onHoverMutation?.(null);
                }}
              >
                <rect
                  data-export-ignore="true"
                  x={isRotated ? -4 : -estW / 2}
                  y={-boxHeight / 2 - 1}
                  width={estW + (isRotated ? 8 : 0)}
                  height={boxHeight + 2}
                  rx={3}
                  fill={isHover || isDrag ? 'rgba(99,102,241,0.08)' : 'transparent'}
                  stroke={
                    isDrag
                      ? '#4f46e5'
                      : isManual
                        ? 'rgba(79,70,229,0.4)'
                        : isHover
                          ? '#94a3b8'
                          : 'none'
                  }
                  strokeWidth={1}
                  strokeDasharray={isManual && !isDrag ? '3,2' : undefined}
                />
                <text
                  x={0}
                  y={0}
                  textAnchor={isRotated ? 'start' : 'middle'}
                  dominantBaseline="central"
                  fontFamily={labelFontFamily}
                  fontSize={labelFontSize}
                  fontWeight={isHover ? 'bold' : labelFontWeight}
                  fill={labelColor}
                >
                  {c.labelText}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Legend */}
      <ChartLegend style={style} mutations={plottableMutations} />
    </svg>
  );
};
