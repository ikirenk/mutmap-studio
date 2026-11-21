import { create } from 'zustand';
import { createSampleProject } from '../data/sampleITGB2';
import {
  AISettings,
  DEFAULT_AI_SETTINGS,
  ExonRegion,
  FilterConfig,
  GeneStructure,
  LabelCoord,
  MUTATION_TYPES,
  ManualLabelPositions,
  MutationRecord,
  MutationType,
  MutationTypeStyle,
  ProjectFile,
  ProteinDomain,
  STYLE_PRESETS,
  StyleConfig,
  VisualizationMode,
  createDefaultFilterConfig,
  createDefaultStyleConfig,
} from '../types/schema';
import { loadPersistedSettings, savePersistedSettings } from '../services/platform';
import type { AppLanguage } from '../i18n/translations';

export type AppTab = 'data' | 'gene' | 'chart';

const LANG_STORAGE_KEY = 'mutmap_studio_lang_v1';

function getInitialLanguage(): AppLanguage {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'tr') return saved;
    } catch {
      // ignore storage errors
    }
  }
  return 'tr';
}

const MAX_UNDO_HISTORY = 50;

export function getUniquePhenotypes(mutations: MutationRecord[]): string[] {
  return Array.from(
    new Set(mutations.map((m) => m.phenotype_or_type.trim() || 'Belirtilmemiş')),
  );
}

