import { describe, expect, it } from 'vitest';
import {
  ManualLabelPositionsSchema,
  StyleConfigSchema,
  createDefaultMutationStyles,
} from '../src/types/schema';
import {
  computeClusterOffsets,
  computeClusterStemPolyline,
  resolveClusterHorizontalPositions,
} from '../src/visualization/stackCluster';

describe('computeClusterOffsets', () => {
  it('stacks vertically in a single column when count <= threshold', () => {
    const res = computeClusterOffsets(7, {
      symbolSize: 5,
      gap: 2,
      threshold: 10,
      maxWidth: 5,
    });

    expect(res.points).toHaveLength(7);
    expect(res.points.every((p) => p.dx === 0)).toBe(true);
    for (let i = 1; i < res.points.length; i++) {
      expect(res.points[i].dy).toBeLessThan(res.points[i - 1].dy);
    }
  });

  it('expands into a compact multi-column pyramid/block when count > threshold', () => {
    const singleCol = computeClusterOffsets(30, {
      symbolSize: 5,
      gap: 2,
      threshold: 100,
      maxWidth: 5,
    });

    const clustered = computeClusterOffsets(30, {
      symbolSize: 5,
      gap: 2,
      threshold: 10,
      maxWidth: 5,
    });

    expect(clustered.points).toHaveLength(30);
    expect(clustered.totalHeight).toBeLessThan(singleCol.totalHeight * 0.65);

    expect(clustered.points[0].dx).toBe(0);
    const distinctX = new Set(clustered.points.map((p) => Math.round(p.dx)));
    expect(distinctX.size).toBeGreaterThan(1);
    expect(clustered.maxHalfWidth).toBeGreaterThan(5);
  });
});

describe('resolveClusterHorizontalPositions', () => {
  it('separates overlapping adjacent clusters near the right edge while leaving isolated clusters unshifted', () => {
    // Mirrors NFKB1 layout: isolated left clusters + crowded c.730+4A>G / c.872delA + right hotspot c.2557C>T / c.2600C>T
    const items = [
      { id: 'c200', anchorX: 138, halfWidth: 32 },
      { id: 'c469', anchorX: 237, halfWidth: 32 },
      { id: 'c730', anchorX: 333, halfWidth: 26 },
      { id: 'c872', anchorX: 385, halfWidth: 32 },
      { id: 'c2557', anchorX: 1007, halfWidth: 34 },
      { id: 'c2600', anchorX: 1024, halfWidth: 26 },
    ];

    const pos = resolveClusterHorizontalPositions(items, {
      minX: 54,
      maxX: 1146,
      gap: 10,
    });

    // Isolated left clusters stay exact
    expect(pos.get('c200')).toBeCloseTo(138, 5);
    expect(pos.get('c469')).toBeCloseTo(237, 5);

    // Every adjacent pair satisfies minimum separation and monotonic order
    for (let i = 1; i < items.length; i++) {
      const prevX = pos.get(items[i - 1].id)!;
      const currX = pos.get(items[i].id)!;
      const minSep = items[i - 1].halfWidth + items[i].halfWidth + 10;
      expect(currX - prevX).toBeGreaterThanOrEqual(minSep - 1e-6);
    }

    // Bounds respected
    expect(pos.get('c200')! - items[0].halfWidth).toBeGreaterThanOrEqual(54 - 1e-6);
    expect(pos.get('c2600')! + items[5].halfWidth).toBeLessThanOrEqual(1146 + 1e-6);
  });

  it('handles 18 densely packed clusters without any horizontal overlap', () => {
    const items = Array.from({ length: 18 }, (_, i) => ({
      id: `m-${i}`,
      anchorX: 300 + i * 8,
      halfWidth: 16,
    }));

    const pos = resolveClusterHorizontalPositions(items, {
      minX: 54,
      maxX: 1146,
      gap: 10,
    });

    for (let i = 1; i < items.length; i++) {
      const prevX = pos.get(items[i - 1].id)!;
      const currX = pos.get(items[i].id)!;
      expect(currX - prevX).toBeGreaterThanOrEqual(42 - 1e-6);
    }
    expect(pos.get('m-0')! - 16).toBeGreaterThanOrEqual(54 - 1e-6);
    expect(pos.get('m-17')! + 16).toBeLessThanOrEqual(1146 + 1e-6);
  });
});

describe('computeClusterStemPolyline', () => {
  it('draws a direct 2-point stem when unshifted and a 4-point angled dog-leg when shifted', () => {
    const straight = computeClusterStemPolyline(200, 500, 200.5, 480);
    expect(straight.split(' ')).toHaveLength(2);

    const angled = computeClusterStemPolyline(1007, 500, 980, 456);
    const pts = angled.split(' ');
    expect(pts).toHaveLength(4);
    expect(pts[0]).toBe('1007.0,500.0');
    expect(pts[3]).toBe('980.0,456.0');
  });
});

describe('Mode 2 schema backwards-compatibility', () => {
  it('fills default values for newly added Mode 2 customization fields and cdna-exon-clusters', () => {
    const parsedStyle = StyleConfigSchema.parse({
      mutationStyles: createDefaultMutationStyles(),
    });
    expect(parsedStyle.mode2LabelPlacement).toBe('leader-lines');
    expect(parsedStyle.mode2LabelFontFamily).toBe('inherit');
    expect(parsedStyle.mode2LabelFontSize).toBe(10.5);
    expect(parsedStyle.mode2LabelFontWeight).toBe('normal');
    expect(parsedStyle.mode2LabelAngle).toBe(0);

    const parsedManual = ManualLabelPositionsSchema.parse({
      'protein-domain': {},
      'cdna-exon': {},
    });
    expect(parsedManual['cdna-exon-clusters']).toEqual({});
  });
});
