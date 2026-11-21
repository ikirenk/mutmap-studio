import { describe, expect, it } from 'vitest';
import {
  extractAaPosition,
  extractBpPosition,
  normalizeMutationRecord,
  normalizeMutationType,
  parsePatientAlleleCount,
} from '../src/services/ai/parser';

describe('parsePatientAlleleCount', () => {
  it('extracts family_count and allele_count from "30(58)" format', () => {
    expect(parsePatientAlleleCount('30(58)')).toEqual({
      raw: '30(58)',
      family_count: 30,
      allele_count: 58,
    });
    expect(parsePatientAlleleCount('12 (22)')).toEqual({
      raw: '12 (22)',
      family_count: 12,
      allele_count: 22,
    });
  });

  it('extracts counts from slash and single integer formats', () => {
    expect(parsePatientAlleleCount('8/15')).toEqual({
      raw: '8/15',
      family_count: 8,
      allele_count: 15,
    });
    expect(parsePatientAlleleCount('7')).toEqual({
      raw: '7',
      family_count: 7,
      allele_count: 7,
    });
  });
});

describe('HGVS position extraction', () => {
  it('extracts amino acid positions accurately', () => {
    expect(extractAaPosition('p.Gly284Ser')).toBe(284);
    expect(extractAaPosition('p.Arg188*')).toBe(188);
    expect(extractAaPosition('p.Asp128_Gly130del')).toBe(128);
    expect(extractAaPosition('p.?')).toBeNull();
  });

  it('extracts cDNA bp positions accurately including splice variants', () => {
    expect(extractBpPosition('c.850G>A')).toBe(850);
    expect(extractBpPosition('c.167+1G>A')).toBe(167);
    expect(extractBpPosition('c.295-2A>G')).toBe(295);
    expect(extractBpPosition('c.418_420del')).toBe(418);
  });
});

describe('normalizeMutationType & normalizeMutationRecord', () => {
  it('maps mutation type synonyms to the strict 7-class enum', () => {
    expect(normalizeMutationType('Stop-gain')).toBe('Nonsense');
    expect(normalizeMutationType('Del')).toBe('Deletion');
    expect(normalizeMutationType('Ins')).toBe('Insertion');
    expect(normalizeMutationType('Splice donor')).toBe('Splice site');
    expect(normalizeMutationType('Frame-shift')).toBe('Frameshift');
    expect(normalizeMutationType('Unknown', 'c.599_603delinsAA', '')).toBe('Indel');
  });

  it('normalizes an AI raw object with string count and infers missing positions', () => {
    const rec = normalizeMutationRecord({
      cDNA_change: 'c.850G>A',
      protein_change: 'p.Gly284Ser',
      mutation_type: 'Missense',
      patient_or_allele_count: '30(58)',
      phenotype_or_type: 'LAD-I0',
    });

    expect(rec.position_aa).toBe(284);
    expect(rec.position_bp).toBe(850);
    expect(rec.patient_or_allele_count.family_count).toBe(30);
    expect(rec.patient_or_allele_count.allele_count).toBe(58);
    expect(rec.mutation_type).toBe('Missense');
  });
});
