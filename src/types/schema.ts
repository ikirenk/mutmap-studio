import { z } from 'zod';

export const MUTATION_TYPES = [
  'Missense',
  'Nonsense',
  'Deletion',
  'Insertion',
  'Splice site',
  'Indel',
  'Frameshift',
] as const;

export type MutationType = (typeof MUTATION_TYPES)[number];

export const SYMBOL_SHAPES = [
  'circle-filled',
  'circle-open',
  'square-filled',
  'square-open',
  'diamond-filled',
  'diamond-open',
  'triangle-up-filled',
  'triangle-up-open',
  'triangle-down-filled',
  'cross',
] as const;

export type SymbolShape = (typeof SYMBOL_SHAPES)[number];

export const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Liberation Sans',
  'Georgia',
  'Courier New',
] as const;

export type FontFamilyOption = (typeof FONT_FAMILIES)[number];

export const LEGEND_POSITIONS = [
  'top-right',
  'top-left',
  'bottom-right',
  'bottom-left',
  'bottom-center',
  'hidden',
] as const;

export type LegendPosition = (typeof LEGEND_POSITIONS)[number];

export const VISUALIZATION_MODES = ['protein-domain', 'cdna-exon'] as const;
export type VisualizationMode = (typeof VISUALIZATION_MODES)[number];

export const MutationCountSchema = z.object({
  raw: z.string().optional(),
  family_count: z.number().int().min(0).default(1),
  allele_count: z.number().int().min(0).default(1),
});

export type MutationCount = z.infer<typeof MutationCountSchema>;

export const MutationRecordSchema = z.object({
  id: z.string().min(1),
  cDNA_change: z.string().default(''),
  protein_change: z.string().default(''),
  position_aa: z.number().int().min(1).nullable(),
  position_bp: z.number().int().min(1).nullable(),
  exon: z.string().nullable().optional(),
  mutation_type: z.enum(MUTATION_TYPES),
  patient_or_allele_count: MutationCountSchema,
  phenotype_or_type: z.string().default('Belirtilmemiş'),
  notes: z.string().optional(),
  side_override: z.enum(['auto', 'top', 'bottom']).optional().default('auto'),
});

export type MutationRecord = z.infer<typeof MutationRecordSchema>;

export const ProteinDomainSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().optional(),
  start: z.number().int().min(1),
  end: z.number().int().min(1),
  color: z.string().min(1),
  description: z.string().optional(),
});

export type ProteinDomain = z.infer<typeof ProteinDomainSchema>;

export const ExonRegionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  exonNumber: z.number().int().min(1),
  startBp: z.number().int().min(1),
  endBp: z.number().int().min(1),
  color: z.string().min(1),
  isCoding: z.boolean().default(true),
});

export type ExonRegion = z.infer<typeof ExonRegionSchema>;

export const GeneStructureSchema = z.object({
  geneSymbol: z.string().min(1),
  proteinName: z.string().default(''),
  uniprotId: z.string().optional(),
  ensemblTranscriptId: z.string().optional(),
  proteinLengthAa: z.number().int().min(1),
  cdnaLengthBp: z.number().int().min(1),
  domains: z.array(ProteinDomainSchema),
  exons: z.array(ExonRegionSchema),
});

export type GeneStructure = z.infer<typeof GeneStructureSchema>;

export const MutationTypeStyleSchema = z.object({
  color: z.string(),
  shape: z.enum(SYMBOL_SHAPES),
  size: z.number().min(3).max(20),
});

export type MutationTypeStyle = z.infer<typeof MutationTypeStyleSchema>;

export const MutationStylesRecordSchema = z.object({
  Missense: MutationTypeStyleSchema,
  Nonsense: MutationTypeStyleSchema,
  Deletion: MutationTypeStyleSchema,
  Insertion: MutationTypeStyleSchema,
  'Splice site': MutationTypeStyleSchema,
  Indel: MutationTypeStyleSchema,
  Frameshift: MutationTypeStyleSchema,
});

export const EnabledMutationTypesSchema = z.object({
  Missense: z.boolean(),
  Nonsense: z.boolean(),
  Deletion: z.boolean(),
  Insertion: z.boolean(),
  'Splice site': z.boolean(),
  Indel: z.boolean(),
  Frameshift: z.boolean(),
});

