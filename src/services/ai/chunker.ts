import { MutationRecord } from '../../types/schema';

export interface TableChunk {
  index: number;
  totalChunks: number;
  headerBlock: string;
  bodyText: string;
  fullText: string;
  rowCount: number;
}

export interface ChunkOptions {
  maxLinesPerChunk?: number;
  maxCharsPerChunk?: number;
  overlapLines?: number;
}

const HEADER_KEYWORDS = [
  'exon',
  'ekzon',
  'cdna',
  'protein',
  'nucleotide',
  'amino',
  'mutation',
  'mutasyon',
  'variant',
  'varyant',
  'allele',
  'allel',
  'family',
  'families',
  'aile',
  'patient',
  'patients',
  'hasta',
  'phenotype',
  'fenotip',
  'type',
  'tip',
  'domain',
  'reference',
  'location',
  'position',
  'hgvs',
];

const VARIANT_START_RE =
  /^(?:c\.|g\.|m\.|r\.|ex(?:on)?\s*[-]?\d+|intron\s*\d+|\d+\s*(?:\t|,|;|\s{2,})|IVS\d+)/i;

function looksLikeHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/\bc\.\d+|\bp\.[A-Z][a-z]{2}\d+|\bp\.[A-Z]\d+/.test(trimmed)) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  let matches = 0;
  for (const kw of HEADER_KEYWORDS) {
    if (lower.includes(kw)) matches += 1;
  }
  return matches >= 2;
}

function isSeparatorLine(line: string): boolean {
  return /^[\s\-=_|+|:]+$/.test(line);
}

function startsNewTableRow(line: string, prevLine: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const leadingSpaces = line.length - line.trimStart().length;

  // Indented continuation of a split row (e.g. wrapped "    p.Gly5Ser  Missense  5(10)")
  if (leadingSpaces >= 3 && !VARIANT_START_RE.test(trimmed)) {
    return false;
  }
  if (/^p\./i.test(trimmed) && /\bc\./i.test(prevLine) && !/\bp\./i.test(prevLine)) {
    return false;
  }
  if (VARIANT_START_RE.test(trimmed)) return true;
  if (/\t/.test(line) || /\s{2,}/.test(trimmed)) {
    return true;
  }
  return true;
}

/**
 * Splits messy scientific copy-paste mutation tables into overlapping chunks,
 * grouping wrapped PDF continuation lines with their preceding row and repeating
 * the detected table header in every chunk.
 */
export function splitTableIntoChunks(
  rawText: string,
  options: ChunkOptions = {},
): TableChunk[] {
  const maxLinesPerChunk = Math.max(5, options.maxLinesPerChunk ?? 25);
  const maxCharsPerChunk = Math.max(800, options.maxCharsPerChunk ?? 4500);
  const overlapLines = Math.max(0, Math.min(5, options.overlapLines ?? 1));

  const normalized = rawText.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const rawLines = normalized
    .split('\n')
    .filter((l) => l.trim().length > 0 && !isSeparatorLine(l));

  if (rawLines.length === 0) return [];

  const headerLines: string[] = [];
  let startIdx = 0;
  for (let i = 0; i < Math.min(2, rawLines.length); i++) {
    if (looksLikeHeaderLine(rawLines[i])) {
      headerLines.push(rawLines[i].trim());
      startIdx = i + 1;
    } else {
      break;
    }
  }

  // Group wrapped PDF copy-paste lines into logical rows
  const logicalRows: string[] = [];
  for (let i = startIdx; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (
      logicalRows.length > 0 &&
      !startsNewTableRow(line, logicalRows[logicalRows.length - 1])
    ) {
      logicalRows[logicalRows.length - 1] =
        `${logicalRows[logicalRows.length - 1]} ${line.trim()}`;
    } else {
      logicalRows.push(line.trim());
    }
  }

  // If the entire input was only header lines, still process it as a single chunk
  if (logicalRows.length === 0) {
    const full = headerLines.join('\n');
    return [
      {
        index: 0,
        totalChunks: 1,
        headerBlock: full,
        bodyText: '',
        fullText: full,
        rowCount: 0,
      },
    ];
  }

  const headerBlock = headerLines.join('\n');
  const headerChars = headerBlock ? headerBlock.length + 1 : 0;

  const rawChunks: Array<{ rows: string[] }> = [];
  let cursor = 0;

  while (cursor < logicalRows.length) {
    const chunkRows: string[] = [];
    let currentChars = headerChars;
    let idx = cursor;

    while (idx < logicalRows.length && chunkRows.length < maxLinesPerChunk) {
      const row = logicalRows[idx];
      const addedChars = row.length + 1;
      if (chunkRows.length > 0 && currentChars + addedChars > maxCharsPerChunk) {
        break;
      }
      chunkRows.push(row);
      currentChars += addedChars;
      idx += 1;
    }

    rawChunks.push({ rows: chunkRows });

    if (idx >= logicalRows.length) {
      break;
    }

    const effectiveOverlap = Math.min(overlapLines, Math.max(0, chunkRows.length - 1));
    cursor = idx - effectiveOverlap;
  }

  const totalChunks = rawChunks.length;
  return rawChunks.map((chunk, index) => {
    const bodyText = chunk.rows.join('\n');
    const fullText = headerBlock ? `${headerBlock}\n${bodyText}` : bodyText;
    return {
      index,
      totalChunks,
      headerBlock,
      bodyText,
      fullText,
      rowCount: chunk.rows.length,
    };
  });
}

function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Deduplicates mutation records produced across overlapping chunk boundaries.
 */
export function deduplicateMutations(records: MutationRecord[]): MutationRecord[] {
  const seen = new Map<string, MutationRecord>();
  const ordered: MutationRecord[] = [];

  for (const rec of records) {
    const key = [
      normalizeKeyPart(rec.cDNA_change),
      normalizeKeyPart(rec.protein_change),
      normalizeKeyPart(rec.phenotype_or_type),
      String(rec.patient_or_allele_count.family_count),
      String(rec.patient_or_allele_count.allele_count),
    ].join('|');

    if (!seen.has(key)) {
      seen.set(key, rec);
      ordered.push(rec);
    } else {
      const existing = seen.get(key)!;
      if (existing.position_aa == null && rec.position_aa != null) {
        existing.position_aa = rec.position_aa;
      }
      if (existing.position_bp == null && rec.position_bp != null) {
        existing.position_bp = rec.position_bp;
      }
      if (!existing.exon && rec.exon) {
        existing.exon = rec.exon;
      }
    }
  }

  return ordered;
}
