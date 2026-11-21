import React from 'react';
import {
  LegendPosition,
  MUTATION_TYPES,
  MutationRecord,
  MutationType,
  StyleConfig,
} from '../types/schema';
import { MutationSymbol } from './symbols';

export interface ChartLegendProps {
  style: StyleConfig;
  mutations: MutationRecord[];
  activeTypes?: MutationType[];
}

export const ChartLegend: React.FC<ChartLegendProps> = ({
  style,
  mutations,
  activeTypes,
}) => {
  if (style.legendPosition === 'hidden') return null;

  const typesToShow = activeTypes ?? [...MUTATION_TYPES];
  const countsByType = new Map<MutationType, number>();
  for (const m of mutations) {
    countsByType.set(m.mutation_type, (countsByType.get(m.mutation_type) ?? 0) + 1);
  }

  const fontSize = style.legendFontSize;
  const rowHeight = Math.max(18, fontSize + 7);
  const paddingX = 12;
  const paddingY = 10;

  const entries = typesToShow.map((t) => {
    const count = countsByType.get(t) ?? 0;
    const label = style.legendShowCounts ? `${t} (${count})` : t;
    return { type: t, label, count };
  });

  if (style.legendPosition === 'bottom-center') {
    const itemWidths = entries.map((e) => e.label.length * fontSize * 0.58 + 30);
    const totalW = Math.min(
      style.width - 40,
      itemWidths.reduce((a, b) => a + b, 0) + paddingX * 2,
    );
    const boxW = Math.max(260, totalW);
    const boxH = rowHeight + paddingY * 2;
    const x = (style.width - boxW) / 2;
    const y = style.height - boxH - 12;

    let cursorX = x + paddingX;
    const rows: Array<{
      entry: (typeof entries)[number];
      cx: number;
      cy: number;
    }> = [];
    let currentY = y + paddingY + rowHeight / 2;

    entries.forEach((entry, idx) => {
      const w = itemWidths[idx];
      if (cursorX + w > x + boxW - paddingX && idx > 0) {
        cursorX = x + paddingX;
        currentY += rowHeight;
      }
      rows.push({ entry, cx: cursorX + 7, cy: currentY });
      cursorX += w;
    });

    const adjustedBoxH = currentY - (y + paddingY + rowHeight / 2) + rowHeight + paddingY * 2;
    const adjustedY = style.height - adjustedBoxH - 12;
    const dyOffset = adjustedY - y;

    return (
      <g id="layer-legend">
        <rect
          x={x}
          y={adjustedY}
          width={boxW}
          height={adjustedBoxH}
          rx={6}
          ry={6}
          fill="#ffffff"
          fillOpacity={0.95}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        {rows.map(({ entry, cx, cy }) => {
          const st = style.mutationStyles[entry.type];
          return (
            <g key={entry.type}>
              <MutationSymbol
                shape={st.shape}
                cx={cx}
                cy={cy + dyOffset}
                size={Math.min(6, st.size)}
                color={st.color}
              />
              <text
                x={cx + 12}
                y={cy + dyOffset}
                dominantBaseline="central"
                fontFamily={style.fontFamily}
                fontSize={fontSize}
                fill="#1e293b"
              >
                {entry.label}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  const maxLabelLen = Math.max(...entries.map((e) => e.label.length), 10);
  const boxW = Math.ceil(maxLabelLen * fontSize * 0.58 + 44);
  const boxH = entries.length * rowHeight + paddingY * 2 + 16;

  const posMap: Record<Exclude<LegendPosition, 'hidden' | 'bottom-center'>, { x: number; y: number }> = {
    'top-right': { x: style.width - boxW - 22, y: 18 },
    'top-left': { x: 22, y: 18 },
    'bottom-right': { x: style.width - boxW - 22, y: style.height - boxH - 18 },
    'bottom-left': { x: 22, y: style.height - boxH - 18 },
  };

  const pos = posMap[style.legendPosition];

  return (
    <g id="layer-legend">
      <rect
        x={pos.x}
        y={pos.y}
        width={boxW}
        height={boxH}
        rx={6}
        ry={6}
        fill="#ffffff"
        fillOpacity={0.94}
        stroke="#cbd5e1"
        strokeWidth={1}
      />
      <text
        x={pos.x + paddingX}
        y={pos.y + paddingY + 6}
        dominantBaseline="central"
        fontFamily={style.fontFamily}
        fontSize={Math.max(9, fontSize - 0.5)}
        fontWeight="bold"
        fill="#475569"
      >
        Mutasyon Tipi
      </text>
      {entries.map((entry, idx) => {
        const st = style.mutationStyles[entry.type];
        const cy = pos.y + paddingY + 22 + idx * rowHeight;
        const cx = pos.x + paddingX + 7;
        return (
          <g key={entry.type}>
            <MutationSymbol
              shape={st.shape}
              cx={cx}
              cy={cy}
              size={Math.min(6, st.size)}
              color={st.color}
            />
            <text
              x={cx + 13}
              y={cy}
              dominantBaseline="central"
              fontFamily={style.fontFamily}
              fontSize={fontSize}
              fill="#1e293b"
            >
              {entry.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};
