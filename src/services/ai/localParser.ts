import { MutationRecord } from '../../types/schema';
import {
  extractAaPosition,
  extractBpPosition,
  normalizeMutationType,
  parsePatientAlleleCount,
} from './parser';

/**
 * Deterministic offline parser for clean TSV, CSV, or multi-space separated mutation tables.
 * Acts as an instant fallback when no AI API key is configured.
 */
export function parseMutationsLocally(rawText: string): MutationRecord[] {
  const lines = rawText
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[-=_|+:\s]+$/.test(l));

  if (lines.length === 0) return [];

  const results: MutationRecord[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const lower = line.toLowerCase();

    // Skip header lines
    if (
      idx <= 1 &&
      (lower.includes('cdna') || lower.includes('protein') || lower.includes('mutation')) &&
      !/\bc\.\d+|\bp\.[A-Za-z]{1,3}\d+/.test(line)
    ) {
      continue;
    }

    let cells: string[];
    if (line.includes('\t')) {
      cells = line.split('\t').map((c) => c.trim());
    } else if (line.includes(';')) {
      cells = line.split(';').map((c) => c.trim());
    } else if (line.includes(',') && line.split(',').length >= 3) {
      cells = line.split(',').map((c) => c.trim());
    } else {
      cells = line.split(/\s{2,}/).map((c) => c.trim());
      if (cells.length < 3) {
        cells = line.split(/\s+/).map((c) => c.trim());
      }
    }

    let exon: string | null = null;
    let cDNA_change = '';
    let protein_change = '';
    let rawType = '';
    let rawCount = '1(1)';
    let phenotype_or_type = 'Belirtilmemiş';

    for (const cell of cells) {
      if (!cell) continue;
      if (!exon && /^(?:ex(?:on)?\s*[-]?\s*\d+|ivs\s*\d+)/i.test(cell)) {
        exon = cell.replace(/\s+/g, '');
      } else if (!cDNA_change && /^c\.\S+/i.test(cell)) {
        cDNA_change = cell;
      } else if (!protein_change && /^p\.\S+/i.test(cell)) {
        protein_change = cell;
      } else if (
        !rawType &&
        /missense|nonsense|deletion|insertion|splice|indel|frameshift|\bdel\b|\bins\b/i.test(cell)
      ) {
        rawType = cell;
      } else if (/^\d+\s*\(\s*\d+\s*\)$|^\d+\s*\/\s*\d+$|^\d+$/.test(cell)) {
        rawCount = cell;
      } else if (
        phenotype_or_type === 'Belirtilmemiş' &&
        (cDNA_change || protein_change) &&
        cell.length <= 40
      ) {
        phenotype_or_type = cell;
      }
    }

    if (!cDNA_change && !protein_change) {
      const cMatch = line.match(/c\.[0-9A-Za-z_+\-*?>]+/);
      const pMatch = line.match(/p\.[0-9A-Za-z_*?]+/);
      if (cMatch) cDNA_change = cMatch[0];
      if (pMatch) protein_change = pMatch[0];
    }

    if (!cDNA_change && !protein_change) continue;

    const position_bp = extractBpPosition(cDNA_change);
    let position_aa = extractAaPosition(protein_change);
    if (position_aa === null && position_bp !== null) {
      position_aa = Math.max(1, Math.ceil(position_bp / 3));
    }

    results.push({
      id: `local-${idx + 1}-${Date.now().toString(36).slice(-4)}`,
      cDNA_change,
      protein_change,
      position_aa,
      position_bp,
      exon,
      mutation_type: normalizeMutationType(rawType, cDNA_change, protein_change),
      patient_or_allele_count: parsePatientAlleleCount(rawCount),
      phenotype_or_type,
      side_override: 'auto',
    });
  }

  return results;
}
