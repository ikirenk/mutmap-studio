import React from 'react';
import {
  BarChart3,
  Dna,
  Download,
  FilePlus2,
  FolderOpen,
  Redo2,
  Save,
  Settings,
  Sparkles,
  Table2,
  Undo2,
} from 'lucide-react';
import { AppTab, useProjectStore } from '../store/useProjectStore';

export interface HeaderBarProps {
  onOpenProject: () => void;
  onSaveProject: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
}

const TABS: Array<{ id: AppTab; label: string; icon: React.ReactNode }> = [
  { id: 'data', label: '1. Veri Girişi & Tablo', icon: <Table2 className="w-4 h-4" /> },
  { id: 'gene', label: '2. Gen / Protein Yapısı', icon: <Dna className="w-4 h-4" /> },
  { id: 'chart', label: '3. Grafik Stüdyosu', icon: <BarChart3 className="w-4 h-4" /> },
];

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onOpenProject,
  onSaveProject,
  onOpenExport,
  onOpenSettings,
}) => {
  const activeTab = useProjectStore((s) => s.activeTab);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const gene = useProjectStore((s) => s.geneStructure);
  const mutationCount = useProjectStore((s) => s.mutations.length);
  const undoStack = useProjectStore((s) => s.undoStack);
  const redoStack = useProjectStore((s) => s.redoStack);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const newEmptyProject = useProjectStore((s) => s.newEmptyProject);
  const loadSampleProject = useProjectStore((s) => s.loadSampleProject);

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-sm z-20">
      {/* Left: Brand & Gene Badge */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
          <Dna className="w-5 h-5" />
        </div>
        <div className="leading-tight">
          <div className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
            MutMap Studio
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              v1.0
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{gene.geneSymbol}</span>
            {' · '}
            {gene.proteinLengthAa} aa / {gene.cdnaLengthBp} bp · {mutationCount} mutasyon
          </div>
        </div>
      </div>

      {/* Center: Workflow Stepper Tabs */}
      <nav className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center border-r border-slate-200 pr-2 mr-1 gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Etiket Konumunu Geri Al (Ctrl+Z)"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Etiket Konumunu Yinele (Ctrl+Shift+Z)"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={newEmptyProject}
          title="Yeni Boş Proje"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Yeni</span>
        </button>

        <button
          type="button"
          onClick={loadSampleProject}
          title="Örnek ITGB2 / LAD-I Verisini Yükle"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Örnek Veri</span>
        </button>

        <button
          type="button"
          onClick={onOpenProject}
          title="Proje Dosyası Aç (.json)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Aç</span>
        </button>

        <button
          type="button"
          onClick={onSaveProject}
          title="Projeyi Kaydet (.json) (Ctrl+S)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Kaydet</span>
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Dışa Aktar</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Yapay Zeka (API) Ayarları"
          className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