export const StyleConfigSchema = z.object({
  width: z.number().int().min(600).max(3200).default(1200),
  height: z.number().int().min(420).max(2400).default(720),
  backgroundColor: z.string().default('#ffffff'),
  showTitle: z.boolean().default(true),
  title: z.string().default('ITGB2 (CD18) Mutasyon Haritası'),
  subtitle: z.string().default('LAD-I Hasta Kohortu — Klinik ve Moleküler Dağılım'),
  fontFamily: z.enum(FONT_FAMILIES).default('Arial'),
  titleFontSize: z.number().min(10).max(36).default(18),
  labelFontSize: z.number().min(7).max(18).default(10.5),
  axisFontSize: z.number().min(7).max(16).default(10.5),
  domainFontSize: z.number().min(7).max(16).default(10),
  legendFontSize: z.number().min(8).max(16).default(10.5),
  countMetric: z.enum(['family_count', 'allele_count']).default('family_count'),
  legendPosition: z.enum(LEGEND_POSITIONS).default('top-right'),
  legendShowCounts: z.boolean().default(true),
  mutationStyles: MutationStylesRecordSchema,

  // Mode 1: Protein Domain & Detailed Mutation Map
  mode1SplitBy: z
    .enum(['alternating', 'phenotype', 'mutation-type', 'top-only'])
    .default('phenotype'),
  mode1TopPhenotype: z.string().default('LAD-I0'),
  mode1LabelLayout: z
    .enum(['horizontal-tiered', 'angled-45', 'vertical-90'])
    .default('horizontal-tiered'),
  mode1ShowProteinChange: z.boolean().default(true),
  mode1ShowCdnaChange: z.boolean().default(false),
  mode1ShowCount: z.boolean().default(true),
  mode1ShowPhenotype: z.boolean().default(false),
  mode1BarHeight: z.number().min(16).max(60).default(32),

  // Mode 2: cDNA / Exon Frequency Lollipop Map
  mode2ClusterThreshold: z.number().int().min(2).max(50).default(10),
  mode2MaxClusterWidth: z.number().int().min(2).max(12).default(5),
  mode2ShowDomainsBelow: z.boolean().default(true),
  mode2ShowLabels: z.boolean().default(true),
  mode2LabelPlacement: z.enum(['above-cluster', 'leader-lines']).default('leader-lines'),
  mode2LabelFontFamily: z.enum(['inherit', ...FONT_FAMILIES]).default('inherit'),
  mode2LabelFontSize: z.number().min(7).max(24).default(10.5),
  mode2LabelFontWeight: z.enum(['normal', 'bold']).default('normal'),
  mode2LabelColor: z.string().default('#0f172a'),
  mode2LabelAngle: z.union([z.literal(0), z.literal(-45), z.literal(-90)]).default(0),
  mode2LabelOffsetY: z.number().min(4).max(48).default(12),
  mode2ShowCdnaChange: z.boolean().default(true),
  mode2ShowProteinChange: z.boolean().default(false),
  mode2ShowCount: z.boolean().default(true),
  mode2ShowPhenotype: z.boolean().default(false),
  mode2SymbolGap: z.number().min(0.5).max(8).default(2.5),
  mode2StemWidth: z.number().min(0.5).max(3.5).default(1.05),
  mode2StemColor: z.string().default('#64748b'),
  mode2LeaderDashed: z.boolean().default(true),
  mode2ExonGap: z.number().min(0).max(10).default(2),
  mode2BarHeight: z.number().min(16).max(52).default(28),
});

export type StyleConfig = z.infer<typeof StyleConfigSchema>;

export const FilterConfigSchema = z.object({
  enabledTypes: EnabledMutationTypesSchema,
  enabledPhenotypes: z.array(z.string()),
  minCount: z.number().int().min(0).default(1),
  searchQuery: z.string().default(''),
  minPosition: z.number().int().min(1).nullable().default(null),
  maxPosition: z.number().int().min(1).nullable().default(null),
});

export type FilterConfig = z.infer<typeof FilterConfigSchema>;

export const LabelCoordSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type LabelCoord = z.infer<typeof LabelCoordSchema>;

export const ManualLabelPositionsSchema = z.object({
  'protein-domain': z.record(z.string(), LabelCoordSchema).default({}),
  'cdna-exon': z.record(z.string(), LabelCoordSchema).default({}),
  'cdna-exon-clusters': z.record(z.string(), LabelCoordSchema).default({}),
});

export type ManualLabelPositions = z.infer<typeof ManualLabelPositionsSchema>;

