export type LabelSide = 'top' | 'bottom';
export type Mode1LabelLayout = 'horizontal-tiered' | 'angled-45' | 'vertical-90';

export interface LayoutInputItem {
  id: string;
  anchorX: number;
  side: LabelSide;
  text: string;
}

export interface LabelLayoutResult {
  id: string;
  side: LabelSide;
  anchorX: number;
  labelX: number;
  labelY: number;
  boxWidth: number;
  boxHeight: number;
  tier: number;
}

export interface Mode1LayoutOptions {
  minX: number;
  maxX: number;
  barTopY: number;
  barBottomY: number;
  fontSize: number;
  symbolSize: number;
  layoutMode: Mode1LabelLayout;
  topBoundaryY: number;
  bottomBoundaryY: number;
}

/**
 * Estimates SVG label pill width including the inline mutation symbol and text padding.
 */
export function estimateLabelWidth(
  text: string,
  fontSize: number,
  symbolSize: number,
): number {
  const charWidth = fontSize * 0.58;
  const symbolPad = symbolSize * 2.4 + 10;
  return Math.max(38, Math.ceil(text.length * charWidth + symbolPad + 8));
}

function relaxCenters1D(
  items: Array<{ idx: number; desiredX: number; halfW: number }>,
  minX: number,
  maxX: number,
  gap: number,
): number[] {
  const n = items.length;
  const xs = items.map((it) => it.desiredX);
  if (n === 0) return xs;

  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 1; i < n; i++) {
      const minSep = items[i - 1].halfW + items[i].halfW + gap;
      const dist = xs[i] - xs[i - 1];
      if (dist < minSep) {
        const push = (minSep - dist) / 2;
        xs[i - 1] -= push;
        xs[i] += push;
        moved = true;
      }
    }
    // Gentle spring toward desiredX when free
    for (let i = 0; i < n; i++) {
      xs[i] = xs[i] * 0.92 + items[i].desiredX * 0.08;
    }
    // Clamp edges
    for (let i = 0; i < n; i++) {
      const leftBound = minX + items[i].halfW;
      const rightBound = maxX - items[i].halfW;
      if (leftBound <= rightBound) {
        xs[i] = Math.max(leftBound, Math.min(rightBound, xs[i]));
      }
    }
    // Final forward & backward sweep to guarantee minimum spacing
    for (let i = 1; i < n; i++) {
      const minSep = items[i - 1].halfW + items[i].halfW + gap;
      if (xs[i] - xs[i - 1] < minSep) {
        xs[i] = xs[i - 1] + minSep;
        moved = true;
      }
    }
    if (xs[n - 1] + items[n - 1].halfW > maxX) {
      xs[n - 1] = maxX - items[n - 1].halfW;
      for (let i = n - 2; i >= 0; i--) {
        const minSep = items[i].halfW + items[i + 1].halfW + gap;
        if (xs[i + 1] - xs[i] < minSep) {
          xs[i] = xs[i + 1] - minSep;
        }
      }
    }
    if (!moved && iter > 6) break;
  }

  return xs;
}

function layoutSideHorizontalTiered(
  sideItems: LayoutInputItem[],
  side: LabelSide,
  options: Mode1LayoutOptions,
): LabelLayoutResult[] {
  if (sideItems.length === 0) return [];

  const boxHeight = Math.max(options.fontSize * 1.55, options.symbolSize * 2 + 4);
  const verticalPitch = boxHeight + 10;
  const baseOffset = 34;
  const horizontalGap = 10;

  const sorted = [...sideItems].sort((a, b) => a.anchorX - b.anchorX);

  const availableHeight =
    side === 'top'
      ? Math.max(60, options.barTopY - options.topBoundaryY - baseOffset)
      : Math.max(60, options.bottomBoundaryY - options.barBottomY - baseOffset);
  const maxTiers = Math.max(2, Math.floor(availableHeight / verticalPitch));

  // Track occupied intervals per tier: [left, right]
  const tiers: Array<Array<{ left: number; right: number }>> = Array.from(
    { length: maxTiers },
    () => [],
  );

  const prelim: Array<{
    item: LayoutInputItem;
    labelX: number;
    tier: number;
    boxWidth: number;
  }> = [];

  for (const item of sorted) {
    const boxWidth = estimateLabelWidth(item.text, options.fontSize, options.symbolSize);
    const halfW = boxWidth / 2;

    let placedTier = -1;
    let placedX = Math.max(
      options.minX + halfW,
      Math.min(options.maxX - halfW, item.anchorX),
    );

    // Search tier closest to bar first
    for (let t = 0; t < maxTiers; t++) {
      const intervals = tiers[t];
      // Candidate X shifts near anchorX if slightly overlapping
      const candidates = [placedX];
      const last = intervals[intervals.length - 1];
      if (last) {
        const pushedRight = last.right + horizontalGap + halfW;
        if (pushedRight <= options.maxX - halfW && pushedRight - placedX <= 120) {
          candidates.push(pushedRight);
        }
      }

      for (const candX of candidates) {
        const left = candX - halfW;
        const right = candX + halfW;
        const collides = intervals.some(
          (iv) => !(right + horizontalGap <= iv.left || left - horizontalGap >= iv.right),
        );
        if (!collides) {
          placedTier = t;
          placedX = candX;
          intervals.push({ left, right });
          intervals.sort((a, b) => a.left - b.left);
          break;
        }
      }
      if (placedTier !== -1) break;
    }

    if (placedTier === -1) {
      // Fallback: place in least crowded tier and relax in 1D below
      let bestTier = 0;
      let minCount = Infinity;
      for (let t = 0; t < maxTiers; t++) {
        if (tiers[t].length < minCount) {
          minCount = tiers[t].length;
          bestTier = t;
        }
      }
      placedTier = bestTier;
      tiers[placedTier].push({ left: placedX - halfW, right: placedX + halfW });
    }

    prelim.push({ item, labelX: placedX, tier: placedTier, boxWidth });
  }

  // Run 1D relaxation per tier to guarantee zero overlap even on ultra-dense hotspots
  const byTier = new Map<number, typeof prelim>();
  for (const entry of prelim) {
    const arr = byTier.get(entry.tier) ?? [];
    arr.push(entry);
    byTier.set(entry.tier, arr);
  }

  const finalResults: LabelLayoutResult[] = [];
  for (const [tier, entries] of byTier.entries()) {
    entries.sort((a, b) => a.labelX - b.labelX);
    const relaxedXs = relaxCenters1D(
      entries.map((e, idx) => ({
        idx,
        desiredX: e.item.anchorX,
        halfW: e.boxWidth / 2,
      })),
      options.minX,
      options.maxX,
      horizontalGap,
    );

    entries.forEach((entry, idx) => {
      const labelY =
        side === 'top'
          ? options.barTopY - baseOffset - tier * verticalPitch
          : options.barBottomY + baseOffset + tier * verticalPitch;
      finalResults.push({
        id: entry.item.id,
        side,
        anchorX: entry.item.anchorX,
        labelX: relaxedXs[idx],
        labelY,
        boxWidth: entry.boxWidth,
        boxHeight,
        tier,
      });
    });
  }

  return finalResults;
}

