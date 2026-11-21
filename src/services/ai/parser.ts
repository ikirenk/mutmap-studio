import { z } from 'zod';
import {
  AISettings,
  MUTATION_TYPES,
  MutationCount,
  MutationRecord,
  MutationType,
} from '../../types/schema';
import { platformFetch } from '../platform';
import { deduplicateMutations, splitTableIntoChunks } from './chunker';

const RawMutationFromAISchema = z.object({
  cDNA_change: z.string().optional().default(''),
  protein_change: z.string().optional().default(''),
  position_aa: z.union([z.number(), z.string(), z.null()]).optional().default(null),
  position_bp: z.union([z.number(), z.string(), z.null()]).optional().default(null),
  exon: z.union([z.string(), z.null()]).optional().default(null),
  mutation_type: z.string().optional().default('Missense'),
  patient_or_allele_count: z
    .union([
      z.object({
        raw: z.string().optional(),
        family_count: z.union([z.number(), z.string()]).optional(),
        allele_count: z.union([z.number(), z.string()]).optional(),
      }),
      z.string(),
      z.number(),
    ])
    .optional(),
  phenotype_or_type: z.string().optional().default('Belirtilmemiş'),
  notes: z.string().optional(),
});

const RawMutationEnvelopeSchema = z.union([
  z.array(RawMutationFromAISchema),
  z.object({
    mutations: z.array(RawMutationFromAISchema),
  }),
]);

/**
 * Parses values like "30(58)", "30 (58)", "30/58", "30 families, 58 alleles", or "7"
 * into distinct family_count and allele_count numbers.
 */
export function parsePatientAlleleCount(input: unknown): MutationCount {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const val = Math.max(0, Math.round(input));
    return { raw: String(val), family_count: val, allele_count: val };
  }

  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    const rawStr = typeof obj.raw === 'string' ? obj.raw.trim() : undefined;
    const famNum = toPositiveInt(obj.family_count);
    const alleleNum = toPositiveInt(obj.allele_count);

    if (famNum !== null && alleleNum !== null) {
      return {
        raw: rawStr || `${famNum}(${alleleNum})`,
        family_count: famNum,
        allele_count: alleleNum,
      };
    }

    if (rawStr) {
      const parsedFromRaw = parsePatientAlleleCount(rawStr);
      return {
        raw: rawStr,
        family_count: famNum ?? parsedFromRaw.family_count,
        allele_count: alleleNum ?? parsedFromRaw.allele_count,
      };
    }

    if (famNum !== null) {
      return { raw: String(famNum), family_count: famNum, allele_count: famNum };
    }
    if (alleleNum !== null) {
      return { raw: String(alleleNum), family_count: alleleNum, allele_count: alleleNum };
    }
    return { raw: '1', family_count: 1, allele_count: 1 };
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return { raw: '1', family_count: 1, allele_count: 1 };
    }

    // Pattern like "30(58)" or "30 (58)"
    const parenMatch = trimmed.match(/(\d+)\s*\(\s*(\d+)\s*\)/);
    if (parenMatch) {
      const family_count = parseInt(parenMatch[1], 10);
      const allele_count = parseInt(parenMatch[2], 10);
      return { raw: trimmed, family_count, allele_count };
    }

    // Pattern like "30/58" or "30 ; 58"
    const slashMatch = trimmed.match(/(\d+)\s*[\/;|]\s*(\d+)/);
    if (slashMatch) {
      const family_count = parseInt(slashMatch[1], 10);
      const allele_count = parseInt(slashMatch[2], 10);
      return { raw: trimmed, family_count, allele_count };
    }

    // Pattern like "30 families, 58 alleles"
    const namedNums = trimmed.match(/\d+/g);
    if (namedNums && namedNums.length >= 2) {
      return {
        raw: trimmed,
        family_count: parseInt(namedNums[0], 10),
        allele_count: parseInt(namedNums[1], 10),
      };
    }

    if (namedNums && namedNums.length === 1) {
      const n = parseInt(namedNums[0], 10);
      return { raw: trimmed, family_count: n, allele_count: n };
    }
  }

  return { raw: '1', family_count: 1, allele_count: 1 };
}

function toPositiveInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(0, Math.round(v));
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const m = v.trim().match(/^\d+/);
    if (m) return parseInt(m[0], 10);
  }
  return null;
}

