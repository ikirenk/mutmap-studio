export interface SerializeSvgOptions {
  width: number;
  height: number;
  transparentBackground?: boolean;
}

/**
 * Serializes the live React SVG element into a clean standalone vector SVG document
 * compatible with Adobe Illustrator, Inkscape, and academic publishers.
 */
export function serializeChartSvg(
  svgElement: SVGSVGElement,
  options: SerializeSvgOptions,
): string {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Strip interactive-only hit rects & UI helpers
  clone.querySelectorAll('[data-export-ignore="true"]').forEach((node) => {
    node.remove();
  });

  if (options.transparentBackground) {
    const backdropRect = clone.querySelector('#layer-backdrop rect');
    if (backdropRect) {
      backdropRect.setAttribute('fill', 'none');
    }
  }

  // Strip pointer cursors & inline drag styling
  clone.querySelectorAll('[style]').forEach((el) => {
    const styleAttr = el.getAttribute('style') ?? '';
    const cleaned = styleAttr
      .replace(/cursor\s*:[^;]+;?/gi, '')
      .replace(/user-select\s*:[^;]+;?/gi, '')
      .trim();
    if (cleaned) {
      el.setAttribute('style', cleaned);
    } else {
      el.removeAttribute('style');
    }
  });

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('version', '1.1');
  clone.setAttribute('width', String(options.width));
  clone.setAttribute('height', String(options.height));
  clone.setAttribute('viewBox', `0 0 ${options.width} ${options.height}`);

  const serializer = new XMLSerializer();
  const rawXml = serializer.serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${rawXml}`;
}
