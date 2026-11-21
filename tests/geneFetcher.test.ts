import { describe, expect, it } from 'vitest';
import { computeCodingExons } from '../src/services/bio/geneFetcher';

describe('computeCodingExons', () => {
  it('clips UTRs and orders coding exons 5->3 on positive (+1) strand', () => {
    const exons = [
      { start: 100, end: 200 }, // pure 5' UTR
      { start: 300, end: 400 }, // partial 5' UTR + 61 bp CDS (340..400)
      { start: 500, end: 599 }, // 100 bp CDS
      { start: 700, end: 850 }, // 51 bp CDS (700..750) + 3' UTR
    ];
    const result = computeCodingExons(exons, { start: 340, end: 750 }, 1);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ name: 'Ex-2', startBp: 1, endBp: 61 });
    expect(result[1]).toMatchObject({ name: 'Ex-3', startBp: 62, endBp: 161 });
    expect(result[2]).toMatchObject({ name: 'Ex-4', startBp: 162, endBp: 212 });
  });

  it('orders coding exons 5->3 on reverse (-1) strand', () => {
    // On reverse strand, highest genomic coordinate is 5' start!
    const exons = [
      { start: 100, end: 200 }, // 3' end of gene (last exon)
      { start: 500, end: 599 }, // middle exon
      { start: 900, end: 1000 }, // 5' start of gene (exon 1)
    ];
    const result = computeCodingExons(exons, { start: 150, end: 960 }, -1);
    expect(result).toHaveLength(3);
    // Ex-1: 900..960 -> 61 bp
    expect(result[0]).toMatchObject({ name: 'Ex-1', startBp: 1, endBp: 61 });
    // Ex-2: 500..599 -> 100 bp
    expect(result[1]).toMatchObject({ name: 'Ex-2', startBp: 62, endBp: 161 });
    // Ex-3: 150..200 -> 51 bp
    expect(result[2]).toMatchObject({ name: 'Ex-3', startBp: 162, endBp: 212 });
  });
});
