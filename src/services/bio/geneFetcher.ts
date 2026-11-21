import { ExonRegion, GeneStructure, ProteinDomain } from '../../types/schema';
import { platformFetch } from '../platform';

const DOMAIN_PALETTE = [
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#ef4444',
  '#84cc16',
  '#6366f1',
  '#14b8a6',
];

const EXON_COLORS = ['#dbeafe', '#bfdbfe'];

export interface EnsemblExonInput {
  start: number;
  end: number;
  id?: string;
}

export interface EnsemblTranslationInput {
  start: number;
  end: number;
}

/**
 * Pure helper computing coding cDNA exon intervals (1-based) from Ensembl genomic coordinates
 * and CDS Translation genomic bounds on either +1 or -1 strand.
 */
export function computeCodingExons(
  exons: EnsemblExonInput[],
  translation: EnsemblTranslationInput | undefined,
  strand: number,
): ExonRegion[] {
  if (!exons || exons.length === 0) return [];

  // Order exons in 5' -> 3' transcript direction
  const ordered = [...exons].sort((a, b) => (strand >= 0 ? a.start - b.start : b.start - a.start));
  const cdsMin = translation ? Math.min(translation.start, translation.end) : -Infinity;
  const cdsMax = translation ? Math.max(translation.start, translation.end) : Infinity;

  const codingExons: ExonRegion[] = [];
  let cumulativeBp = 0;

  ordered.forEach((exon, idx) => {
    const exonNum = idx + 1;
    const overlapStart = Math.max(exon.start, cdsMin);
    const overlapEnd = Math.min(exon.end, cdsMax);
    if (overlapStart <= overlapEnd) {
      const lengthBp = overlapEnd - overlapStart + 1;
      const startBp = cumulativeBp + 1;
      const endBp = cumulativeBp + lengthBp;
      cumulativeBp = endBp;

      codingExons.push({
        id: `ex-${exonNum}`,
        name: `Ex-${exonNum}`,
        exonNumber: exonNum,
        startBp,
        endBp,
        color: EXON_COLORS[codingExons.length % EXON_COLORS.length],
        isCoding: true,
      });
    }
  });

  return codingExons;
}

interface UniProtFeature {
  type?: string;
  description?: string;
  location?: {
    start?: { value?: number };
    end?: { value?: number };
  };
}

interface UniProtEntry {
  primaryAccession?: string;
  proteinDescription?: {
    recommendedName?: { fullName?: { value?: string } };
    submittedName?: Array<{ fullName?: { value?: string } }>;
  };
  sequence?: { length?: number };
  features?: UniProtFeature[];
}

const INCLUDED_UNIPROT_TYPES = new Set([
  'Signal peptide',
  'Domain',
  'Transmembrane',
  'Repeat',
  'Zinc finger',
  'Motif',
  'Region',
]);

function deduplicateDomains(domains: ProteinDomain[]): ProteinDomain[] {
  const sorted = [...domains].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: ProteinDomain[] = [];

  for (const dom of sorted) {
    // Skip very broad meta-regions like "Extracellular" / "Cytoplasmic" if detailed domains overlap heavily
    const hasHeavyOverlap = kept.some((k) => {
      const interStart = Math.max(k.start, dom.start);
      const interEnd = Math.min(k.end, dom.end);
      if (interStart > interEnd) return false;
      const interLen = interEnd - interStart + 1;
      const minLen = Math.min(k.end - k.start + 1, dom.end - dom.start + 1);
      return interLen / minLen > 0.75;
    });
    if (!hasHeavyOverlap) {
      kept.push(dom);
    }
  }
  return kept;
}

export interface GeneFetchResult {
  geneStructure: Partial<GeneStructure>;
  warnings: string[];
}

/**
 * Fetches reviewed human protein length & domains from UniProt and canonical coding exons from Ensembl.
 */
