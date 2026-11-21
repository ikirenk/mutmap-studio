import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  FileDown,
  FileUp,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useT } from '../i18n/translations';
import { normalizeMutationRecord } from '../services/ai/parser';
import { openTextFile, saveTextFile } from '../services/platform';
import { useProjectStore } from '../store/useProjectStore';
import {
  MUTATION_TYPES,
  MutationRecord,
  MutationType,
} from '../types/schema';

export interface MutationDataGridProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type SortKey = 'position_aa' | 'position_bp' | 'family_count' | 'allele_count' | 'mutation_type';

export const MutationDataGrid: React.FC<MutationDataGridProps> = ({ onNotify }) => {
  const { t } = useT();
  const mutations = useProjectStore((s) => s.mutations);
  const gene = useProjectStore((s) => s.geneStructure);
  const addEmptyMutation = useProjectStore((s) => s.addEmptyMutation);
  const updateMutation = useProjectStore((s) => s.updateMutation);
  const removeMutation = useProjectStore((s) => s.removeMutation);
  const removeMutationsBulk = useProjectStore((s) => s.removeMutationsBulk);
  const setMutations = useProjectStore((s) => s.setMutations);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('position_aa');
  const [sortAsc, setSortAsc] = useState(true);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? mutations.filter((m) =>
          `${m.cDNA_change} ${m.protein_change} ${m.exon ?? ''} ${m.mutation_type} ${m.phenotype_or_type}`
            .toLowerCase()
            .includes(q),
        )
      : [...mutations];

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'position_aa':
          cmp = (a.position_aa ?? 999999) - (b.position_aa ?? 999999);
          break;
        case 'position_bp':
          cmp = (a.position_bp ?? 999999) - (b.position_bp ?? 999999);
          break;
        case 'family_count':
          cmp = a.patient_or_allele_count.family_count - b.patient_or_allele_count.family_count;
          break;
        case 'allele_count':
          cmp = a.patient_or_allele_count.allele_count - b.patient_or_allele_count.allele_count;
          break;
        case 'mutation_type':
          cmp = a.mutation_type.localeCompare(b.mutation_type);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [mutations, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSorted.length && filteredAndSorted.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSorted.map((m) => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    removeMutationsBulk(Array.from(selectedIds));
    onNotify(t.bulkDeletedMsg(selectedIds.size), 'info');
    setSelectedIds(new Set());
  };

  const handleExportJson = async () => {
    const res = await saveTextFile({
      defaultPath: `${gene.geneSymbol || 'mutations'}_data.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
      content: JSON.stringify(mutations, null, 2),
      mimeType: 'application/json',
    });
    if (!res.canceled) {
      onNotify(t.exportedJsonMsg, 'success');
    }
  };

  const handleExportCsv = async () => {
    const header = [
      'Exon',
      'cDNA_change',
      'protein_change',
      'position_aa',
      'position_bp',
      'mutation_type',
      'family_count',
      'allele_count',
      'phenotype_or_type',
    ].join(',');
    const rows = mutations.map((m) =>
      [
        m.exon ?? '',
        m.cDNA_change,
        m.protein_change,
        m.position_aa ?? '',
        m.position_bp ?? '',
        m.mutation_type,
        m.patient_or_allele_count.family_count,
        m.patient_or_allele_count.allele_count,
        m.phenotype_or_type,
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    );
    const res = await saveTextFile({
      defaultPath: `${gene.geneSymbol || 'mutations'}_data.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      content: [header, ...rows].join('\n'),
      mimeType: 'text/csv;charset=utf-8',
    });
    if (!res.canceled) {
      onNotify(t.exportedCsvMsg, 'success');
    }
  };

  const handleImportJson = async () => {
    const res = await openTextFile({
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.content) return;
    try {
      const parsed = JSON.parse(res.content);
      const arr = Array.isArray(parsed) ? parsed : parsed?.mutations;
      if (!Array.isArray(arr)) {
        throw new Error('JSON file does not contain a mutations array.');
      }
      const normalized = arr.map((item, idx) => normalizeMutationRecord(item, idx));
      setMutations(normalized);
      onNotify(t.importedJsonMsg(normalized.length), 'success');
    } catch (err) {
      onNotify(
        t.importJsonErr(err instanceof Error ? err.message : String(err)),
        'error',
      );
    }
  };

  const getRowWarning = (m: MutationRecord): string | null => {
    if (m.position_aa === null && m.position_bp === null) {
      return t.warnMissingPos;
    }
    if (m.position_aa !== null && m.position_aa > gene.proteinLengthAa) {
      return t.warnAaOutOfRange(m.position_aa, gene.proteinLengthAa);
    }
    if (m.position_bp !== null && m.position_bp > gene.cdnaLengthBp) {
      return t.warnBpOutOfRange(m.position_bp, gene.cdnaLengthBp);
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {t.gridTitle(mutations.length)}
          </h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.gridSearchPlaceholder}
              className="pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:border-indigo-500 w-52"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.deleteSelected(selectedIds.size)}
            </button>
          )}

          <button
            type="button"
            onClick={addEmptyMutation}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.addRow}
          </button>

          <button
            type="button"
            onClick={handleImportJson}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300"
          >
            <FileUp className="w-3.5 h-3.5" />
            {t.importJson}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300"
          >
            <FileDown className="w-3.5 h-3.5" />
            CSV
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300"
          >
            <FileDown className="w-3.5 h-3.5" />
            JSON
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {t.goToChart}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="p-2 w-8 text-center">
                <input
                  type="checkbox"
                  checked={
                    filteredAndSorted.length > 0 &&
                    selectedIds.size === filteredAndSorted.length
                  }
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-2 w-7 text-center" title={t.colStatusTitle}>
                !
              </th>
              <th className="p-2 w-16">{t.colExon}</th>
              <th className="p-2 min-w-[130px]">{t.colCdna}</th>
              <th className="p-2 min-w-[135px]">{t.colProtein}</th>
              <th
                className="p-2 w-20 cursor-pointer hover:text-indigo-700"
                onClick={() => toggleSort('position_aa')}
              >
                <span className="inline-flex items-center gap-1">
                  {t.colAaPos}
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th
                className="p-2 w-20 cursor-pointer hover:text-indigo-700"
                onClick={() => toggleSort('position_bp')}
              >
                <span className="inline-flex items-center gap-1">
                  {t.colBpPos}
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th
                className="p-2 w-32 cursor-pointer hover:text-indigo-700"
                onClick={() => toggleSort('mutation_type')}
              >
                <span className="inline-flex items-center gap-1">
                  {t.colMutType}
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th
                className="p-2 w-16 cursor-pointer hover:text-indigo-700"
                onClick={() => toggleSort('family_count')}
              >
                {t.colFamily}
              </th>
              <th
                className="p-2 w-16 cursor-pointer hover:text-indigo-700"
                onClick={() => toggleSort('allele_count')}
              >
                {t.colAllele}
              </th>
              <th className="p-2 min-w-[100px]">{t.colPhenotype}</th>
              <th className="p-2 w-24">{t.colSide}</th>
              <th className="p-2 w-10 text-center">{t.colDelete}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAndSorted.map((m) => {
              const warning = getRowWarning(m);
              return (
                <tr
                  key={m.id}
                  className={`hover:bg-indigo-50/30 ${
                    selectedIds.has(m.id) ? 'bg-indigo-50/50' : ''
                  }`}
                >
                  <td className="p-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    {warning ? (
                      <span title={warning} className="inline-flex text-amber-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={m.exon ?? ''}
                      onChange={(e) =>
                        updateMutation(m.id, { exon: e.target.value || null })
                      }
                      className="grid-cell-input font-mono"
                      placeholder="Ex-8"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={m.cDNA_change}
                      onChange={(e) =>
                        updateMutation(m.id, { cDNA_change: e.target.value })
                      }
                      className="grid-cell-input font-mono"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={m.protein_change}
                      onChange={(e) =>
                        updateMutation(m.id, { protein_change: e.target.value })
                      }
                      className="grid-cell-input font-mono"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={1}
                      value={m.position_aa ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        updateMutation(m.id, {
                          position_aa: v !== null && Number.isFinite(v) ? v : null,
                        });
                      }}
                      className="grid-cell-input font-mono"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={1}
                      value={m.position_bp ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        updateMutation(m.id, {
                          position_bp: v !== null && Number.isFinite(v) ? v : null,
                        });
                      }}
                      className="grid-cell-input font-mono"
                    />
                  </td>
                  <td className="p-1">
                    <select
                      value={m.mutation_type}
                      onChange={(e) =>
                        updateMutation(m.id, {
                          mutation_type: e.target.value as MutationType,
                        })
                      }
                      className="grid-cell-input bg-white"
                    >
                      {MUTATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      value={m.patient_or_allele_count.family_count}
                      onChange={(e) => {
                        const n = Math.max(0, parseInt(e.target.value || '0', 10));
                        updateMutation(m.id, {
                          patient_or_allele_count: {
                            ...m.patient_or_allele_count,
                            family_count: Number.isFinite(n) ? n : 0,
                          },
                        });
                      }}
                      className="grid-cell-input font-mono"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      value={m.patient_or_allele_count.allele_count}
                      onChange={(e) => {
                        const n = Math.max(0, parseInt(e.target.value || '0', 10));
                        updateMutation(m.id, {
                          patient_or_allele_count: {
                            ...m.patient_or_allele_count,
                            allele_count: Number.isFinite(n) ? n : 0,
                          },
                        });
                      }}
                      className="grid-cell-input font-mono"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={m.phenotype_or_type}
                      onChange={(e) =>
                        updateMutation(m.id, { phenotype_or_type: e.target.value })
                      }
                      className="grid-cell-input"
                    />
                  </td>
                  <td className="p-1">
                    <select
                      value={m.side_override ?? 'auto'}
                      onChange={(e) =>
                        updateMutation(m.id, {
                          side_override: e.target.value as 'auto' | 'top' | 'bottom',
                        })
                      }
                      className="grid-cell-input bg-white"
                    >
                      <option value="auto">{t.sideAuto}</option>
                      <option value="top">{t.sideTop}</option>
                      <option value="bottom">{t.sideBottom}</option>
                    </select>
                  </td>
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeMutation(m.id)}
                      title={t.colDelete}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={13} className="p-8 text-center text-slate-400 text-xs">
                  {t.gridEmpty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