export function getFilteredMutations(
  mutations: MutationRecord[],
  filter: FilterConfig,
  countMetric: 'family_count' | 'allele_count',
): MutationRecord[] {
  const q = filter.searchQuery.trim().toLowerCase();
  const hasPhenotypeFilter = filter.enabledPhenotypes.length > 0;
  const phenoSet = new Set(filter.enabledPhenotypes);

  return mutations.filter((m) => {
    if (!filter.enabledTypes[m.mutation_type]) return false;

    const pheno = m.phenotype_or_type.trim() || 'Belirtilmemiş';
    if (hasPhenotypeFilter && !phenoSet.has(pheno)) return false;

    const count =
      countMetric === 'family_count'
        ? m.patient_or_allele_count.family_count
        : m.patient_or_allele_count.allele_count;
    if (count < filter.minCount) return false;

    if (filter.minPosition !== null && (m.position_aa ?? 0) < filter.minPosition) {
      return false;
    }
    if (filter.maxPosition !== null && (m.position_aa ?? Infinity) > filter.maxPosition) {
      return false;
    }

    if (q) {
      const hay = `${m.cDNA_change} ${m.protein_change} ${m.phenotype_or_type} ${m.exon ?? ''} ${m.mutation_type}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

interface ProjectState {
  language: AppLanguage;
  activeTab: AppTab;
  projectName: string;
  createdAt: string;
  notes: string;
  rawInputText: string;
  geneStructure: GeneStructure;
  mutations: MutationRecord[];
  activeMode: VisualizationMode;
  style: StyleConfig;
  filter: FilterConfig;
  manualLabelPositions: ManualLabelPositions;
  undoStack: ManualLabelPositions[];
  redoStack: ManualLabelPositions[];
  aiSettings: AISettings;

  setLanguage: (lang: AppLanguage) => void;
  setActiveTab: (tab: AppTab) => void;
  setProjectName: (name: string) => void;
  setRawInputText: (text: string) => void;

  // Gene structure CRUD
  setGeneStructure: (gene: GeneStructure) => void;
  updateGeneMeta: (patch: Partial<Omit<GeneStructure, 'domains' | 'exons'>>) => void;
  addDomain: (domain?: Partial<ProteinDomain>) => void;
  updateDomain: (id: string, patch: Partial<ProteinDomain>) => void;
  removeDomain: (id: string) => void;
  importDomains: (domains: ProteinDomain[]) => void;
  addExon: (exon?: Partial<ExonRegion>) => void;
  updateExon: (id: string, patch: Partial<ExonRegion>) => void;
  removeExon: (id: string) => void;
  importExons: (exons: ExonRegion[]) => void;

  // Mutations CRUD
  setMutations: (mutations: MutationRecord[]) => void;
  appendMutations: (mutations: MutationRecord[]) => void;
  addEmptyMutation: () => void;
  updateMutation: (id: string, patch: Partial<MutationRecord>) => void;
  removeMutation: (id: string) => void;
  removeMutationsBulk: (ids: string[]) => void;

  // Visualization, style & filter
  setActiveMode: (mode: VisualizationMode) => void;
  updateStyle: (patch: Partial<StyleConfig>) => void;
  updateMutationStyle: (type: MutationType, patch: Partial<MutationTypeStyle>) => void;
  applyStylePreset: (presetId: string) => void;
  updateFilter: (patch: Partial<FilterConfig>) => void;
  resetFilters: () => void;

  // Drag & drop positions + undo/redo
  setManualLabelPosition: (mode: VisualizationMode, id: string, coord: LabelCoord) => void;
  resetManualLabelPosition: (mode: VisualizationMode, id: string) => void;
  setManualClusterPosition: (id: string, coord: LabelCoord) => void;
  resetManualClusterPosition: (id: string) => void;
  resetAllManualPositions: (mode: VisualizationMode) => void;
  undo: () => void;
  redo: () => void;

  // Project lifecycle
  newEmptyProject: () => void;
  loadSampleProject: () => void;
  loadProjectFile: (file: ProjectFile) => void;
  toProjectFile: () => ProjectFile;

  // AI settings
  updateAISettings: (patch: Partial<AISettings>) => void;
  loadAISettingsFromDisk: () => Promise<void>;
  saveAISettingsToDisk: (next?: AISettings) => Promise<boolean>;
}

const initialSample = createSampleProject();

function syncFilterWithMutations(
  currentFilter: FilterConfig,
  mutations: MutationRecord[],
): FilterConfig {
  const uniquePhenos = getUniquePhenotypes(mutations);
  const nextPhenos = Array.from(
    new Set([...currentFilter.enabledPhenotypes, ...uniquePhenos]),
  );
  return {
    ...currentFilter,
    enabledPhenotypes: nextPhenos,
  };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  language: getInitialLanguage(),
  activeTab: 'chart',
  projectName: initialSample.metadata.projectName,
  createdAt: initialSample.metadata.createdAt,
  notes: initialSample.metadata.notes ?? '',
  rawInputText: initialSample.rawInputText,
  geneStructure: initialSample.geneStructure,
  mutations: initialSample.mutations,
  activeMode: initialSample.visualization.activeMode,
  style: initialSample.visualization.style,
  filter: initialSample.visualization.filter,
  manualLabelPositions: initialSample.visualization.manualLabelPositions,
  undoStack: [],
  redoStack: [],
  aiSettings: DEFAULT_AI_SETTINGS,

  setLanguage: (language) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, language);
      } catch {
        // ignore storage errors
      }
    }
    set({ language });
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  setProjectName: (projectName) => set({ projectName }),
  setRawInputText: (rawInputText) => set({ rawInputText }),

  setGeneStructure: (geneStructure) =>
    set((state) => ({
      geneStructure,
      style: {
        ...state.style,
        title: `${geneStructure.geneSymbol} (${geneStructure.proteinName || 'Protein'}) Mutasyon Haritası`,
      },
    })),

  updateGeneMeta: (patch) =>
    set((state) => ({
      geneStructure: { ...state.geneStructure, ...patch },
    })),

  addDomain: (domain) =>
    set((state) => {
      const nextIdx = state.geneStructure.domains.length + 1;
      const lastEnd = state.geneStructure.domains.at(-1)?.end ?? 0;
      const start = Math.min(state.geneStructure.proteinLengthAa, lastEnd + 1);
      const end = Math.min(state.geneStructure.proteinLengthAa, start + 30);
      const newDom: ProteinDomain = {
        id: `dom-${Date.now().toString(36)}-${nextIdx}`,
        name: domain?.name ?? `Domain ${nextIdx}`,
        shortName: domain?.shortName ?? `D${nextIdx}`,
        start: domain?.start ?? Math.max(1, start),
        end: domain?.end ?? Math.max(1, end),
        color: domain?.color ?? '#3b82f6',
        description: domain?.description ?? '',
      };
      return {
        geneStructure: {
          ...state.geneStructure,
          domains: [...state.geneStructure.domains, newDom],
        },
      };
    }),

  updateDomain: (id, patch) =>
    set((state) => ({
      geneStructure: {
        ...state.geneStructure,
        domains: state.geneStructure.domains.map((d) =>
          d.id === id ? { ...d, ...patch } : d,
        ),
      },
    })),

  removeDomain: (id) =>
    set((state) => ({
      geneStructure: {
        ...state.geneStructure,
        domains: state.geneStructure.domains.filter((d) => d.id !== id),
      },
    })),

  importDomains: (domains) =>
    set((state) => ({
      geneStructure: { ...state.geneStructure, domains },
    })),

  addExon: (exon) =>
    set((state) => {
      const lastExon = state.geneStructure.exons.at(-1);
      const nextNum = (lastExon?.exonNumber ?? 0) + 1;
      const startBp = (lastExon?.endBp ?? 0) + 1;
      const endBp = startBp + 120;
      const newExon: ExonRegion = {
        id: `ex-${Date.now().toString(36)}-${nextNum}`,
        name: exon?.name ?? `Ex-${nextNum}`,
        exonNumber: exon?.exonNumber ?? nextNum,
        startBp: exon?.startBp ?? startBp,
        endBp: exon?.endBp ?? endBp,
        color: exon?.color ?? (nextNum % 2 === 0 ? '#dbeafe' : '#bfdbfe'),
        isCoding: exon?.isCoding ?? true,
      };
      return {
        geneStructure: {
          ...state.geneStructure,
          exons: [...state.geneStructure.exons, newExon],
        },
      };
    }),

  updateExon: (id, patch) =>
    set((state) => ({
      geneStructure: {
        ...state.geneStructure,
        exons: state.geneStructure.exons.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      },
    })),

  removeExon: (id) =>
    set((state) => ({
      geneStructure: {
        ...state.geneStructure,
        exons: state.geneStructure.exons.filter((e) => e.id !== id),
      },
    })),

  importExons: (exons) =>
    set((state) => ({
      geneStructure: { ...state.geneStructure, exons },
    })),

  setMutations: (mutations) =>
    set((state) => ({
      mutations,
      filter: createDefaultFilterConfig(getUniquePhenotypes(mutations)),
      manualLabelPositions: {
        'protein-domain': {},
        'cdna-exon': {},
        'cdna-exon-clusters': {},
      },
      undoStack: [],
      redoStack: [],
      style: {
        ...state.style,
        mode1TopPhenotype:
          getUniquePhenotypes(mutations)[0] ?? state.style.mode1TopPhenotype,
      },
    })),

  appendMutations: (newMutations) =>
    set((state) => {
      const merged = [...state.mutations, ...newMutations];
      return {
        mutations: merged,
        filter: syncFilterWithMutations(state.filter, merged),
      };
    }),

  addEmptyMutation: () =>
    set((state) => {
      const newMut: MutationRecord = {
        id: `mut-${Date.now().toString(36)}`,
        cDNA_change: 'c.100G>A',
        protein_change: 'p.Gly34Ser',
        position_aa: 34,
        position_bp: 100,
        exon: state.geneStructure.exons[0]?.name ?? 'Ex-1',
        mutation_type: 'Missense',
        patient_or_allele_count: { raw: '1(1)', family_count: 1, allele_count: 1 },
        phenotype_or_type: state.filter.enabledPhenotypes[0] ?? 'Belirtilmemiş',
        side_override: 'auto',
      };
      const merged = [newMut, ...state.mutations];
      return {
        mutations: merged,
        filter: syncFilterWithMutations(state.filter, merged),
      };
    }),

  updateMutation: (id, patch) =>
    set((state) => {
      const next = state.mutations.map((m) => (m.id === id ? { ...m, ...patch } : m));
      return {
        mutations: next,
        filter: syncFilterWithMutations(state.filter, next),
      };
    }),

  removeMutation: (id) =>
    set((state) => ({
      mutations: state.mutations.filter((m) => m.id !== id),
    })),

  removeMutationsBulk: (ids) =>
    set((state) => {
      const idSet = new Set(ids);
      return {
        mutations: state.mutations.filter((m) => !idSet.has(m.id)),
      };
    }),

  setActiveMode: (activeMode) => set({ activeMode }),

  updateStyle: (patch) =>
    set((state) => ({
      style: { ...state.style, ...patch },
    })),

  updateMutationStyle: (type, patch) =>
    set((state) => ({
      style: {
        ...state.style,
        mutationStyles: {
          ...state.style.mutationStyles,
          [type]: {
            ...state.style.mutationStyles[type],
            ...patch,
          },
        },
      },
    })),

  applyStylePreset: (presetId) =>
    set((state) => {
      const preset = STYLE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return state;
      return {
        style: {
          ...state.style,
          ...preset.patch,
          mutationStyles: preset.patch.mutationStyles
            ? { ...preset.patch.mutationStyles }
            : state.style.mutationStyles,
        },
      };
    }),

  updateFilter: (patch) =>
    set((state) => ({
      filter: { ...state.filter, ...patch },
    })),

  resetFilters: () =>
    set((state) => ({
      filter: createDefaultFilterConfig(getUniquePhenotypes(state.mutations)),
    })),

  setManualLabelPosition: (mode, id, coord) =>
    set((state) => {
      const prevSnapshot = structuredClone(state.manualLabelPositions);
      const nextPositions: ManualLabelPositions = {
        ...state.manualLabelPositions,
        [mode]: {
          ...state.manualLabelPositions[mode],
          [id]: coord,
        },
      };
      return {
        manualLabelPositions: nextPositions,
        undoStack: [...state.undoStack.slice(-(MAX_UNDO_HISTORY - 1)), prevSnapshot],
        redoStack: [],
      };
    }),

  resetManualLabelPosition: (mode, id) =>
    set((state) => {
      if (!(id in state.manualLabelPositions[mode])) return state;
      const prevSnapshot = structuredClone(state.manualLabelPositions);
      const copyMode = { ...state.manualLabelPositions[mode] };
      delete copyMode[id];
      return {
        manualLabelPositions: {
          ...state.manualLabelPositions,
          [mode]: copyMode,
        },
        undoStack: [...state.undoStack.slice(-(MAX_UNDO_HISTORY - 1)), prevSnapshot],
        redoStack: [],
      };
    }),

  setManualClusterPosition: (id, coord) =>
    set((state) => {
      const prevSnapshot = structuredClone(state.manualLabelPositions);
      const nextPositions: ManualLabelPositions = {
        ...state.manualLabelPositions,
        'cdna-exon-clusters': {
          ...state.manualLabelPositions['cdna-exon-clusters'],
          [id]: coord,
        },
      };
      return {
        manualLabelPositions: nextPositions,
        undoStack: [...state.undoStack.slice(-(MAX_UNDO_HISTORY - 1)), prevSnapshot],
        redoStack: [],
      };
    }),

  resetManualClusterPosition: (id) =>
    set((state) => {
      if (!(id in state.manualLabelPositions['cdna-exon-clusters'])) return state;
      const prevSnapshot = structuredClone(state.manualLabelPositions);
      const copyClusters = { ...state.manualLabelPositions['cdna-exon-clusters'] };
      delete copyClusters[id];
      return {
        manualLabelPositions: {
          ...state.manualLabelPositions,
          'cdna-exon-clusters': copyClusters,
        },
        undoStack: [...state.undoStack.slice(-(MAX_UNDO_HISTORY - 1)), prevSnapshot],
        redoStack: [],
      };
    }),

  resetAllManualPositions: (mode) =>
    set((state) => {
      const hasLabels = Object.keys(state.manualLabelPositions[mode]).length > 0;
      const hasClusters =
        mode === 'cdna-exon' &&
        Object.keys(state.manualLabelPositions['cdna-exon-clusters']).length > 0;
      if (!hasLabels && !hasClusters) return state;
      const prevSnapshot = structuredClone(state.manualLabelPositions);
      return {
        manualLabelPositions: {
          ...state.manualLabelPositions,
          [mode]: {},
          ...(mode === 'cdna-exon' ? { 'cdna-exon-clusters': {} } : {}),
        },
        undoStack: [...state.undoStack.slice(-(MAX_UNDO_HISTORY - 1)), prevSnapshot],
        redoStack: [],
      };
    }),

  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      const currentSnapshot = structuredClone(state.manualLabelPositions);
      return {
        manualLabelPositions: prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, currentSnapshot],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const currentSnapshot = structuredClone(state.manualLabelPositions);
      return {
        manualLabelPositions: next,
        undoStack: [...state.undoStack, currentSnapshot],
        redoStack: state.redoStack.slice(0, -1),
      };
    }),

  newEmptyProject: () => {
    const now = new Date().toISOString();
    const emptyGene: GeneStructure = {
      geneSymbol: 'YENI_GEN',
      proteinName: 'Tanımlanmamış Protein',
      proteinLengthAa: 500,
      cdnaLengthBp: 1500,
      domains: [],
      exons: [],
    };
    const enabledTypes = Object.fromEntries(
      MUTATION_TYPES.map((t) => [t, true]),
    ) as Record<MutationType, boolean>;
    set({
      projectName: 'Yeni Mutasyon Projesi',
      createdAt: now,
      notes: '',
      rawInputText: '',
      geneStructure: emptyGene,
      mutations: [],
      activeMode: 'protein-domain',
      style: createDefaultStyleConfig({
        title: 'Mutasyon Haritası',
        subtitle: '',
      }),
      filter: {
        enabledTypes,
        enabledPhenotypes: [],
        minCount: 1,
        searchQuery: '',
        minPosition: null,
        maxPosition: null,
      },
      manualLabelPositions: {
        'protein-domain': {},
        'cdna-exon': {},
        'cdna-exon-clusters': {},
      },
      undoStack: [],
      redoStack: [],
      activeTab: 'data',
    });
  },

  loadSampleProject: () => {
    const sample = createSampleProject();
    set({
      projectName: sample.metadata.projectName,
      createdAt: sample.metadata.createdAt,
      notes: sample.metadata.notes ?? '',
      rawInputText: sample.rawInputText,
      geneStructure: sample.geneStructure,
      mutations: sample.mutations,
      activeMode: sample.visualization.activeMode,
      style: sample.visualization.style,
      filter: sample.visualization.filter,
      manualLabelPositions: sample.visualization.manualLabelPositions,
      undoStack: [],
      redoStack: [],
    });
  },

  loadProjectFile: (file) => {
    set({
      projectName: file.metadata.projectName,
      createdAt: file.metadata.createdAt,
      notes: file.metadata.notes ?? '',
      rawInputText: file.rawInputText,
      geneStructure: file.geneStructure,
      mutations: file.mutations,
      activeMode: file.visualization.activeMode,
      style: file.visualization.style,
      filter: file.visualization.filter,
      manualLabelPositions: file.visualization.manualLabelPositions,
      undoStack: [],
      redoStack: [],
    });
  },

  toProjectFile: (): ProjectFile => {
    const state = get();
    return {
      schemaVersion: '1.0.0',
      metadata: {
        projectName: state.projectName,
        createdAt: state.createdAt,
        updatedAt: new Date().toISOString(),
        notes: state.notes,
      },
      geneStructure: state.geneStructure,
      mutations: state.mutations,
      rawInputText: state.rawInputText,
      visualization: {
        activeMode: state.activeMode,
        style: state.style,
        filter: state.filter,
        manualLabelPositions: state.manualLabelPositions,
      },
    };
  },

  updateAISettings: (patch) =>
    set((state) => ({
      aiSettings: { ...state.aiSettings, ...patch },
    })),

  loadAISettingsFromDisk: async () => {
    const loaded = await loadPersistedSettings();
    if (!loaded) return;
    set((state) => ({
      aiSettings: {
        ...state.aiSettings,
        ...(loaded as Partial<AISettings>),
      },
    }));
  },

  saveAISettingsToDisk: async (next) => {
    const target = next ?? get().aiSettings;
    set({ aiSettings: target });
    return savePersistedSettings({ ...target });
  },
}));