/**
 * Extracts amino acid position from HGVS protein notation (e.g., p.Gly284Ser -> 284, p.R593* -> 593).
 */
export function extractAaPosition(proteinChange: string): number | null {
  if (!proteinChange) return null;
  const trimmed = proteinChange.trim();
  if (!trimmed || trimmed === 'p.?' || trimmed === '?') return null;

  // Matches p.Gly284Ser, p.Asp128_Gly130del, Gly284fs, p.R593*, p.Val638Trpfs*11
  const match = trimmed.match(/(?:p\.)?[A-Za-z*]{1,3}(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  const fallback = trimmed.match(/(\d+)/);
  if (fallback) {
    const num = parseInt(fallback[1], 10);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  return null;
}

/**
 * Extracts cDNA base-pair position from HGVS cDNA notation (e.g., c.850G>A -> 850, c.59-1G>A -> 59).
 */
export function extractBpPosition(cDnaChange: string): number | null {
  if (!cDnaChange) return null;
  const trimmed = cDnaChange.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(?:c\.)?(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  return null;
}

/**
 * Maps messy biological nomenclature synonyms into the strict 7-class MutationType enum.
 */
export function normalizeMutationType(
  rawType: string,
  cDnaChange = '',
  proteinChange = '',
): MutationType {
  const s = rawType.trim().toLowerCase();
  const cLower = cDnaChange.toLowerCase();
  const pLower = proteinChange.toLowerCase();

  if (s === 'missense' || s.includes('missense') || s.includes('yanlış anlam')) {
    return 'Missense';
  }
  if (
    s === 'nonsense' ||
    s.includes('nonsense') ||
    s.includes('stop-gain') ||
    s.includes('stop gain') ||
    s.includes('premature stop') ||
    s.includes('anlamsız')
  ) {
    return 'Nonsense';
  }
  if (s.includes('frameshift') || s.includes('frame-shift') || s.includes('frame shift')) {
    return 'Frameshift';
  }
  if (s.includes('splice') || s.includes('kırpılma') || s.includes('ivs')) {
    return 'Splice site';
  }
  if (s.includes('indel') || (s.includes('del') && s.includes('ins'))) {
    return 'Indel';
  }
  if (s.includes('deletion') || s === 'del' || s.includes('delesyon')) {
    return 'Deletion';
  }
  if (s.includes('insertion') || s === 'ins' || s.includes('duplication') || s.includes('dup') || s.includes('insersiyon')) {
    return 'Insertion';
  }

  // Fallback heuristics from cDNA/protein notation
  if (cLower.includes('delins') || pLower.includes('delins')) return 'Indel';
  if (pLower.includes('fs')) return 'Frameshift';
  if (/[+-]\d+[acgt]>[acgt]/i.test(cDnaChange) || /^ivs/i.test(cDnaChange)) return 'Splice site';
  if (/\*$|ter$|x$/i.test(proteinChange.trim())) return 'Nonsense';
  if (cLower.includes('del')) return 'Deletion';
  if (cLower.includes('ins') || cLower.includes('dup')) return 'Insertion';

  return 'Missense';
}

function createRecordId(idx?: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `mut-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `mut-${Date.now().toString(36)}-${idx ?? Math.floor(Math.random() * 10000)}`;
}

export function normalizeMutationRecord(rawObj: unknown, idx?: number): MutationRecord {
  const parsed = RawMutationFromAISchema.parse(rawObj);

  const cDNA_change = parsed.cDNA_change.trim();
  const protein_change = parsed.protein_change.trim();

  const parsedBp = toPositiveInt(parsed.position_bp) ?? extractBpPosition(cDNA_change);
  let parsedAa = toPositiveInt(parsed.position_aa) ?? extractAaPosition(protein_change);
  if (parsedAa === null && parsedBp !== null) {
    // Approximate codon position for splice/unknown-protein variants so they still plot meaningfully
    parsedAa = Math.max(1, Math.ceil(parsedBp / 3));
  }

  const mutation_type = normalizeMutationType(
    parsed.mutation_type,
    cDNA_change,
    protein_change,
  );
  const patient_or_allele_count = parsePatientAlleleCount(parsed.patient_or_allele_count);

  return {
    id: createRecordId(idx),
    cDNA_change,
    protein_change,
    position_aa: parsedAa,
    position_bp: parsedBp,
    exon: parsed.exon ? parsed.exon.trim() : null,
    mutation_type,
    patient_or_allele_count,
    phenotype_or_type: parsed.phenotype_or_type?.trim() || 'Belirtilmemiş',
    notes: parsed.notes?.trim() || undefined,
    side_override: 'auto',
  };
}

const SYSTEM_PROMPT = `You are an expert bioinformatics and clinical genetics data extraction engine.
Your job is to parse raw, messy mutation tables copy-pasted from scientific papers (including broken PDF line wraps, merged cells, and inconsistent columns) into a strict JSON array of mutation objects.

Rules:
1. Extract EVERY mutation row from the text. Never skip or summarize rows.
2. Output JSON matching the requested schema: an array of objects (or { "mutations": [...] }) with:
   - cDNA_change: HGVS cDNA notation (e.g., "c.850G>A"). If missing, "".
   - protein_change: HGVS protein notation (e.g., "p.Gly284Ser", "p.Arg188*", "p.?"). If missing, "".
   - position_aa: integer amino acid residue position (e.g., 284). Infer from protein_change, or estimate ceil(position_bp/3) if protein_change is "p.?" and cDNA position is known, otherwise null.
   - position_bp: integer cDNA coding nucleotide position (e.g., 850; for "c.167+1G>A" use 167; for "c.295-2A>G" use 295). Otherwise null.
   - exon: exon name/number if present (e.g., "Ex-8"), else null.
   - mutation_type: MUST be strictly one of: "Missense", "Nonsense", "Deletion", "Insertion", "Splice site", "Indel", "Frameshift".
   - patient_or_allele_count: object with { "raw": string, "family_count": integer, "allele_count": integer }. For notations like "30(58)", "30 (58)", or "30/58", extract family_count=30 and allele_count=58. If only a single number like "5" appears, set both family_count=5 and allele_count=5.
   - phenotype_or_type: clinical phenotype or subtype (e.g., "LAD-I0", "LAD-I-", "Severe", "Mild"). If none in the table, use "Belirtilmemiş".
3. Return ONLY valid JSON.`;

const GEMINI_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      cDNA_change: { type: 'STRING' },
      protein_change: { type: 'STRING' },
      position_aa: { type: 'INTEGER', nullable: true },
      position_bp: { type: 'INTEGER', nullable: true },
      exon: { type: 'STRING', nullable: true },
      mutation_type: {
        type: 'STRING',
        enum: [...MUTATION_TYPES],
      },
      patient_or_allele_count: {
        type: 'OBJECT',
        properties: {
          raw: { type: 'STRING' },
          family_count: { type: 'INTEGER' },
          allele_count: { type: 'INTEGER' },
        },
        required: ['raw', 'family_count', 'allele_count'],
      },
      phenotype_or_type: { type: 'STRING' },
    },
    required: [
      'cDNA_change',
      'protein_change',
      'position_aa',
      'position_bp',
      'mutation_type',
      'patient_or_allele_count',
      'phenotype_or_type',
    ],
  },
};

const OPENAI_COMPAT_JSON_SCHEMA = {
  name: 'mutation_table',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      mutations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            cDNA_change: { type: 'string' },
            protein_change: { type: 'string' },
            position_aa: { type: ['integer', 'null'] },
            position_bp: { type: ['integer', 'null'] },
            exon: { type: ['string', 'null'] },
            mutation_type: { type: 'string', enum: [...MUTATION_TYPES] },
            patient_or_allele_count: {
              type: 'object',
              additionalProperties: false,
              properties: {
                raw: { type: 'string' },
                family_count: { type: 'integer' },
                allele_count: { type: 'integer' },
              },
              required: ['raw', 'family_count', 'allele_count'],
            },
            phenotype_or_type: { type: 'string' },
          },
          required: [
            'cDNA_change',
            'protein_change',
            'position_aa',
            'position_bp',
            'exon',
            'mutation_type',
            'patient_or_allele_count',
            'phenotype_or_type',
          ],
        },
      },
    },
    required: ['mutations'],
  },
};

function extractJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

async function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('İstek iptal edildi.', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('İstek iptal edildi.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function callWithRetry<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
  maxRetries = 2,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('İstek iptal edildi.', 'AbortError');
    }
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable = /\b(429|500|502|503|504)\b|timeout|network/i.test(msg);
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      await sleepWithSignal(900 * Math.pow(2, attempt), signal);
    }
  }
  throw lastError;
}

async function callGeminiChunk(
  chunkText: string,
  settings: AISettings,
  signal?: AbortSignal,
): Promise<unknown> {
  const model = settings.model.trim() || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Parse the following mutation table text into structured JSON:\n\n${chunkText}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: settings.temperature ?? 0,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  });

  const res = await platformFetch({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': settings.geminiApiKey.trim(),
    },
    body,
    timeoutMs: 90000,
    signal,
  });

  if (!res.ok) {
    throw new Error(`Gemini API hatası (${res.status}): ${res.text.slice(0, 300)}`);
  }

  const json = JSON.parse(res.text) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const contentText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!contentText) {
    throw new Error('Gemini API boş yanıt döndürdü.');
  }
  return extractJsonPayload(contentText);
}

function supportsCustomTemperature(model: string): boolean {
  return !/^(?:o[134]|gpt-5)/i.test(model.trim());
}

async function callChatCompletionsChunk(options: {
  url: string;
  providerLabel: string;
  apiKey: string;
  model: string;
  chunkText: string;
  temperature: number;
  extraHeaders?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${options.apiKey.trim()}`,
    ...options.extraHeaders,
  };

  const makePayload = (useStrictSchema: boolean, includeTemperature: boolean) => {
    const payload: Record<string, unknown> = {
      model: options.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Parse the following mutation table text into a JSON object with a "mutations" array:\n\n${options.chunkText}`,
        },
      ],
      response_format: useStrictSchema
        ? { type: 'json_schema', json_schema: OPENAI_COMPAT_JSON_SCHEMA }
        : { type: 'json_object' },
    };
    if (includeTemperature) {
      payload.temperature = options.temperature;
    }
    return JSON.stringify(payload);
  };

  const allowTemp = supportsCustomTemperature(options.model);

  let res = await platformFetch({
    url: options.url,
    method: 'POST',
    headers,
    body: makePayload(true, allowTemp),
    timeoutMs: 90000,
    signal: options.signal,
  });

  // Fallback to json_object without temperature if model rejects strict schema or custom temperature
  if (!res.ok && res.status === 400) {
    res = await platformFetch({
      url: options.url,
      method: 'POST',
      headers,
      body: makePayload(false, false),
      timeoutMs: 90000,
      signal: options.signal,
    });
  }

  if (!res.ok) {
    throw new Error(`${options.providerLabel} API hatası (${res.status}): ${res.text.slice(0, 300)}`);
  }

  const json = JSON.parse(res.text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const contentText = json.choices?.[0]?.message?.content;
  if (!contentText) {
    throw new Error(`${options.providerLabel} API boş yanıt döndürdü.`);
  }
  return extractJsonPayload(contentText);
}

export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * Resolves a user-provided OpenAI-compatible URL into a full /chat/completions endpoint.
 * Accepts full completion URLs, /v1 base URLs, bare host URLs, or empty string for default OpenAI.
 */
export function resolveOpenAICompletionsUrl(customUrl?: string): string {
  const trimmed = (customUrl ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_OPENAI_ENDPOINT;

  let resolved: string;
  if (/\/chat\/completions$/i.test(trimmed)) {
    resolved = trimmed;
  } else if (/\/v\d+$/i.test(trimmed)) {
    resolved = `${trimmed}/chat/completions`;
  } else {
    resolved = `${trimmed}/v1/chat/completions`;
  }

  const isAllowed =
    resolved.startsWith('https://') ||
    /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(resolved);
  if (!isAllowed) {
    throw new Error(
      'Geçersiz OpenAI URL: https:// (veya yerel sunucu için http://localhost) ile başlamalıdır.',
    );
  }

  return resolved;
}

async function callOpenAIChunk(
  chunkText: string,
  settings: AISettings,
  signal?: AbortSignal,
): Promise<unknown> {
  return callChatCompletionsChunk({
    url: resolveOpenAICompletionsUrl(settings.openaiBaseUrl),
    providerLabel: 'OpenAI',
    apiKey: settings.openaiApiKey,
    model: settings.model.trim() || 'gpt-4o-mini',
    chunkText,
    temperature: settings.temperature ?? 0,
    signal,
  });
}

async function callOpenRouterChunk(
  chunkText: string,
  settings: AISettings,
  signal?: AbortSignal,
): Promise<unknown> {
  return callChatCompletionsChunk({
    url: 'https://openrouter.ai/api/v1/chat/completions',
    providerLabel: 'OpenRouter',
    apiKey: settings.openrouterApiKey,
    model: settings.model.trim() || 'google/gemini-2.5-flash',
    chunkText,
    temperature: settings.temperature ?? 0,
    extraHeaders: {
      'HTTP-Referer': 'https://mutmap.studio.local',
      'X-Title': 'MutMap Studio',
    },
    signal,
  });
}

export interface AIParseProgress {
  completedChunks: number;
  totalChunks: number;
  extractedCount: number;
}

export interface AIParseResult {
  mutations: MutationRecord[];
  chunksProcessed: number;
  warnings: string[];
}

export async function parseMutationsWithAI(
  rawText: string,
  settings: AISettings,
  callbacks: {
    onProgress?: (progress: AIParseProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<AIParseResult> {
  const apiKey =
    settings.provider === 'gemini'
      ? settings.geminiApiKey.trim()
      : settings.provider === 'openai'
        ? settings.openaiApiKey.trim()
        : settings.openrouterApiKey.trim();

  if (!apiKey) {
    const missingMessages = {
      gemini:
        'Gemini API anahtarı girilmemiş. Lütfen Ayarlar menüsünden API anahtarınızı ekleyin.',
      openai:
        'OpenAI API anahtarı girilmemiş. Lütfen Ayarlar menüsünden API anahtarınızı ekleyin.',
      openrouter:
        'OpenRouter API anahtarı girilmemiş. Lütfen Ayarlar menüsünden API anahtarınızı ekleyin.',
    } as const;
    throw new Error(missingMessages[settings.provider]);
  }

  const chunks = splitTableIntoChunks(rawText, {
    maxLinesPerChunk: settings.chunkMaxLines,
    overlapLines: settings.chunkOverlapLines,
  });

  if (chunks.length === 0) {
    throw new Error('Ayrıştırılacak metin bulunamadı.');
  }

  const allNormalized: MutationRecord[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const payload = await callWithRetry(() => {
      if (settings.provider === 'gemini') {
        return callGeminiChunk(chunk.fullText, settings, callbacks.signal);
      }
      if (settings.provider === 'openai') {
        return callOpenAIChunk(chunk.fullText, settings, callbacks.signal);
      }
      return callOpenRouterChunk(chunk.fullText, settings, callbacks.signal);
    }, callbacks.signal);

    const validated = RawMutationEnvelopeSchema.safeParse(payload);
    if (!validated.success) {
      warnings.push(
        `Parça ${i + 1}/${chunks.length} doğrulama uyarısı: ${validated.error.issues[0]?.message ?? 'beklenmeyen şema'}`,
      );
      continue;
    }

    const items = Array.isArray(validated.data)
      ? validated.data
      : validated.data.mutations;

    for (let j = 0; j < items.length; j++) {
      allNormalized.push(normalizeMutationRecord(items[j], allNormalized.length + j));
    }

    callbacks.onProgress?.({
      completedChunks: i + 1,
      totalChunks: chunks.length,
      extractedCount: allNormalized.length,
    });
  }

  const deduplicated = deduplicateMutations(allNormalized);
  return {
    mutations: deduplicated,
    chunksProcessed: chunks.length,
    warnings,
  };
}

export async function testAIConnection(settings: AISettings): Promise<{
  ok: boolean;
  message: string;
}> {
  const sample = 'cDNA change\tProtein change\tMutation type\tFamilies(Alleles)\tPhenotype\nc.850G>A\tp.Gly284Ser\tMissense\t30(58)\tLAD-I0';
  const result = await parseMutationsWithAI(sample, settings);
  if (result.mutations.length === 0) {
    return { ok: false, message: 'Bağlantı kuruldu ancak test satırı ayrıştırılamadı.' };
  }
  const first = result.mutations[0];
  return {
    ok: true,
    message: `Bağlantı başarılı! Test sonucu: ${first.cDNA_change} / ${first.protein_change} (Aile: ${first.patient_or_allele_count.family_count}, Allel: ${first.patient_or_allele_count.allele_count})`,
  };
}
