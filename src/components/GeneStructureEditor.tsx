import React, { useState } from 'react';
import {
  AlertCircle,
  CloudDownload,
  Dna,
  FileDown,
  FileUp,
  Layers,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useT } from '../i18n/translations';
import { fetchGeneStructureFromApis } from '../services/bio/geneFetcher';
import { openTextFile, saveTextFile } from '../services/platform';
import { useProjectStore } from '../store/useProjectStore';
import { ExonRegion, ProteinDomain } from '../types/schema';

export interface GeneStructureEditorProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GeneStructureEditor: React.FC<GeneStructureEditorProps> = ({ onNotify }) => {
  const { t } = useT();
  const gene = useProjectStore((s) => s.geneStructure);
  const updateGeneMeta = useProjectStore((s) => s.updateGeneMeta);
  const setGeneStructure = useProjectStore((s) => s.setGeneStructure);
  const addDomain = useProjectStore((s) => s.addDomain);
  const updateDomain = useProjectStore((s) => s.updateDomain);
  const removeDomain = useProjectStore((s) => s.removeDomain);
  const importDomains = useProjectStore((s) => s.importDomains);
  const addExon = useProjectStore((s) => s.addExon);
  const updateExon = useProjectStore((s) => s.updateExon);
  const removeExon = useProjectStore((s) => s.removeExon);
  const importExons = useProjectStore((s) => s.importExons);