function layoutSideAngledOrVertical(
  sideItems: LayoutInputItem[],
  side: LabelSide,
  options: Mode1LayoutOptions,
): LabelLayoutResult[] {
  if (sideItems.length === 0) return [];
  const sorted = [...sideItems].sort((a, b) => a.anchorX - b.anchorX);
  const pitchHalfW = Math.max(10, options.fontSize * 0.95);
  const relaxedXs = relaxCenters1D(
    sorted.map((it, idx) => ({
      idx,
      desiredX: it.anchorX,
      halfW: pitchHalfW,
    })),
    options.minX,
    options.maxX,
    4,
  );

  const offset = 36;
  const labelY = side === 'top' ? options.barTopY - offset : options.barBottomY + offset;

  return sorted.map((item, idx) => {
    const textW = estimateLabelWidth(item.text, options.fontSize, options.symbolSize);
    return {
      id: item.id,
      side,
      anchorX: item.anchorX,
      labelX: relaxedXs[idx],
      labelY,
      boxWidth: textW,
      boxHeight: Math.max(options.fontSize * 1.4, options.symbolSize * 2 + 2),
      tier: 0,
    };
  });
}

/**
 * Computes non-overlapping label positions for Mode 1 (top and bottom tracks).
 */
export function computeMode1Layout(
  items: LayoutInputItem[],
  options: Mode1LayoutOptions,
): Map<string, LabelLayoutResult> {
  const topItems = items.filter((i) => i.side === 'top');
  const bottomItems = items.filter((i) => i.side === 'bottom');

  const layoutFn =
    options.layoutMode === 'horizontal-tiered'
      ? layoutSideHorizontalTiered
      : layoutSideAngledOrVertical;

  const topResults = layoutFn(topItems, 'top', options);
  const bottomResults = layoutFn(bottomItems, 'bottom', options);

  const map = new Map<string, LabelLayoutResult>();
  for (const r of [...topResults, ...bottomResults]) {
    map.set(r.id, r);
  }
  return map;
}

/**
 * Generates a clean 3-segment vector leader polyline connecting the mutation anchor on the bar
 * to its (possibly user-dragged) label coordinates.
 */
export function computeLeaderPolyline(
  anchorX: number,
  barTopY: number,
  barBottomY: number,
  labelX: number,
  labelY: number,
  boxHeight = 16,
): string {
  const barMidY = (barTopY + barBottomY) / 2;
  const isAbove = labelY <= barMidY;
  const startY = isAbove ? barTopY : barBottomY;
  const endY = isAbove ? labelY + boxHeight / 2 + 2 : labelY - boxHeight / 2 - 2;
  const stub = isAbove ? -12 : 12;
  const kneeY = startY + stub;

  // If label is nearly aligned vertically, draw a neat straight/short elbow
  if (Math.abs(labelX - anchorX) < 3) {
    return `${anchorX.toFixed(1)},${startY.toFixed(1)} ${labelX.toFixed(1)},${endY.toFixed(1)}`;
  }

  const bendY = isAbove
    ? Math.max(endY + 6, Math.min(kneeY, endY + 14))
    : Math.min(endY - 6, Math.max(kneeY, endY - 14));

  return [
    `${anchorX.toFixed(1)},${startY.toFixed(1)}`,
    `${anchorX.toFixed(1)},${kneeY.toFixed(1)}`,
    `${labelX.toFixed(1)},${bendY.toFixed(1)}`,
    `${labelX.toFixed(1)},${endY.toFixed(1)}`,
  ].join(' ');
}
