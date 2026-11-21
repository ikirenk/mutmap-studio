import { describe, expect, it } from 'vitest';
import { deduplicateMutations, splitTableIntoChunks } from '../src/services/ai/chunker';
import { MutationRecord } from '../src/types/schema';

describe('splitTableIntoChunks', () => {
  it('repeats table headers across every chunk and preserves wrapped continuation lines', () => {
    const header = 'Exon\tcDNA change\tProtein change\tMutation type\tFamilies(Alleles)\tPhenotype';
    const rows: string[] = [header];
    for (let i = 1; i <= 35; i++) {
      if (i === 5) {
        rows.push(`Ex-5\tc.${i * 10}G>A`);
        rows.push(`    p.Gly${i}Ser\tMissense\t${i}(${i * 2})\tLAD-I0`);
      } else {
        rows.push(`Ex-5\tc.${i * 10}G>A\tp.Gly${i}Ser\tMissense\t${i}(${i * 2})\tLAD-I0`);
      }
    }

    const chunks = splitTableIntoChunks(rows.join('\n'), {
      maxLinesPerChunk: 15,
      overlapLines: 1,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) {
      expect(chunk.headerBlock).toContain('cDNA change');
      expect(chunk.fullText.startsWith(header)).toBe(true);
    }

    // Continuation line from row 5 should be merged with c.50G>A
    expect(chunks[0].bodyText).toContain('c.50G>A p.Gly5Ser');
  });

  it('returns empty array for blank input', () => {
    expect(splitTableIntoChunks('   \n\n  ')).toEqual([]);
  });
});

describe('deduplicateMutations', () => {
  it('removes identical overlap records while preserving distinct phenotypes or variants', () => {
    const base: MutationRecord = {
      id: 'm1',
      cDNA_change: 'c.850G>A',
      protein_change: 'p.Gly284Ser',
      position_aa: 284,
      position_bp: 850,
      exon: 'Ex-8',
      mutation_type: 'Missense',
      patient_or_allele_count: { raw: '30(58)', family_count: 30, allele_count: 58 },
      phenotype_or_type: 'LAD-I0',
      side_override: 'auto',
    };

    const dup: MutationRecord = { ...base, id: 'm2' };
    const otherPheno: MutationRecord = {
      ...base,
      id: 'm3',
      phenotype_or_type: 'LAD-I-',
      patient_or_allele_count: { raw: '2(4)', family_count: 2, allele_count: 4 },
    };

    const deduped = deduplicateMutations([base, dup, otherPheno]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].id).toBe('m1');
    expect(deduped[1].id).toBe('m3');
  });
});
