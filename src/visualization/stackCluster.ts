export interface ClusterOffsetPoint {
  dx: number;
  dy: number;
  row: number;
  col: number;
}

export interface ClusterLayoutResult {
  points: ClusterOffsetPoint[];
  totalHeight: number;
  maxHalfWidth: number;
}

export interface ClusterOffsetOptions {
  symbolSize: number;
  gap?: number;
  threshold: number;
  maxWidth: number;
}

export interface ClusterHorizontalInput {
  id: string;
  anchorX: number;
  halfWidth: number;
}

export interface ClusterHorizontalOptions {
  minX: number;
  maxX: number;
  gap?: number;
}

/**
 * Computes stacked symbol positions above a cDNA exon coordinate.
 * - When count <= threshold: stacks vertically in a single column (1 symbol per row).
 * - When count > threshold: forms an upward-expanding multi-column block/pyramid
 *   (e.g., 1-wide base, then 2-wide, 3-wide, 4-wide... capped at maxWidth)
 *   so high-frequency hotspots (like 30 families / 58 alleles) remain compact and readable.
 */
export function computeClusterOffsets(
  count: number,
  options: ClusterOffsetOptions,
): ClusterLayoutResult {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) {
    return { points: [], totalHeight: 0, maxHalfWidth: 0 };
  }

  const gap = options.gap ?? 3;
  const stepX = options.symbolSize * 2 + gap;
  const stepY = options.symbolSize * 2 + gap;
  const threshold = Math.max(2, options.threshold);
  const maxWidth = Math.max(2, options.maxWidth);
  // Diamond and triangle symbols extend to ~1.25x radius + stroke
  const outerRadius = options.symbolSize * 1.35;

  const points: ClusterOffsetPoint[] = [];

  if (safeCount <= threshold) {
    for (let row = 0; row < safeCount; row++) {
      points.push({
        dx: 0,
        dy: -(row * stepY),
        row,
        col: 0,
      });
    }
    return {
      points,
      totalHeight: (safeCount - 1) * stepY + options.symbolSize * 2,
      maxHalfWidth: outerRadius,
    };
  }

  // Upward-expanding pyramid/block cluster when count > threshold
  const rowsPerBand = Math.max(2, Math.floor(threshold / 3));
  let remaining = safeCount;
  let rowIndex = 0;
  let maxColsUsed = 1;

  while (remaining > 0) {
    const band = Math.floor(rowIndex / rowsPerBand);
    const targetWidth = Math.min(maxWidth, band + 1);
    const colsInRow = Math.min(targetWidth, remaining);
    maxColsUsed = Math.max(maxColsUsed, colsInRow);

    const rowSpanWidth = (colsInRow - 1) * stepX;
    for (let col = 0; col < colsInRow; col++) {
      const dx = colsInRow === 1 ? 0 : col * stepX - rowSpanWidth / 2;
      points.push({
        dx,
        dy: -(rowIndex * stepY),
        row: rowIndex,
        col,
      });
    }

    remaining -= colsInRow;
    rowIndex += 1;
  }

  return {
    points,
    totalHeight: (rowIndex - 1) * stepY + options.symbolSize * 2,
    maxHalfWidth: ((maxColsUsed - 1) * stepX) / 2 + outerRadius,
  };
}

/**
 * Resolves horizontal cluster centers using 1D Pool Adjacent Violators Algorithm (PAVA)
 * so adjacent symbol clusters never overlap horizontally, stay strictly ordered by
 * anchorX (guaranteeing non-crossing stems), remain inside [minX, maxX], and avoid
 * unnecessary shifts for isolated clusters.
 */