export async function fetchGeneStructureFromApis(geneSymbol: string): Promise<GeneFetchResult> {
  const symbol = geneSymbol.trim().toUpperCase();
  if (!symbol) {
    throw new Error('Lütfen geçerli bir gen sembolü girin (ör. ITGB2, TP53, BRCA1).');
  }

  const warnings: string[] = [];
  const partial: Partial<GeneStructure> = {
    geneSymbol: symbol,
  };

  // Query UniProt & Ensembl in parallel
  const uniprotUrl = `https://rest.uniprot.org/uniprotkb/search?query=gene_exact:${encodeURIComponent(
    symbol,
  )}+AND+organism_id:9606+AND+reviewed:true&format=json&size=1`;
  const ensemblUrl = `https://rest.ensembl.org/lookup/symbol/homo_sapiens/${encodeURIComponent(
    symbol,
  )}?expand=1;content-type=application/json`;

  const [uniprotRes, ensemblRes] = await Promise.allSettled([
    platformFetch({ url: uniprotUrl, timeoutMs: 25000 }),
    platformFetch({
      url: ensemblUrl,
      headers: { Accept: 'application/json' },
      timeoutMs: 25000,
    }),
  ]);

  if (uniprotRes.status === 'fulfilled' && uniprotRes.value.ok) {
    try {
      const data = JSON.parse(uniprotRes.value.text) as { results?: UniProtEntry[] };
      const entry = data.results?.[0];
      if (entry) {
        partial.uniprotId = entry.primaryAccession;
        partial.proteinName =
          entry.proteinDescription?.recommendedName?.fullName?.value ??
          entry.proteinDescription?.submittedName?.[0]?.fullName?.value ??
          symbol;
        if (entry.sequence?.length) {
          partial.proteinLengthAa = entry.sequence.length;
        }

        const rawDomains: ProteinDomain[] = [];
        (entry.features ?? []).forEach((feat, idx) => {
          const type = feat.type ?? '';
          if (!INCLUDED_UNIPROT_TYPES.has(type)) return;
          const start = feat.location?.start?.value;
          const end = feat.location?.end?.value;
          if (!start || !end || end <= start) return;

          // Skip generic topology regions if they span >400aa and aren't specific domains
          if (type === 'Region' && /disordered|interaction/i.test(feat.description ?? '')) {
            return;
          }

          const label =
            feat.description?.trim() || (type === 'Signal peptide' ? 'Signal Peptide' : type);

          rawDomains.push({
            id: `uniprot-dom-${idx + 1}`,
            name: label,
            shortName: label.length > 14 ? label.slice(0, 12) + '…' : label,
            start,
            end,
            color: DOMAIN_PALETTE[rawDomains.length % DOMAIN_PALETTE.length],
            description: `${type}: ${label} (${start}–${end} aa)`,
          });
        });

        partial.domains = deduplicateDomains(rawDomains);
      } else {
        warnings.push(`UniProt'ta "${symbol}" için onaylı (reviewed) insan proteini bulunamadı.`);
      }
    } catch {
      warnings.push('UniProt yanıtı ayrıştırılamadı.');
    }
  } else {
    warnings.push('UniProt API erişimi başarısız oldu.');
  }

  if (ensemblRes.status === 'fulfilled' && ensemblRes.value.ok) {
    try {
      const geneData = JSON.parse(ensemblRes.value.text) as {
        strand?: number;
        Transcript?: Array<{
          id?: string;
          is_canonical?: number;
          Exon?: EnsemblExonInput[];
          Translation?: EnsemblTranslationInput & { length?: number };
        }>;
      };
      const transcripts = geneData.Transcript ?? [];
      const canonical =
        transcripts.find((t) => t.is_canonical === 1 && t.Translation) ??
        transcripts.find((t) => t.Translation) ??
        transcripts[0];

      if (canonical) {
        partial.ensemblTranscriptId = canonical.id;
        const exons = computeCodingExons(
          canonical.Exon ?? [],
          canonical.Translation,
          geneData.strand ?? 1,
        );
        if (exons.length > 0) {
          partial.exons = exons;
          partial.cdnaLengthBp = exons[exons.length - 1].endBp;
        }
        if (!partial.proteinLengthAa && canonical.Translation?.length) {
          partial.proteinLengthAa = canonical.Translation.length;
        }
      } else {
        warnings.push(`Ensembl'da "${symbol}" için kanonik transkript bulunamadı.`);
      }
    } catch {
      warnings.push('Ensembl yanıtı ayrıştırılamadı.');
    }
  } else {
    warnings.push('Ensembl API erişimi başarısız oldu.');
  }

  if (!partial.domains && !partial.exons && !partial.proteinLengthAa) {
    throw new Error(warnings.join(' ') || `"${symbol}" için gen yapısı verisi alınamadı.`);
  }

  return { geneStructure: partial, warnings };
}
