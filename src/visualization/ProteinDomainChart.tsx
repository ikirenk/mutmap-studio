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
  LabelSide,
  computeLeaderPolyline,
  computeMode1Layout,
  estimateLabelWidth,
} from './collision';
import { MutationSymbol } from './symbols';

export interface HoveredMutationInfo {
  mutation: MutationRecord;
  clientX: number;
  clientY: number;
}

export interface ProteinDomainChartProps {
  svgRef: React.RefObject<SVGSVGElement>;
  gene: GeneStructure;
  mutations: MutationRecord[];
  style: StyleConfig;
  manualPositions: Record<string, LabelCoord>;
  onCommitLabelPosition: (id: string, coord: LabelCoord) => void;
  onResetLabelPosition: (id: string) => void;
  onHoverMutation?: (info: HoveredMutationInfo | null) => void;
}

function getContrastTextColor(hexColor: string): string {
  const c = d3.color(hexColor);
  if (!c) return '#0f172a';
  const rgb = c.rgb();
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.52 ? '#ffffff' : '#0f172a';
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

function formatMutationLabel(m: MutationRecord, style: StyleConfig): string {
  const parts: string[] = [];
  if (style.mode1ShowProteinChange && m.protein_change) {
    parts.push(m.protein_change);
  }
  if (style.mode1ShowCdnaChange && m.cDNA_change) {
    parts.push(m.cDNA_change);
  }
  if (parts.length === 0) {
    parts.push(m.protein_change || m.cDNA_change || `#${m.position_aa ?? '?'}`);
  }
  const count =
    style.countMetric === 'family_count'
      ? m.patient_or_allele_count.family_count
      : m.patient_or_allele_count.allele_count;
  if (style.mode1ShowCount) {
    parts.push(`(${count})`);
  }
  if (style.mode1ShowPhenotype && m.phenotype_or_type) {
    parts.push(`[${m.phenotype_or_type}]`);
  }
  return parts.join(' ');
}

export const ProteinDomainChart: React.FC<ProteinDomainChartProps> = ({
  svgRef,
  gene,
  mutations,
  style,
  manualPositions,
  onCommitLabelPosition,
  onResetLabelPosition,
  onHoverMutation,
}) => {
  const [dragging, setDragging] = useState<{
    id: string;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragMovedRef = useRef(false);

  const width = style.width;
  const height = style.height;
  const marginLeft = 64;
  const marginRight = 64;
  const titleOffset = style.showTitle ? 62 : 22;
  const bottomReserve =
    style.legendPosition === 'bottom-center' ||
    style.legendPosition === 'bottom-left' ||
    style.legendPosition === 'bottom-right'
      ? 68
      : 28;

  const barHeight = style.mode1BarHeight;
  const barCenterY =
    style.mode1SplitBy === 'top-only'
      ? Math.round((height - bottomReserve) * 0.72)
      : Math.round(titleOffset + (height - titleOffset - bottomReserve) * 0.5);
  const barTopY = barCenterY - barHeight / 2;
  const barBottomY = barCenterY + barHeight / 2;
  const rulerY = barBottomY + 18;

  const xScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([1, Math.max(1, gene.proteinLengthAa)])
        .range([marginLeft, width - marginRight])
        .clamp(true),
    [gene.proteinLengthAa, width],
  );

  const plottableMutations = useMemo(() => {
    const valid = mutations.filter((m) => m.position_aa !== null && m.position_aa > 0);
    return [...valid].sort((a, b) => (a.position_aa ?? 0) - (b.position_aa ?? 0));
  }, [mutations]);

  const sideById = useMemo(() => {
    const map = new Map<string, LabelSide>();
    const topPheno = style.mode1TopPhenotype.trim().toLowerCase();

    plottableMutations.forEach((m, index) => {
      if (m.side_override === 'top' || m.side_override === 'bottom') {
        map.set(m.id, m.side_override);
        return;
      }
      switch (style.mode1SplitBy) {
        case 'top-only':
          map.set(m.id, 'top');
          break;
        case 'alternating':
          map.set(m.id, index % 2 === 0 ? 'top' : 'bottom');
          break;
        case 'mutation-type':
          map.set(m.id, m.mutation_type === 'Missense' ? 'top' : 'bottom');
          break;
        case 'phenotype': {
          const ph = m.phenotype_or_type.trim().toLowerCase();
          map.set(m.id, ph === topPheno ? 'top' : 'bottom');
          break;
        }
      }
    });
    return map;
  }, [plottableMutations, style.mode1SplitBy, style.mode1TopPhenotype]);

  const autoLayoutMap = useMemo(() => {
    const maxSymSize = Math.max(
      ...Object.values(style.mutationStyles).map((s) => s.size),
      6,
    );
    const items = plottableMutations.map((m) => ({
      id: m.id,
      anchorX: xScale(m.position_aa ?? 1),
      side: sideById.get(m.id) ?? 'top',
      text: formatMutationLabel(m, style),
    }));

    return computeMode1Layout(items, {
      minX: marginLeft - 14,
      maxX: width - marginRight + 14,
      barTopY,
      barBottomY: rulerY + 12,
      fontSize: style.labelFontSize,
      symbolSize: maxSymSize,
      layoutMode: style.mode1LabelLayout,
      topBoundaryY: titleOffset + 10,
      bottomBoundaryY: height - bottomReserve - 6,
    });
  }, [
    plottableMutations,
    sideById,
    xScale,
    style,
    width,
    height,
    barTopY,
    rulerY,
    titleOffset,
    bottomReserve,
  ]);

  const ticks = useMemo(() => {
    const len = Math.max(1, gene.proteinLengthAa);
    const rawTicks = xScale.ticks(8);
    const filtered = rawTicks.filter((t) => t > 1 && t < len);
    return Array.from(new Set([1, ...filtered, len])).sort((a, b) => a - b);
  }, [gene.proteinLengthAa, xScale]);

  const handlePointerDown = (
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

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>, id: string) => {
    if (!dragging || dragging.id !== id || !svgRef.current) return;
    const ptr = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
    const nextX = Math.max(20, Math.min(width - 20, ptr.x + dragging.offsetX));
    const nextY = Math.max(20, Math.min(height - 20, ptr.y + dragging.offsetY));
    dragMovedRef.current = true;
    setDragging((prev) => (prev ? { ...prev, x: nextX, y: nextY } : null));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGGElement>, id: string) => {
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

  const backboneStartX = xScale(1);
  const backboneEndX = xScale(gene.proteinLengthAa);
  const backboneWidth = Math.max(10, backboneEndX - backboneStartX);

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

      {/* Title & Subtitle */}
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
            {style.title || `${gene.geneSymbol} Protein Domain & Mutasyon Haritası`}
          </text>
          {style.subtitle && (
            <text
              x={marginLeft}
              y={48}
              fontFamily={style.fontFamily}
              fontSize={Math.max(10, style.titleFontSize - 6)}
              fill="#475569"
            >
              {style.subtitle}
            </text>
          )}
        </g>
      )}

      {/* Protein Backbone */}
      <g id="layer-backbone">
        <rect
          x={backboneStartX}
          y={barTopY}
          width={backboneWidth}
          height={barHeight}
          rx={3}
          ry={3}
          fill="#e2e8f0"
          stroke="#475569"
          strokeWidth={1.2}
        />
        <text
          x={backboneStartX - 12}
          y={barCenterY}
          textAnchor="end"
          dominantBaseline="central"
          fontFamily={style.fontFamily}
          fontSize={style.axisFontSize + 1}
          fontWeight="bold"
          fill="#334155"
        >
          N
        </text>
        <text
          x={backboneEndX + 12}
          y={barCenterY}
          textAnchor="start"
          dominantBaseline="central"
          fontFamily={style.fontFamily}
          fontSize={style.axisFontSize + 1}
          fontWeight="bold"
          fill="#334155"
        >
          C
        </text>
      </g>

      {/* Protein Domains */}
      <g id="layer-domains">
        {gene.domains.map((dom) => {
          const x1 = xScale(Math.max(1, Math.min(gene.proteinLengthAa, dom.start)));
          const x2 = xScale(Math.max(1, Math.min(gene.proteinLengthAa, dom.end)));
          const w = Math.max(2, x2 - x1);
          const label = dom.shortName?.trim() || dom.name;
          const approxCharsFit = Math.floor((w - 6) / (style.domainFontSize * 0.58));
          const displayLabel =
            approxCharsFit >= 2
              ? label.length <= approxCharsFit
                ? label
                : label.slice(0, Math.max(2, approxCharsFit - 1)) + '…'
              : '';

          return (
            <g key={dom.id}>
              <rect
                x={x1}
                y={barTopY}
                width={w}
                height={barHeight}
                fill={dom.color}
                stroke="#1e293b"
                strokeWidth={0.8}
              />
              {displayLabel && (
                <text
                  x={x1 + w / 2}
                  y={barCenterY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily={style.fontFamily}
                  fontSize={style.domainFontSize}
                  fontWeight="bold"
                  fill={getContrastTextColor(dom.color)}
                >
                  {displayLabel}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Amino Acid Ruler */}
      <g id="layer-axis">
        <line
          x1={backboneStartX}
          y1={rulerY}
          x2={backboneEndX}
          y2={rulerY}
          stroke="#64748b"
          strokeWidth={1}
        />
        {ticks.map((tick) => {
          const tx = xScale(tick);
          return (
            <g key={tick}>
              <line
                x1={tx}
                y1={rulerY - 3}
                x2={tx}
                y2={rulerY + 4}
                stroke="#64748b"
                strokeWidth={1}
              />
              <text
                x={tx}
                y={rulerY + 14}
                textAnchor="middle"
                fontFamily={style.fontFamily}
                fontSize={style.axisFontSize}
                fill="#475569"
              >
                {tick}
              </text>
            </g>
          );
        })}
        <text
          x={backboneEndX + 12}
          y={rulerY + 14}
          textAnchor="start"
          fontFamily={style.fontFamily}
          fontSize={style.axisFontSize}
          fill="#475569"
        >
          aa
        </text>
      </g>

      {/* Leader Lines */}
      <g id="layer-leaders">
        {plottableMutations.map((m) => {
          const auto = autoLayoutMap.get(m.id);
          if (!auto) return null;
          const manual = manualPositions[m.id];
          const isDrag = dragging?.id === m.id;
          const lx = isDrag ? dragging.x : (manual?.x ?? auto.labelX);
          const ly = isDrag ? dragging.y : (manual?.y ?? auto.labelY);
          const isHover = hoveredId === m.id;
          const symStyle = style.mutationStyles[m.mutation_type];

          const points = computeLeaderPolyline(
            auto.anchorX,
            barTopY,
            barBottomY,
            lx,
            ly,
            auto.boxHeight,
          );

          return (
            <polyline
              key={`leader-${m.id}`}
              points={points}
              fill="none"
              stroke={isHover ? symStyle.color : '#64748b'}
              strokeWidth={isHover ? 1.6 : 0.9}
              strokeOpacity={isHover ? 1 : 0.85}
            />
          );
        })}
      </g>

      {/* Anchor Ticks on Protein Bar */}
      <g id="layer-markers">
        {plottableMutations.map((m) => {
          const ax = xScale(m.position_aa ?? 1);
          const side = sideById.get(m.id) ?? 'top';
          const symStyle = style.mutationStyles[m.mutation_type];
          const isHover = hoveredId === m.id;
          return (
            <g key={`anchor-${m.id}`}>
              <line
                x1={ax}
                y1={barTopY}
                x2={ax}
                y2={barBottomY}
                stroke={symStyle.color}
                strokeWidth={isHover ? 2 : 1.1}
                strokeOpacity={isHover ? 0.95 : 0.45}
              />
              <circle
                cx={ax}
                cy={side === 'top' ? barTopY : barBottomY}
                r={isHover ? 3.5 : 2.2}
                fill={symStyle.color}
              />
            </g>
          );
        })}
      </g>

      {/* Draggable Mutation Labels + Symbols */}
      <g id="layer-labels">
        {plottableMutations.map((m) => {
          const auto = autoLayoutMap.get(m.id);
          if (!auto) return null;
          const manual = manualPositions[m.id];
          const isDrag = dragging?.id === m.id;
          const lx = isDrag ? dragging.x : (manual?.x ?? auto.labelX);
          const ly = isDrag ? dragging.y : (manual?.y ?? auto.labelY);
          const isManual = Boolean(manual);
          const isHover = hoveredId === m.id;

          const labelText = formatMutationLabel(m, style);
          const symStyle = style.mutationStyles[m.mutation_type];
          const symSize = symStyle.size;
          const estWidth = estimateLabelWidth(labelText, style.labelFontSize, symSize);

          const isRotated = style.mode1LabelLayout !== 'horizontal-tiered';
          const isAbove = ly <= barCenterY;
          const rotationAngle =
            style.mode1LabelLayout === 'angled-45'
              ? isAbove
                ? -45
                : 45
              : style.mode1LabelLayout === 'vertical-90'
                ? isAbove
                  ? -90
                  : 90
                : 0;

          const symCx = isRotated ? 0 : -estWidth / 2 + symSize + 4;
          const textX = isRotated ? symSize * 1.8 + 4 : symCx + symSize + 5;

          return (
            <g
              key={`label-${m.id}`}
              transform={`translate(${lx.toFixed(1)}, ${ly.toFixed(1)})${
                isRotated ? ` rotate(${rotationAngle})` : ''
              }`}
              style={{ cursor: isDrag ? 'grabbing' : 'grab' }}
              onPointerDown={(e) => handlePointerDown(e, m.id, lx, ly)}
              onPointerMove={(e) => handlePointerMove(e, m.id)}
              onPointerUp={(e) => handlePointerUp(e, m.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onResetLabelPosition(m.id);
              }}
              onMouseEnter={(e) => {
                setHoveredId(m.id);
                onHoverMutation?.({
                  mutation: m,
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
              }}
              onMouseMove={(e) => {
                onHoverMutation?.({
                  mutation: m,
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
              }}
              onMouseLeave={() => {
                setHoveredId(null);
                onHoverMutation?.(null);
              }}
            >
              {/* Invisible hit area for easy dragging */}
              <rect
                data-export-ignore="true"
                x={isRotated ? -10 : -estWidth / 2 - 2}
                y={-auto.boxHeight / 2 - 2}
                width={estWidth + 8}
                height={auto.boxHeight + 4}
                rx={4}
                fill={isHover || isDrag ? 'rgba(99, 102, 241, 0.08)' : 'transparent'}
                stroke={
                  isDrag
                    ? '#4f46e5'
                    : isManual
                      ? 'rgba(79, 70, 229, 0.45)'
                      : isHover
                        ? '#94a3b8'
                        : 'none'
                }
                strokeWidth={1}
                strokeDasharray={isManual && !isDrag ? '3,2' : undefined}
              />

              <MutationSymbol
                shape={symStyle.shape}
                cx={symCx}
                cy={0}
                size={symSize}
                color={symStyle.color}
              />

              <text
                x={textX}
                y={0}
                textAnchor="start"
                dominantBaseline="central"
                fontFamily={style.fontFamily}
                fontSize={style.labelFontSize}
                fontWeight={isHover ? 'bold' : 'normal'}
                fill="#0f172a"
              >
                {labelText}
              </text>
            </g>
          );
        })}
      </g>

      {/* Academic Legend */}
      <ChartLegend style={style} mutations={plottableMutations} />
    </svg>
  );
};
