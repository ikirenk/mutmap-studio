import React, { useState } from 'react';
import {
  Dna,
  GitCommitHorizontal,
  Info,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useT } from '../i18n/translations';
import { getFilteredMutations, useProjectStore } from '../store/useProjectStore';
import { CdnaExonChart } from '../visualization/CdnaExonChart';
import {
  HoveredMutationInfo,
  ProteinDomainChart,
} from '../visualization/ProteinDomainChart';

export interface ChartWorkspaceProps {
  svgRef: React.RefObject<SVGSVGElement>;
}

export const ChartWorkspace: React.FC<ChartWorkspaceProps> = ({ svgRef }) => {
  const { t } = useT();
  const gene = useProjectStore((s) => s.geneStructure);
  const mutations = useProjectStore((s) => s.mutations);
  const activeMode = useProjectStore((s) => s.activeMode);
  const setActiveMode = useProjectStore((s) => s.setActiveMode);
  const style = useProjectStore((s) => s.style);
  const filter = useProjectStore((s) => s.filter);
  const manualLabelPositions = useProjectStore((s) => s.manualLabelPositions);
  const setManualLabelPosition = useProjectStore((s) => s.setManualLabelPosition);
  const resetManualLabelPosition = useProjectStore((s) => s.resetManualLabelPosition);
  const setManualClusterPosition = useProjectStore((s) => s.setManualClusterPosition);
  const resetManualClusterPosition = useProjectStore((s) => s.resetManualClusterPosition);
  const resetAllManualPositions = useProjectStore((s) => s.resetAllManualPositions);

  const [zoom, setZoom] = useState(0.95);
  const [hovered, setHovered] = useState<HoveredMutationInfo | null>(null);

  const filteredMutations = getFilteredMutations(mutations, filter, style.countMetric);
  const currentManual = manualLabelPositions[activeMode];
  const currentClusterManual = manualLabelPositions['cdna-exon-clusters'] ?? {};
  const manualCount =
    Object.keys(currentManual).length +
    (activeMode === 'cdna-exon' ? Object.keys(currentClusterManual).length : 0);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      {/* Mode Switcher & Canvas Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Mode Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveMode('protein-domain')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeMode === 'protein-domain'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Dna className="w-3.5 h-3.5" />
            <span>{t.mode1Btn}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('cdna-exon')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeMode === 'cdna-exon'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitCommitHorizontal className="w-3.5 h-3.5" />
            <span>{t.mode2Btn}</span>
          </button>
        </div>

        {/* Status & Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {t.showingLabel} <strong>{filteredMutations.length}</strong> / {mutations.length}{' '}
            {t.mutationsWord}
          </span>

          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            {t.metricLabel}{' '}
            <strong>
              {style.countMetric === 'family_count' ? t.familyCount : t.alleleCount}
            </strong>
          </span>

          {manualCount > 0 && (
            <button
              type="button"
              onClick={() => resetAllManualPositions(activeMode)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200"
              title={t.resetLayoutTitle}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t.resetLayout(manualCount)}
            </button>
          )}

          <div className="flex items-center border border-slate-200 rounded-md bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
              className="p-1.5 text-slate-600 hover:bg-slate-100"
              title={t.zoomOutTitle}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-2 py-1 text-[11px] font-mono text-slate-700 hover:bg-slate-100 border-x border-slate-200"
              title={t.zoomResetTitle}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.2, Math.round((z + 0.1) * 10) / 10))}
              className="p-1.5 text-slate-600 hover:bg-slate-100"
              title={t.zoomInTitle}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Paper Canvas */}
      <div className="flex-1 overflow-auto canvas-backdrop p-6 relative flex items-start justify-center">
        <div
          className="bg-white rounded-lg shadow-lg border border-slate-300/80 origin-top transition-transform duration-100"
          style={{
            transform: `scale(${zoom})`,
            width: style.width,
            height: style.height,
          }}
        >
          {activeMode === 'protein-domain' ? (
            <ProteinDomainChart
              svgRef={svgRef}
              gene={gene}
              mutations={filteredMutations}
              style={style}
              manualPositions={currentManual}
              onCommitLabelPosition={(id, coord) =>
                setManualLabelPosition('protein-domain', id, coord)
              }
              onResetLabelPosition={(id) =>
                resetManualLabelPosition('protein-domain', id)
              }
              onHoverMutation={setHovered}
            />
          ) : (
            <CdnaExonChart
              svgRef={svgRef}
              gene={gene}
              mutations={filteredMutations}
              style={style}
              manualPositions={currentManual}
              manualClusterPositions={currentClusterManual}
              onCommitLabelPosition={(id, coord) =>
                setManualLabelPosition('cdna-exon', id, coord)
              }
              onResetLabelPosition={(id) => resetManualLabelPosition('cdna-exon', id)}
              onCommitClusterPosition={(id, coord) =>
                setManualClusterPosition(id, coord)
              }
              onResetClusterPosition={(id) => resetManualClusterPosition(id)}
              onHoverMutation={setHovered}
            />
          )}
        </div>

        {/* Bottom-left subtle drag instruction pill */}
        <div className="fixed bottom-4 left-4 pointer-events-none bg-slate-900/80 backdrop-blur text-white text-[11px] px-3 py-1.5 rounded-full shadow flex items-center gap-1.5 z-10">
          <Info className="w-3.5 h-3.5 text-indigo-300" />
          <span>
            {activeMode === 'cdna-exon' ? t.dragHintMode2 : t.dragHintMode1}
          </span>
        </div>

        {/* Floating Hover Tooltip */}
        {hovered && (
          <div
            className="fixed z-40 pointer-events-none bg-slate-900/95 text-white rounded-lg shadow-xl border border-slate-700 px-3 py-2 text-xs max-w-xs"
            style={{
              left: Math.min(window.innerWidth - 260, hovered.clientX + 14),
              top: Math.min(window.innerHeight - 150, hovered.clientY + 14),
            }}
          >
            <div className="font-bold text-indigo-300 font-mono">
              {hovered.mutation.protein_change || hovered.mutation.cDNA_change}
            </div>
            {hovered.mutation.cDNA_change && (
              <div className="text-[11px] text-slate-300 font-mono">
                cDNA: {hovered.mutation.cDNA_change}
              </div>
            )}
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-slate-400">{t.ttType}</span>
              <span className="font-medium">{hovered.mutation.mutation_type}</span>
              <span className="text-slate-400">{t.ttPosition}</span>
              <span>
                {hovered.mutation.position_aa ?? '?'} aa / {hovered.mutation.position_bp ?? '?'} bp
              </span>
              <span className="text-slate-400">{t.ttFamilyAllele}</span>
              <span className="font-semibold text-emerald-300">
                {t.ttFamilyAlleleVal(
                  hovered.mutation.patient_or_allele_count.family_count,
                  hovered.mutation.patient_or_allele_count.allele_count,
                )}
              </span>
              <span className="text-slate-400">{t.ttPhenotype}</span>
              <span>{hovered.mutation.phenotype_or_type}</span>
              {hovered.mutation.exon && (
                <>
                  <span className="text-slate-400">{t.ttExon}</span>
                  <span>{hovered.mutation.exon}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