  const [lookupSymbol, setLookupSymbol] = useState(gene.geneSymbol);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchWarnings, setFetchWarnings] = useState<string[]>([]);

  const handleFetchApi = async () => {
    setIsFetching(true);
    setFetchError(null);
    setFetchWarnings([]);
    try {
      const result = await fetchGeneStructureFromApis(lookupSymbol);
      const merged = {
        ...gene,
        ...result.geneStructure,
        domains: result.geneStructure.domains ?? gene.domains,
        exons: result.geneStructure.exons ?? gene.exons,
      };
      setGeneStructure(merged);
      setFetchWarnings(result.warnings);
      onNotify(
        t.geneFetchedMsg(merged.geneSymbol, merged.domains.length, merged.exons.length),
        'success',
      );
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsFetching(false);
    }
  };

  const handleImportDomains = async () => {
    const res = await openTextFile({
      filters: [{ name: 'JSON / CSV', extensions: ['json', 'csv', 'tsv'] }],
    });
    if (res.canceled || !res.content) return;
    try {
      const text = res.content.trim();
      if (text.startsWith('[') || text.startsWith('{')) {
        const raw = JSON.parse(text);
        const arr = Array.isArray(raw) ? raw : raw.domains;
        if (!Array.isArray(arr)) throw new Error('Domains array not found.');
        const domains: ProteinDomain[] = arr.map((d, i) => ({
          id: d.id || `dom-imp-${i + 1}`,
          name: String(d.name || `Domain ${i + 1}`),
          shortName: d.shortName ? String(d.shortName) : undefined,
          start: Math.max(1, Number(d.start) || 1),
          end: Math.max(1, Number(d.end) || 1),
          color: String(d.color || '#3b82f6'),
          description: d.description ? String(d.description) : undefined,
        }));
        importDomains(domains);
        onNotify(t.domainsImportedMsg(domains.length), 'success');
      } else {
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const domains: ProteinDomain[] = [];
        lines.forEach((line, idx) => {
          const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
          if (idx === 0 && /name|isim|start/i.test(cols[0])) return;
          if (cols.length >= 3) {
            domains.push({
              id: `dom-csv-${idx + 1}`,
              name: cols[0],
              start: Math.max(1, parseInt(cols[1], 10) || 1),
              end: Math.max(1, parseInt(cols[2], 10) || 1),
              color: cols[3] && /^#/.test(cols[3]) ? cols[3] : '#3b82f6',
              shortName: cols[4] || undefined,
            });
          }
        });
        importDomains(domains);
        onNotify(t.domainsImportedMsg(domains.length), 'success');
      }
    } catch (err) {
      onNotify(
        t.importJsonErr(err instanceof Error ? err.message : String(err)),
        'error',
      );
    }
  };

  const handleImportExons = async () => {
    const res = await openTextFile({
      filters: [{ name: 'JSON / CSV', extensions: ['json', 'csv', 'tsv'] }],
    });
    if (res.canceled || !res.content) return;
    try {
      const text = res.content.trim();
      if (text.startsWith('[') || text.startsWith('{')) {
        const raw = JSON.parse(text);
        const arr = Array.isArray(raw) ? raw : raw.exons;
        if (!Array.isArray(arr)) throw new Error('Exons array not found.');
        const exons: ExonRegion[] = arr.map((e, i) => ({
          id: e.id || `ex-imp-${i + 1}`,
          name: String(e.name || `Ex-${i + 1}`),
          exonNumber: Number(e.exonNumber) || i + 1,
          startBp: Math.max(1, Number(e.startBp ?? e.start) || 1),
          endBp: Math.max(1, Number(e.endBp ?? e.end) || 1),
          color: String(e.color || (i % 2 === 0 ? '#dbeafe' : '#bfdbfe')),
          isCoding: e.isCoding ?? true,
        }));
        importExons(exons);
        onNotify(t.exonsImportedMsg(exons.length), 'success');
      } else {
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const exons: ExonRegion[] = [];
        lines.forEach((line, idx) => {
          const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
          if (idx === 0 && /name|exon|start/i.test(cols[0])) return;
          if (cols.length >= 3) {
            exons.push({
              id: `ex-csv-${idx + 1}`,
              name: cols[0],
              exonNumber: exons.length + 1,
              startBp: Math.max(1, parseInt(cols[1], 10) || 1),
              endBp: Math.max(1, parseInt(cols[2], 10) || 1),
              color:
                cols[3] && /^#/.test(cols[3])
                  ? cols[3]
                  : exons.length % 2 === 0
                    ? '#dbeafe'
                    : '#bfdbfe',
              isCoding: true,
            });
          }
        });
        importExons(exons);
        onNotify(t.exonsImportedMsg(exons.length), 'success');
      }
    } catch (err) {
      onNotify(
        t.importJsonErr(err instanceof Error ? err.message : String(err)),
        'error',
      );
    }
  };

  const handleExportGeneJson = async () => {
    const res = await saveTextFile({
      defaultPath: `${gene.geneSymbol || 'gene'}_structure.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
      content: JSON.stringify(gene, null, 2),
      mimeType: 'application/json',
    });
    if (!res.canceled) {
      onNotify(t.geneExportedMsg, 'success');
    }
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Top Meta & UniProt / Ensembl Fetch Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Dna className="w-4 h-4 text-indigo-600" />
              {t.geneTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{t.geneSubtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={lookupSymbol}
              onChange={(e) => setLookupSymbol(e.target.value.toUpperCase())}
              placeholder={t.genePlaceholder}
              className="px-3 py-1.5 text-xs font-semibold uppercase border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 w-44"
            />
            <button
              type="button"
              onClick={handleFetchApi}
              disabled={isFetching || !lookupSymbol.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
            >
              {isFetching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudDownload className="w-3.5 h-3.5" />
              )}
              {t.fetchUniProtEnsembl}
            </button>
            <button
              type="button"
              onClick={handleExportGeneJson}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200"
            >
              <FileDown className="w-3.5 h-3.5" />
              {t.exportStructure}
            </button>
          </div>
        </div>

        {fetchError && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{fetchError}</span>
          </div>
        )}
        {fetchWarnings.length > 0 && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            {fetchWarnings.join(' · ')}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              {t.geneSymbolLabel}
            </label>
            <input
              type="text"
              value={gene.geneSymbol}
              onChange={(e) => updateGeneMeta({ geneSymbol: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              {t.proteinNameLabel}
            </label>
            <input
              type="text"
              value={gene.proteinName}
              onChange={(e) => updateGeneMeta({ proteinName: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              {t.proteinLengthLabel}
            </label>
            <input
              type="number"
              min={1}
              value={gene.proteinLengthAa}
              onChange={(e) =>
                updateGeneMeta({
                  proteinLengthAa: Math.max(1, parseInt(e.target.value || '1', 10)),
                })
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              {t.cdnaLengthLabel}
            </label>
            <input
              type="number"
              min={1}
              value={gene.cdnaLengthBp}
              onChange={(e) =>
                updateGeneMeta({
                  cdnaLengthBp: Math.max(1, parseInt(e.target.value || '1', 10)),
                })
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              UniProt / Ensembl ID
            </label>
            <input
              type="text"
              value={gene.uniprotId || gene.ensemblTranscriptId || ''}
              onChange={(e) => updateGeneMeta({ uniprotId: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
              placeholder="P05107"
            />
          </div>
        </div>
      </div>

      {/* Domains and Exons side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Domains Editor */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                {t.domainsTitle(gene.domains.length)}
              </h3>
              <p className="text-[11px] text-slate-500">{t.domainsSubtitle}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleImportDomains}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100"
              >
                <FileUp className="w-3.5 h-3.5" />
                JSON/CSV
              </button>
              <button
                type="button"
                onClick={() => addDomain()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addDomain}
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-[11px] text-slate-600 uppercase">
                <tr>
                  <th className="p-2">{t.domainNameCol}</th>
                  <th className="p-2 w-24">{t.domainShortCol}</th>
                  <th className="p-2 w-20">{t.startCol}</th>
                  <th className="p-2 w-20">{t.endCol}</th>
                  <th className="p-2 w-14 text-center">{t.colorCol}</th>
                  <th className="p-2 w-10 text-center">{t.colDelete}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gene.domains.map((dom) => (
                  <tr key={dom.id} className="hover:bg-slate-50">
                    <td className="p-1">
                      <input
                        type="text"
                        value={dom.name}
                        onChange={(e) => updateDomain(dom.id, { name: e.target.value })}
                        className="grid-cell-input font-medium"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={dom.shortName ?? ''}
                        onChange={(e) => updateDomain(dom.id, { shortName: e.target.value })}
                        className="grid-cell-input"
                        placeholder={t.domainShortCol}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        min={1}
                        value={dom.start}
                        onChange={(e) =>
                          updateDomain(dom.id, {
                            start: Math.max(1, parseInt(e.target.value || '1', 10)),
                          })
                        }
                        className="grid-cell-input font-mono"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        min={1}
                        value={dom.end}
                        onChange={(e) =>
                          updateDomain(dom.id, {
                            end: Math.max(1, parseInt(e.target.value || '1', 10)),
                          })
                        }
                        className="grid-cell-input font-mono"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <input
                        type="color"
                        value={dom.color}
                        onChange={(e) => updateDomain(dom.id, { color: e.target.value })}
                        className="w-7 h-6 rounded border border-slate-300 cursor-pointer p-0"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeDomain(dom.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {gene.domains.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      {t.noDomains}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Exons Editor */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Dna className="w-4 h-4 text-emerald-600" />
                {t.exonsTitle(gene.exons.length)}
              </h3>
              <p className="text-[11px] text-slate-500">{t.exonsSubtitle}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleImportExons}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100"
              >
                <FileUp className="w-3.5 h-3.5" />
                JSON/CSV
              </button>
              <button
                type="button"
                onClick={() => addExon()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addExon}
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-[11px] text-slate-600 uppercase">
                <tr>
                  <th className="p-2">{t.exonNameCol}</th>
                  <th className="p-2 w-20">{t.exonNoCol}</th>
                  <th className="p-2 w-24">{t.startBpCol}</th>
                  <th className="p-2 w-24">{t.endBpCol}</th>
                  <th className="p-2 w-14 text-center">{t.colorCol}</th>
                  <th className="p-2 w-10 text-center">{t.colDelete}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gene.exons.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="p-1">
                      <input
                        type="text"
                        value={ex.name}
                        onChange={(e) => updateExon(ex.id, { name: e.target.value })}
                        className="grid-cell-input font-medium"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        min={1}
                        value={ex.exonNumber}
                        onChange={(e) =>
                          updateExon(ex.id, {
                            exonNumber: Math.max(1, parseInt(e.target.value || '1', 10)),
                          })
                        }
                        className="grid-cell-input font-mono"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        min={1}
                        value={ex.startBp}
                        onChange={(e) =>
                          updateExon(ex.id, {
                            startBp: Math.max(1, parseInt(e.target.value || '1', 10)),
                          })
                        }
                        className="grid-cell-input font-mono"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        min={1}
                        value={ex.endBp}
                        onChange={(e) =>
                          updateExon(ex.id, {
                            endBp: Math.max(1, parseInt(e.target.value || '1', 10)),
                          })
                        }
                        className="grid-cell-input font-mono"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <input
                        type="color"
                        value={ex.color}
                        onChange={(e) => updateExon(ex.id, { color: e.target.value })}
                        className="w-7 h-6 rounded border border-slate-300 cursor-pointer p-0"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeExon(ex.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {gene.exons.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      {t.noExons}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
