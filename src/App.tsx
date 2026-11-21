import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChartWorkspace } from './components/ChartWorkspace';
import { DataInputPanel } from './components/DataInputPanel';
import { ExportModal } from './components/ExportModal';
import { GeneStructureEditor } from './components/GeneStructureEditor';
import { HeaderBar } from './components/HeaderBar';
import { MutationDataGrid } from './components/MutationDataGrid';
import { SettingsModal } from './components/SettingsModal';
import { StyleFilterSidebar } from './components/StyleFilterSidebar';
import { openTextFile, saveTextFile } from './services/platform';
import { useProjectStore } from './store/useProjectStore';
import { ProjectFileSchema } from './types/schema';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

export const App: React.FC = () => {
  const activeTab = useProjectStore((s) => s.activeTab);
  const gene = useProjectStore((s) => s.geneStructure);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const toProjectFile = useProjectStore((s) => s.toProjectFile);
  const loadProjectFile = useProjectStore((s) => s.loadProjectFile);
  const loadAISettingsFromDisk = useProjectStore((s) => s.loadAISettingsFromDisk);

  const svgRef = useRef<SVGSVGElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ message, type });
    },
    [],
  );

  useEffect(() => {
    void loadAISettingsFromDisk();
  }, [loadAISettingsFromDisk]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSaveProject = useCallback(async () => {
    const project = toProjectFile();
    const res = await saveTextFile({
      defaultPath: `${gene.geneSymbol || 'mutmap'}_projesi.json`,
      filters: [{ name: 'MutMap Projesi (.json)', extensions: ['json'] }],
      content: JSON.stringify(project, null, 2),
      mimeType: 'application/json',
    });
    if (!res.canceled) {
      notify('Proje (.json) başarıyla kaydedildi.', 'success');
    }
  }, [toProjectFile, gene.geneSymbol, notify]);

  const handleOpenProject = useCallback(async () => {
    const res = await openTextFile({
      filters: [{ name: 'MutMap Projesi (.json)', extensions: ['json'] }],
    });
    if (res.canceled || !res.content) return;
    try {
      const raw = JSON.parse(res.content);
      const parsed = ProjectFileSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          parsed.error.issues[0]?.message ?? 'Geçersiz MutMap proje dosyası şeması.',
        );
      }
      loadProjectFile(parsed.data);
      notify(
        `Proje yüklendi: ${parsed.data.metadata.projectName} (${parsed.data.mutations.length} mutasyon)`,
        'success',
      );
    } catch (err) {
      notify(
        `Proje açma hatası: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }, [loadProjectFile, notify]);

  // Global keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+S)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSaveProject();
        return;
      }

      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveProject, undo, redo]);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 overflow-hidden">
      <HeaderBar
        onOpenProject={() => void handleOpenProject()}
        onSaveProject={() => void handleSaveProject()}
        onOpenExport={() => setExportOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'data' && (
          <div className="h-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
            <div className="lg:col-span-5 h-full min-h-0">
              <DataInputPanel
                onOpenSettings={() => setSettingsOpen(true)}
                onNotify={notify}
              />
            </div>
            <div className="lg:col-span-7 h-full min-h-0">
              <MutationDataGrid onNotify={notify} />
            </div>
          </div>
        )}

        {activeTab === 'gene' && <GeneStructureEditor onNotify={notify} />}

        {activeTab === 'chart' && (
          <div className="h-full flex overflow-hidden">
            <ChartWorkspace svgRef={svgRef} />
            <StyleFilterSidebar />
          </div>
        )}
      </main>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        svgRef={svgRef}
        onNotify={notify}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onNotify={notify}
      />

      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium text-white border transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 border-emerald-700'
              : toast.type === 'error'
                ? 'bg-red-600 border-red-700'
                : 'bg-slate-800 border-slate-900'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default App;
