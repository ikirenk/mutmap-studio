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
import { useT } from '../i18n/translations';
import { AppTab, useProjectStore } from '../store/useProjectStore';

export interface HeaderBarProps {
  onOpenProject: () => void;
  onSaveProject: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onOpenProject,
  onSaveProject,
  onOpenExport,
  onOpenSettings,
}) => {
  const { lang, t } = useT();
  const setLanguage = useProjectStore((s) => s.setLanguage);
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

  const tabs: Array<{ id: AppTab; label: string; icon: React.ReactNode }> = [
    { id: 'data', label: t.tabData, icon: <Table2 className="w-4 h-4" /> },
    { id: 'gene', label: t.tabGene, icon: <Dna className="w-4 h-4" /> },
    { id: 'chart', label: t.tabChart, icon: <BarChart3 className="w-4 h-4" /> },
  ];

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
            {gene.proteinLengthAa} aa / {gene.cdnaLengthBp} bp · {mutationCount}{' '}
            {t.mutationsWord}
          </div>
        </div>
      </div>

      {/* Center: Workflow Stepper Tabs */}
      <nav className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
        {tabs.map((tab) => {
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

      {/* Right: Actions & Language Switcher */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center border-r border-slate-200 pr-2 mr-1 gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            title={t.undoTitle}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            title={t.redoTitle}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={newEmptyProject}
          title={t.newProjectTitle}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">{t.newProject}</span>
        </button>

        <button
          type="button"
          onClick={loadSampleProject}
          title={t.sampleDataTitle}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">{t.sampleData}</span>
        </button>

        <button
          type="button"
          onClick={onOpenProject}
          title={t.openTitle}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{t.open}</span>
        </button>

        <button
          type="button"
          onClick={onSaveProject}
          title={t.saveTitle}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{t.save}</span>
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t.exportBtn}</span>
        </button>

        {/* TR / EN Language Switcher */}
        <div
          className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-[11px] font-semibold"
          title="Dil / Language"
        >
          <button
            type="button"
            onClick={() => setLanguage('tr')}
            className={`px-1.5 py-1 rounded transition-colors ${
              lang === 'tr'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            TR
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-1.5 py-1 rounded transition-colors ${
              lang === 'en'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            EN
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          title={t.aiSettingsTitle}
          className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
