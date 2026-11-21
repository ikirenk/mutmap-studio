import { jsPDF } from 'jspdf';
import 'svg2pdf.js';

export async function exportSvgToPdf(options: {
  svgMarkup: string;
  widthPx: number;
  heightPx: number;
  defaultPath: string;
}): Promise<{ canceled: boolean; filePath?: string }> {
  // Prefer Chromium native vector printToPDF when running inside Electron
  if (window.electronAPI) {
    return window.electronAPI.exportVectorPdf({
      svgMarkup: options.svgMarkup,
      widthPx: options.widthPx,
      heightPx: options.heightPx,
      defaultPath: options.defaultPath,
    });
  }

  // Browser fallback using jsPDF + svg2pdf.js
  const parser = new DOMParser();
  const doc = parser.parseFromString(options.svgMarkup, 'image/svg+xml');
  const svgEl = doc.documentElement as unknown as SVGSVGElement;

  const orientation = options.widthPx >= options.heightPx ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [options.widthPx, options.heightPx],
    hotfixes: ['px_scaling'],
  });

  await pdf.svg(svgEl, {
    x: 0,
    y: 0,
    width: options.widthPx,
    height: options.heightPx,
  });

  pdf.save(options.defaultPath);
  return { canceled: false, filePath: options.defaultPath };
}
