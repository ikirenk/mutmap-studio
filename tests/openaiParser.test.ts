import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_OPENAI_ENDPOINT,
  parseMutationsWithAI,
  resolveOpenAICompletionsUrl,
} from '../src/services/ai/parser';
import { DEFAULT_AI_SETTINGS } from '../src/types/schema';

const SAMPLE_INPUT =
  'cDNA change\tProtein change\tMutation type\tFamilies(Alleles)\tPhenotype\nc.850G>A\tp.Gly284Ser\tMissense\t30(58)\tLAD-I0';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OpenAI provider support', () => {
  it('throws a clear error when openaiApiKey is missing', async () => {
    await expect(
      parseMutationsWithAI(SAMPLE_INPUT, {
        ...DEFAULT_AI_SETTINGS,
        provider: 'openai',
        openaiApiKey: '',
        model: 'gpt-4o-mini',
      }),
    ).rejects.toThrow(/OpenAI API anahtarı girilmemiş/);
  });

  it('posts strict json_schema and temperature to OpenAI chat/completions for gpt-4o-mini', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  mutations: [
                    {
                      cDNA_change: 'c.850G>A',
                      protein_change: 'p.Gly284Ser',
                      position_aa: 284,
                      position_bp: 850,
                      exon: 'Ex-8',
                      mutation_type: 'Missense',
                      patient_or_allele_count: {
                        raw: '30(58)',
                        family_count: 30,
                        allele_count: 58,
                      },
                      phenotype_or_type: 'LAD-I0',
                    },
                  ],
                }),
              },
            },
          ],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await parseMutationsWithAI(SAMPLE_INPUT, {
      ...DEFAULT_AI_SETTINGS,
      provider: 'openai',
      openaiApiKey: 'sk-test-123',
      model: 'gpt-4o-mini',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test-123');

    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.model).toBe('gpt-4o-mini');
    expect(sentBody.temperature).toBe(0);
    expect(sentBody.response_format.type).toBe('json_schema');
    expect(sentBody.response_format.json_schema.strict).toBe(true);

    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0]).toMatchObject({
      cDNA_change: 'c.850G>A',
      protein_change: 'p.Gly284Ser',
      position_aa: 284,
      position_bp: 850,
      mutation_type: 'Missense',
      patient_or_allele_count: { family_count: 30, allele_count: 58 },
      phenotype_or_type: 'LAD-I0',
    });
  });

  it('omits temperature for gpt-5-mini and falls back to json_object on HTTP 400', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => '{"error":{"message":"json_schema unsupported"}}',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () =>
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    mutations: [
                      {
                        cDNA_change: 'c.850G>A',
                        protein_change: 'p.Gly284Ser',
                        mutation_type: 'Missense',
                        patient_or_allele_count: '30(58)',
                        phenotype_or_type: 'LAD-I0',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await parseMutationsWithAI(SAMPLE_INPUT, {
      ...DEFAULT_AI_SETTINGS,
      provider: 'openai',
      openaiApiKey: 'sk-test-123',
      model: 'gpt-5-mini',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect('temperature' in firstBody).toBe(false);
    expect(firstBody.response_format.type).toBe('json_schema');

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect('temperature' in secondBody).toBe(false);
    expect(secondBody.response_format.type).toBe('json_object');
    expect(result.mutations).toHaveLength(1);
  });

  it('normalizes OpenAI custom URLs across full paths, /v1 bases, bare hosts, and localhost', () => {
    expect(resolveOpenAICompletionsUrl('')).toBe(DEFAULT_OPENAI_ENDPOINT);
    expect(resolveOpenAICompletionsUrl('   ')).toBe(DEFAULT_OPENAI_ENDPOINT);
    expect(
      resolveOpenAICompletionsUrl('https://api.axforge.ai/v1/chat/completions'),
    ).toBe('https://api.axforge.ai/v1/chat/completions');
    expect(resolveOpenAICompletionsUrl('https://api.axforge.ai/v1/')).toBe(
      'https://api.axforge.ai/v1/chat/completions',
    );
    expect(resolveOpenAICompletionsUrl('https://api.axforge.ai')).toBe(
      'https://api.axforge.ai/v1/chat/completions',
    );
    expect(resolveOpenAICompletionsUrl('http://localhost:11434/v1')).toBe(
      'http://localhost:11434/v1/chat/completions',
    );
    expect(() => resolveOpenAICompletionsUrl('http://example.com/v1')).toThrow(
      /Geçersiz OpenAI URL/,
    );
  });

  it('posts to the configured custom OpenAI URL when openaiBaseUrl is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  mutations: [
                    {
                      cDNA_change: 'c.850G>A',
                      protein_change: 'p.Gly284Ser',
                      mutation_type: 'Missense',
                      patient_or_allele_count: '30(58)',
                      phenotype_or_type: 'LAD-I0',
                    },
                  ],
                }),
              },
            },
          ],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await parseMutationsWithAI(SAMPLE_INPUT, {
      ...DEFAULT_AI_SETTINGS,
      provider: 'openai',
      openaiApiKey: 'sk-axforge-key',
      openaiBaseUrl: 'https://api.axforge.ai/v1/chat/completions',
      model: 'gpt-4o-mini',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.axforge.ai/v1/chat/completions',
    );
    expect(result.mutations).toHaveLength(1);
  });
});