export function resolveClusterHorizontalPositions(
  items: ClusterHorizontalInput[],
  options: ClusterHorizontalOptions,
): Map<string, number> {
  const result = new Map<string, number>();
  const n = items.length;
  if (n === 0) return result;

  const sorted = [...items].sort((a, b) => a.anchorX - b.anchorX);
  const minX = options.minX;
  const maxX = options.maxX;
  const requestedGap = Math.max(0, options.gap ?? 10);
  const availableWidth = Math.max(1, maxX - minX);

  const rawWidthSum = sorted.reduce((acc, it) => acc + it.halfWidth * 2, 0);

  if (n === 1) {
    const item = sorted[0];
    const lo = minX + item.halfWidth;
    const hi = maxX - item.halfWidth;
    const x = lo <= hi ? Math.max(lo, Math.min(hi, item.anchorX)) : (minX + maxX) / 2;
    result.set(item.id, x);
    return result;
  }

  // Fallback if even raw cluster footprints exceed total canvas track width
  if (rawWidthSum > availableWidth) {
    const firstHalf = sorted[0].halfWidth;
    const lastHalf = sorted[n - 1].halfWidth;
    const spanCenter = Math.max(0, maxX - lastHalf - (minX + firstHalf));
    const totalCenterSpan = Math.max(1e-6, rawWidthSum - firstHalf - lastHalf);
    let accum = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        accum += sorted[i - 1].halfWidth + sorted[i].halfWidth;
      }
      const x = minX + firstHalf + (accum / totalCenterSpan) * spanCenter;
      result.set(sorted[i].id, x);
    }
    return result;
  }

  const maxFeasibleGap = (availableWidth - rawWidthSum) / (n - 1);
  const effectiveGap = Math.min(requestedGap, maxFeasibleGap);

  // Prefix cumulative minimum separation offsets
  const cumReq = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    cumReq[i] =
      cumReq[i - 1] + sorted[i - 1].halfWidth + sorted[i].halfWidth + effectiveGap;
  }

  // Transform to monotonic space z[i] = x[i] - cumReq[i]
  const a = sorted.map((it, i) => it.anchorX - cumReq[i]);

  // Exact PAVA isotonic regression minimizing sum((z[i] - a[i])^2) s.t. z[0] <= ... <= z[n-1]
  const blocks: Array<{ sum: number; count: number }> = [];
  for (let i = 0; i < n; i++) {
    blocks.push({ sum: a[i], count: 1 });
    while (blocks.length >= 2) {
      const last = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (prev.sum / prev.count > last.sum / last.count) {
        prev.sum += last.sum;
        prev.count += last.count;
        blocks.pop();
      } else {
        break;
      }
    }
  }

  const zMin = minX + sorted[0].halfWidth;
  const zMax = maxX - sorted[n - 1].halfWidth - cumReq[n - 1];

  let idx = 0;
  for (const blk of blocks) {
    const clampedZ = Math.max(zMin, Math.min(zMax, blk.sum / blk.count));
    for (let k = 0; k < blk.count; k++) {
      result.set(sorted[idx].id, clampedZ + cumReq[idx]);
      idx += 1;
    }
  }

  return result;
}

/**
 * Generates an angled dog-leg stem connecting an exact exon bp anchor on the bar
 * up to a horizontally separated cluster base, avoiding strictly 90-degree vertical crowding.
 */
export function computeClusterStemPolyline(
  anchorX: number,
  exonBarTopY: number,
  clusterX: number,
  clusterBottomY: number,
): string {
  if (Math.abs(clusterX - anchorX) < 1.5) {
    return `${anchorX.toFixed(1)},${exonBarTopY.toFixed(1)} ${clusterX.toFixed(1)},${clusterBottomY.toFixed(1)}`;
  }

  const verticalSpan = Math.max(4, exonBarTopY - clusterBottomY);
  const stubBottom = Math.min(6, verticalSpan * 0.22);
  const stubTop = Math.min(6, verticalSpan * 0.22);
  const y1 = exonBarTopY - stubBottom;
  const y2 = clusterBottomY + stubTop;

  return [
    `${anchorX.toFixed(1)},${exonBarTopY.toFixed(1)}`,
    `${anchorX.toFixed(1)},${y1.toFixed(1)}`,
    `${clusterX.toFixed(1)},${y2.toFixed(1)}`,
    `${clusterX.toFixed(1)},${clusterBottomY.toFixed(1)}`,
  ].join(' ');
}