export const ProjectFileSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  metadata: z.object({
    projectName: z.string().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
    notes: z.string().optional(),
  }),
  geneStructure: GeneStructureSchema,
  mutations: z.array(MutationRecordSchema),
  rawInputText: z.string().default(''),
  visualization: z.object({
    activeMode: z.enum(VISUALIZATION_MODES),
    style: StyleConfigSchema,
    filter: FilterConfigSchema,
    manualLabelPositions: ManualLabelPositionsSchema,
  }),
});

export type ProjectFile = z.infer<typeof ProjectFileSchema>;

export type AIProvider = 'gemini' | 'openai' | 'openrouter';

export interface AISettings {
  provider: AIProvider;
  geminiApiKey: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openrouterApiKey: string;
  model: string;
  chunkMaxLines: number;
  chunkOverlapLines: number;
  temperature: number;
}

export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Hızlı & Yapılandırılmış JSON)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Karmaşık Tablolar İçin)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

export const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Hızlı & Ekonomik)' },
  { id: 'gpt-4o', label: 'GPT-4o (Yüksek Doğruluk)' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
];

export const OPENROUTER_MODELS = [
  { id: 'google/gemini-2.5-flash', label: 'Google: Gemini 2.5 Flash' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Anthropic: Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o-mini', label: 'OpenAI: GPT-4o Mini' },
  { id: 'openai/gpt-4o', label: 'OpenAI: GPT-4o' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
];

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  geminiApiKey: '',
  openaiApiKey: '',
  openaiBaseUrl: '',
  openrouterApiKey: '',
  model: 'gemini-2.5-flash',
  chunkMaxLines: 25,
  chunkOverlapLines: 1,
  temperature: 0,
};

export function createDefaultMutationStyles(): Record<MutationType, MutationTypeStyle> {
  return {
    Missense: { color: '#1d4ed8', shape: 'circle-filled', size: 6 },
    Nonsense: { color: '#dc2626', shape: 'square-filled', size: 6 },
    Deletion: { color: '#059669', shape: 'triangle-down-filled', size: 6.5 },
    Insertion: { color: '#0284c7', shape: 'triangle-up-filled', size: 6.5 },
    'Splice site': { color: '#d97706', shape: 'diamond-open', size: 6.5 },
    Indel: { color: '#0d9488', shape: 'square-open', size: 6 },
    Frameshift: { color: '#7c3aed', shape: 'diamond-filled', size: 6.5 },
  };
}

export function createDefaultStyleConfig(overrides?: Partial<StyleConfig>): StyleConfig {
  return {
    width: 1200,
    height: 720,
    backgroundColor: '#ffffff',
    showTitle: true,
    title: 'ITGB2 (CD18) Mutasyon Haritası',
    subtitle: 'LAD-I Kohortu — Domain ve Ekzon Bazlı Varyant Dağılımı',
    fontFamily: 'Arial',
    titleFontSize: 18,
    labelFontSize: 10.5,
    axisFontSize: 10.5,
    domainFontSize: 10,
    legendFontSize: 10.5,
    countMetric: 'family_count',
    legendPosition: 'top-right',
    legendShowCounts: true,
    mutationStyles: createDefaultMutationStyles(),
    mode1SplitBy: 'phenotype',
    mode1TopPhenotype: 'LAD-I0',
    mode1LabelLayout: 'horizontal-tiered',
    mode1ShowProteinChange: true,
    mode1ShowCdnaChange: false,
    mode1ShowCount: true,
    mode1ShowPhenotype: false,
    mode1BarHeight: 32,
    mode2ClusterThreshold: 10,
    mode2MaxClusterWidth: 5,
    mode2ShowDomainsBelow: true,
    mode2ShowLabels: true,
    mode2LabelPlacement: 'leader-lines',
    mode2LabelFontFamily: 'inherit',
    mode2LabelFontSize: 10.5,
    mode2LabelFontWeight: 'normal',
    mode2LabelColor: '#0f172a',
    mode2LabelAngle: 0,
    mode2LabelOffsetY: 12,
    mode2ShowCdnaChange: true,
    mode2ShowProteinChange: false,
    mode2ShowCount: true,
    mode2ShowPhenotype: false,
    mode2SymbolGap: 2.5,
    mode2StemWidth: 1.05,
    mode2StemColor: '#64748b',
    mode2LeaderDashed: true,
    mode2ExonGap: 2,
    mode2BarHeight: 28,
    ...overrides,
  };
}

export function createDefaultFilterConfig(phenotypes: string[] = []): FilterConfig {
  return {
    enabledTypes: {
      Missense: true,
      Nonsense: true,
      Deletion: true,
      Insertion: true,
      'Splice site': true,
      Indel: true,
      Frameshift: true,
    },
    enabledPhenotypes: phenotypes,
    minCount: 1,
    searchQuery: '',
    minPosition: null,
    maxPosition: null,
  };
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  patch: Partial<StyleConfig>;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'nature-science',
    name: 'Nature / Science',
    description: 'Renkli yüksek kontrastlı Okabe-Ito/NPG paleti, Arial font',
    patch: {
      fontFamily: 'Arial',
      backgroundColor: '#ffffff',
      mutationStyles: {
        Missense: { color: '#0072B2', shape: 'circle-filled', size: 6 },
        Nonsense: { color: '#D55E00', shape: 'square-filled', size: 6 },
        Deletion: { color: '#009E73', shape: 'triangle-down-filled', size: 6.5 },
        Insertion: { color: '#56B4E9', shape: 'triangle-up-filled', size: 6.5 },
        'Splice site': { color: '#E69F00', shape: 'diamond-open', size: 6.5 },
        Indel: { color: '#CC79A7', shape: 'square-open', size: 6 },
        Frameshift: { color: '#332288', shape: 'diamond-filled', size: 6.5 },
      },
    },
  },
  {
    id: 'nejm-blood',
    name: 'NEJM / Blood',
    description: 'Klinik dergi estetiği, Times New Roman serif başlıklar',
    patch: {
      fontFamily: 'Times New Roman',
      backgroundColor: '#ffffff',
      mutationStyles: {
        Missense: { color: '#1b4f72', shape: 'circle-filled', size: 6 },
        Nonsense: { color: '#922b21', shape: 'square-filled', size: 6 },
        Deletion: { color: '#1e8449', shape: 'circle-open', size: 6 },
        Insertion: { color: '#2e86c1', shape: 'triangle-up-open', size: 6.5 },
        'Splice site': { color: '#b9770e', shape: 'diamond-open', size: 6.5 },
        Indel: { color: '#7d3c98', shape: 'square-open', size: 6 },
        Frameshift: { color: '#6c3483', shape: 'diamond-filled', size: 6.5 },
      },
    },
  },
  {
    id: 'grayscale-print',
    name: 'Siyah-Beyaz Baskı (Grayscale)',
    description: 'Renksiz akademik baskı için geometrik şekil ayrımlı stil',
    patch: {
      fontFamily: 'Helvetica',
      backgroundColor: '#ffffff',
      mutationStyles: {
        Missense: { color: '#111827', shape: 'circle-filled', size: 6 },
        Nonsense: { color: '#111827', shape: 'square-filled', size: 6 },
        Deletion: { color: '#374151', shape: 'triangle-down-filled', size: 6.5 },
        Insertion: { color: '#374151', shape: 'triangle-up-open', size: 6.5 },
        'Splice site': { color: '#111827', shape: 'circle-open', size: 6 },
        Indel: { color: '#4b5563', shape: 'square-open', size: 6 },
        Frameshift: { color: '#111827', shape: 'diamond-filled', size: 6.5 },
      },
    },
  },
];

export const MUTATION_TYPE_LABELS_TR: Record<MutationType, string> = {
  Missense: 'Missense (Yanlış Anlamlı)',
  Nonsense: 'Nonsense (Anlamsız)',
  Deletion: 'Deletion (Delesyon)',
  Insertion: 'Insertion (İnsersiyon)',
  'Splice site': 'Splice site (Kırpılma Bölgesi)',
  Indel: 'Indel (Delesyon/İnsersiyon)',
  Frameshift: 'Frameshift (Çerçeve Kayması)',
};

export const SYMBOL_SHAPE_LABELS_TR: Record<SymbolShape, string> = {
  'circle-filled': 'Dolu Daire ●',
  'circle-open': 'Boş Daire ○',
  'square-filled': 'Dolu Kare ■',
  'square-open': 'Boş Kare □',
  'diamond-filled': 'Dolu Baklava ◆',
  'diamond-open': 'Boş Baklava ◇',
  'triangle-up-filled': 'Dolu Üçgen (Yukarı) ▲',
  'triangle-up-open': 'Boş Üçgen (Yukarı) △',
  'triangle-down-filled': 'Dolu Üçgen (Aşağı) ▼',
  cross: 'Çarpı ✕',
};
