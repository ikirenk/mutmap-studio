import { describe, expect, it } from 'vitest';
import { computeMode1Layout, LabelLayoutResult } from '../src/visualization/collision';

function boxesOverlap(a: LabelLayoutResult, b: LabelLayoutResult): boolean {
  const aLeft = a.labelX - a.boxWidth / 2;
  const aRight = a.labelX + a.boxWidth / 2;
  const aTop = a.labelY - a.boxHeight / 2;
  const aBottom = a.labelY + a.boxHeight / 2;

  const bLeft = b.labelX - b.boxWidth / 2;
  const bRight = b.labelX + b.boxWidth / 2;
  const bTop = b.labelY - b.boxHeight / 2;
  const bBottom = b.labelY + b.boxHeight / 2;

  return !(aRight <= bLeft || aLeft >= bRight || aBottom <= bTop || aTop >= bBottom);
}

describe('computeMode1Layout collision avoidance', () => {
  it('places dense hotspot mutations without overlapping bounding boxes', () => {
    // 10 clustered mutations within 40px of each other
    const items = Array.from({ length: 10 }, (_, idx) => ({
      id: `m-${idx}`,
      anchorX: 400 + idx * 4,
      side: 'top' as const,
      text: `p.Gly${280 + idx}Ser (${idx + 1})`,
    }));

    const layout = computeMode1Layout(items, {
      minX: 50,
      maxX: 1150,
      barTopY: 360,
      barBottomY: 400,
      fontSize: 10.5,
      symbolSize: 6,
      layoutMode: 'horizontal-tiered',
      topBoundaryY: 60,
      bottomBoundaryY: 680,
    });

    const results = Array.from(layout.values());
    expect(results).toHaveLength(10);

    for (let i = 0; i < results.length; i++) {
      expect(results[i].labelX - results[i].boxWidth / 2).toBeGreaterThanOrEqual(49.5);
      expect(results[i].labelX + results[i].boxWidth / 2).toBeLessThanOrEqual(1150.5);
      for (let j = i + 1; j < results.length; j++) {
        expect(boxesOverlap(results[i], results[j])).toBe(false);
      }
    }
  });
});
