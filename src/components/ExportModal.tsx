import React, { useState } from 'react';
import { Download, FileImage, FileText, Loader2, PenTool, X } from 'lucide-react';
import { useT } from '../i18n/translations';
import { exportSvgToPdf } from '../services/export/pdfExporter';
import { exportSvgToPngBytes } from '../services/export/pngExporter';
import { serializeChartSvg } from '../services/export/svgSerializer';
import { saveBinaryFile, saveTextFile } from '../services/platform';
import { useProjectStore } from '../store/useProjectStore';

export type ExportFormat = 'svg' | 'pdf' | 'png300' | 'png600';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  svgRef: React.RefObject<SVGSVGElement>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  svgRef,
  onNotify,
}) => {
  const { t } = useT();
  const gene = useProjectStore((s) => s.geneStructure);
  const activeMode = useProjectStore((s) => s.activeMode);
  const style = useProjectStore((s) => s.style);

  const [format, setFormat] = useState<ExportFormat>('svg');
  const [transparentBg, setTransparentBg] = useState(false);
  const [fileBase, setFileBase] = useState(
    `${gene.geneSymbol || 'mutmap'}_${activeMode === 'protein-domain' ? 'protein' : 'cdna'}`,
  );
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const dpiForPng = format === 'png600' ? 600 : 300;
  const pngScale = dpiForPng / 96;
  const outW = Math.round(style.width * pngScale);
  const outH = Math.round(style.height * pngScale);
  const widthInches = (style.width / 96).toFixed(1);
  const heightInches = (style.height / 96).toFixed(1);

  const handleExport = async () => {
    const svgEl = svgRef.current;
    if (!svgEl) {
      onNotify(t.exportNoSvgErr, 'error');
      return;
    }

    setIsExporting(true);
    try {
      const svgMarkup = serializeChartSvg(svgEl, {
        width: style.width,
        height: style.height,
        transparentBackground: transparentBg && format !== 'pdf',
      });

      const safeBase = fileBase.trim() || 'mutation_map';

      if (format === 'svg') {
        const res = await saveTextFile({
          defaultPath: `${safeBase}.svg`,
          filters: [{ name: t.svgTitle, extensions: ['svg'] }],
          content: svgMarkup,
          mimeType: 'image/svg+xml;charset=utf-8',
        });
        if (!res.canceled) {
          onNotify(t.exportSvgOk, 'success');
          onClose();
        }
      } else if (format === 'pdf') {
        const res = await exportSvgToPdf({
          svgMarkup,
          widthPx: style.width,
          heightPx: style.height,
          defaultPath: `${safeBase}.pdf`,
        });
        if (!res.canceled) {
          onNotify(t.exportPdfOk, 'success');
          onClose();
        }
      } else {
        const dpi = format === 'png600' ? 600 : 300;
        const bytes = await exportSvgToPngBytes({
          svgMarkup,
          widthPx: style.width,
          heightPx: style.height,
          dpi,
          backgroundColor: style.backgroundColor,
          transparentBackground: transparentBg,
        });
        const res = await saveBinaryFile({
          defaultPath: `${safeBase}_${dpi}dpi.png`,
          filters: [{ name: `PNG (${dpi} DPI)`, extensions: ['png'] }],
          bytes,
          mimeType: 'image/png',
        });
        if (!res.canceled) {
          onNotify(t.exportPngOk(dpi), 'success');
          onClose();
        }
      }
    } catch (err) {
      onNotify(
        t.exportErr(err instanceof Error ? err.message : String(err)),
        'error',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions: Array<{
    id: ExportFormat;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'svg',
      title: t.svgTitle,
      desc: t.svgDesc,
      icon: <PenTool className="w-4 h-4 text-indigo-600" />,
    },
    {
      id: 'pdf',
      title: t.pdfTitle,
      desc: t.pdfDesc,
      icon: <FileText className="w-4 h-4 text-rose-600" />,
    },
    {
      id: 'png300',
      title: 'PNG — 300 DPI',
      desc: t.png300Desc(
        Math.round(style.width * (300 / 96)),
        Math.round(style.height * (300 / 96)),
      ),
      icon: <FileImage className="w-4 h-4 text-emerald-600" />,
    },
    {
      id: 'png600',
      title: 'PNG — 600 DPI',
      desc: t.png600Desc(outW, outH),
      icon: <FileImage className="w-4 h-4 text-amber-600" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Download className="w-4 h-4 text-indigo-600" />
            {t.exportModalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              {t.fileNameLabel}
            </label>
            <input
              type="text"
              value={fileBase}
              onChange={(e) => setFileBase(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-2">
              {t.outputFormatLabel}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {formatOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat(opt.id)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    format === opt.id
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    {opt.icon}
                    <span>{opt.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {format !== 'pdf' && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
              <input
                type="checkbox"
                checked={transparentBg}
                onChange={(e) => setTransparentBg(e.target.checked)}
              />
              <span>{t.transparentBgLabel}</span>
            </label>
          )}

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>
              {t.vectorCanvasLabel}{' '}
              <strong>
                {style.width} × {style.height} px
              </strong>
            </span>
            <span>
              {t.physicalPrintLabel}{' '}
              <strong>
                {widthInches}&quot; × {heightInches}&quot;
              </strong>
            </span>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            {t.closeCancel}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {t.exportBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
