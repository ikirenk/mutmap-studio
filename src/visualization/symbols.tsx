import React from 'react';
import { SymbolShape } from '../types/schema';

export interface MutationSymbolProps {
  shape: SymbolShape;
  cx: number;
  cy: number;
  size: number;
  color: string;
  strokeWidth?: number;
}

/**
 * Pure SVG vector symbol renderer (no CSS classes, explicit SVG presentation attributes
 * so exports open identically in Adobe Illustrator, Inkscape, and Chrome).
 */
export const MutationSymbol: React.FC<MutationSymbolProps> = ({
  shape,
  cx,
  cy,
  size,
  color,
  strokeWidth = 1.6,
}) => {
  const r = size;

  switch (shape) {
    case 'circle-filled':
      return (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={color}
          stroke="#111827"
          strokeWidth={strokeWidth * 0.55}
        />
      );

    case 'circle-open':
      return (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="#ffffff"
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );

    case 'square-filled': {
      const side = r * 1.75;
      return (
        <rect
          x={cx - side / 2}
          y={cy - side / 2}
          width={side}
          height={side}
          fill={color}
          stroke="#111827"
          strokeWidth={strokeWidth * 0.55}
        />
      );
    }

    case 'square-open': {
      const side = r * 1.75;
      return (
        <rect
          x={cx - side / 2}
          y={cy - side / 2}
          width={side}
          height={side}
          fill="#ffffff"
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );
    }

    case 'diamond-filled': {
      const d = r * 1.25;
      const pts = `${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`;
      return (
        <polygon
          points={pts}
          fill={color}
          stroke="#111827"
          strokeWidth={strokeWidth * 0.55}
        />
      );
    }

    case 'diamond-open': {
      const d = r * 1.25;
      const pts = `${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`;
      return (
        <polygon
          points={pts}
          fill="#ffffff"
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );
    }

    case 'triangle-up-filled': {
      const h = r * 1.15;
      const w = r * 1.15;
      const pts = `${cx},${cy - h} ${cx + w},${cy + h * 0.85} ${cx - w},${cy + h * 0.85}`;
      return (
        <polygon
          points={pts}
          fill={color}
          stroke="#111827"
          strokeWidth={strokeWidth * 0.55}
        />
      );
    }

    case 'triangle-up-open': {
      const h = r * 1.15;
      const w = r * 1.15;
      const pts = `${cx},${cy - h} ${cx + w},${cy + h * 0.85} ${cx - w},${cy + h * 0.85}`;
      return (
        <polygon
          points={pts}
          fill="#ffffff"
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );
    }

    case 'triangle-down-filled': {
      const h = r * 1.15;
      const w = r * 1.15;
      const pts = `${cx - w},${cy - h * 0.85} ${cx + w},${cy - h * 0.85} ${cx},${cy + h}`;
      return (
        <polygon
          points={pts}
          fill={color}
          stroke="#111827"
          strokeWidth={strokeWidth * 0.55}
        />
      );
    }

    case 'cross': {
      const d = r * 0.9;
      return (
        <g stroke={color} strokeWidth={strokeWidth * 1.2} strokeLinecap="round">
          <line x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d} />
          <line x1={cx + d} y1={cy - d} x2={cx - d} y2={cy + d} />
        </g>
      );
    }
  }
};
