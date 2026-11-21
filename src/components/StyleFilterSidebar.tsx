import React, { useState } from 'react';
import { Filter, Palette, RotateCcw, Search, Sliders } from 'lucide-react';
import {
  FONT_FAMILIES,
  FontFamilyOption,
  LEGEND_POSITIONS,
  LegendPosition,
  MUTATION_TYPES,
  STYLE_PRESETS,
  SYMBOL_SHAPES,
  SYMBOL_SHAPE_LABELS_TR,
  SymbolShape,
} from '../types/schema';
import {
  getUniquePhenotypes,
  useProjectStore,
} from '../store/useProjectStore';

const LEGEND_LABELS_TR: Record<LegendPosition, string> = {
  'top-right': 'Sağ Üst',
  'top-left': 'Sol Üst',
  'bottom-right': 'Sağ Alt',
  'bottom-left': 'Sol Alt',
  'bottom-center': 'Alt Orta (Yatay)',
  hidden: 'Gizle',
};

export const StyleFilterSidebar: React.FC = () => {
  const [sidebarTab, setSidebarTab] = useState<'style' | 'filter'>('style');

  const activeMode = useProjectStore((s) => s.activeMode);
  const style = useProjectStore((s) => s.style);
  const updateStyle = useProjectStore((s) => s.updateStyle);
  const updateMutationStyle = useProjectStore((s) => s.updateMutationStyle);
  const applyStylePreset = useProjectStore((s) => s.applyStylePreset);

  const mutations = useProjectStore((s) => s.mutations);
  const filter = useProjectStore((s) => s.filter);
  const updateFilter = useProjectStore((s) => s.updateFilter);
  const resetFilters = useProjectStore((s) => s.resetFilters);

  const uniquePhenotypes = getUniquePhenotypes(mutations);

  const countsByType = MUTATION_TYPES.reduce(
    (acc, t) => {
      acc[t] = mutations.filter((m) => m.mutation_type === t).length;
      return acc;
    },
    {} as Record<(typeof MUTATION_TYPES)[number], number>,
  );

  const togglePhenotype = (pheno: string) => {
    const current = new Set(filter.enabledPhenotypes);
    if (current.has(pheno)) {
      current.delete(pheno);
    } else {
      current.add(pheno);
    }
    updateFilter({ enabledPhenotypes: Array.from(current) });
  };

  return (
    <aside className="w-80 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Sidebar Tabs */}
      <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 shrink-0">
        <button
          type="button"
          onClick={() => setSidebarTab('style')}
          className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            sidebarTab === 'style'
              ? 'border-indigo-600 text-indigo-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Stil & Özelleştirme</span>
        </button>
        <button
          type="button"
          onClick={() => setSidebarTab('filter')}
          className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            sidebarTab === 'filter'
              ? 'border-indigo-600 text-indigo-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Filtreleme</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-5 text-xs">
        {sidebarTab === 'style' ? (
          <>
            {/* Academic Presets */}
            <section className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Akademik Yayın Şablonları
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyStylePreset(preset.id)}
                    className="text-left px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors"
                  >
                    <div className="font-semibold text-slate-800">{preset.name}</div>
                    <div className="text-[10px] text-slate-500">{preset.description}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Count Metric Selection */}
            <section className="space-y-2 border-t border-slate-100 pt-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Çizilecek Sayım Verisi
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => updateStyle({ countMetric: 'family_count' })}
                  className={`py-1.5 px-2 rounded-md border font-medium ${
                    style.countMetric === 'family_count'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Aile Sayısı
                </button>
                <button
                  type="button"
                  onClick={() => updateStyle({ countMetric: 'allele_count' })}
                  className={`py-1.5 px-2 rounded-md border font-medium ${
                    style.countMetric === 'allele_count'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Allel Sayısı
                </button>
              </div>
            </section>

            {/* Title & Subtitle */}
            <section className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Grafik Başlığı
                </h3>
                <label className="flex items-center gap-1 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={style.showTitle}
                    onChange={(e) => updateStyle({ showTitle: e.target.checked })}
                  />
                  Göster
                </label>
              </div>
              {style.showTitle && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={style.title}
                    onChange={(e) => updateStyle({ title: e.target.value })}
                    placeholder="Ana başlık"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                  />
                  <input
                    type="text"
                    value={style.subtitle}
                    onChange={(e) => updateStyle({ subtitle: e.target.value })}
                    placeholder="Alt başlık"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
              )}
            </section>

            {/* Mode-Specific Options */}
            {activeMode === 'protein-domain' ? (
              <section className="space-y-2.5 border-t border-slate-100 pt-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5" />
                  Mod 1 Ayarları (Protein Domain)
                </h3>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Üst / Alt Yerleşim Kuralı
                  </label>
                  <select
                    value={style.mode1SplitBy}
                    onChange={(e) =>
                      updateStyle({
                        mode1SplitBy: e.target.value as typeof style.mode1SplitBy,
                      })
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="phenotype">Fenotipe Göre Ayır</option>
                    <option value="alternating">Dönüşümlü (Üst / Alt)</option>
                    <option value="mutation-type">Missense Üstte / Diğerleri Altta</option>
                    <option value="top-only">Tümü Üstte</option>
                  </select>
                </div>

                {style.mode1SplitBy === 'phenotype' && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Üst Tarafta Gösterilecek Fenotip
                    </label>
                    <select
                      value={style.mode1TopPhenotype}
                      onChange={(e) => updateStyle({ mode1TopPhenotype: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                    >
                      {uniquePhenotypes.map((ph) => (
                        <option key={ph} value={ph}>
                          {ph}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Etiket Açısı / Düzeni
                  </label>
                  <select
                    value={style.mode1LabelLayout}
                    onChange={(e) =>
                      updateStyle({
                        mode1LabelLayout: e.target.value as typeof style.mode1LabelLayout,
                      })
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="horizontal-tiered">Yatay Çok Katmanlı (Çakışmasız)</option>
                    <option value="angled-45">45° Açılı</option>
                    <option value="vertical-90">90° Dikey</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={style.mode1ShowProteinChange}
                      onChange={(e) =>
                        updateStyle({ mode1ShowProteinChange: e.target.checked })
                      }
                    />
                    <span>Protein (p.)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={style.mode1ShowCdnaChange}
                      onChange={(e) =>
                        updateStyle({ mode1ShowCdnaChange: e.target.checked })
                      }
                    />
                    <span>cDNA (c.)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={style.mode1ShowCount}
                      onChange={(e) => updateStyle({ mode1ShowCount: e.target.checked })}
                    />
                    <span>Hasta/Allel (n)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={style.mode1ShowPhenotype}
                      onChange={(e) =>
                        updateStyle({ mode1ShowPhenotype: e.target.checked })
                      }
                    />
                    <span>Fenotip</span>
                  </label>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Protein Çubuk Yüksekliği</span>
                    <span className="font-mono">{style.mode1BarHeight} px</span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={52}
                    value={style.mode1BarHeight}
                    onChange={(e) =>
                      updateStyle({ mode1BarHeight: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-indigo-600"
                  />
                </div>
              </section>
            ) : (
              <section className="space-y-3 border-t border-slate-100 pt-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5" />
                  Mod 2 Ayarları (cDNA / Ekzon Yığını)
                </h3>

                {/* Etiket Gösterimi & Yerleşimi */}
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={style.mode2ShowLabels}
                      onChange={(e) =>
                        updateStyle({ mode2ShowLabels: e.target.checked })
                      }
                    />
                    <span>Mutasyon Etiketlerini Göster</span>
                  </label>

                  {style.mode2ShowLabels && (
                    <>
                      <div>
                        <span className="block text-[11px] font-medium text-slate-600 mb-1">
                          Etiket Yerleşimi
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateStyle({ mode2LabelPlacement: 'above-cluster' })}
                            className={`py-1.5 px-2 rounded-md border text-[11px] font-medium ${
                              style.mode2LabelPlacement === 'above-cluster'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            Direkt Şeklin Üstünde
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStyle({ mode2LabelPlacement: 'leader-lines' })}
                            className={`py-1.5 px-2 rounded-md border text-[11px] font-medium ${
                              style.mode2LabelPlacement === 'leader-lines'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            Ok / Çizgi ile Üstte
                          </button>
                        </div>
                      </div>

                      {style.mode2LabelPlacement === 'above-cluster' ? (
                        <div>
                          <div className="flex justify-between text-[11px] text-slate-600">
                            <span>Şekle Dikey Uzaklık</span>
                            <span className="font-mono">{style.mode2LabelOffsetY} px</span>
                          </div>
                          <input
                            type="range"
                            min={4}
                            max={48}
                            value={style.mode2LabelOffsetY}
                            onChange={(e) =>
                              updateStyle({
                                mode2LabelOffsetY: parseInt(e.target.value, 10),
                              })
                            }
                            className="w-full accent-indigo-600"
                          />
                        </div>
                      ) : (
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={style.mode2LeaderDashed}
                            onChange={(e) =>
                              updateStyle({ mode2LeaderDashed: e.target.checked })
                            }
                          />
                          <span>Kesikli Lider Çizgisi</span>
                        </label>
                      )}

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Etiket Açısı
                        </label>
                        <select
                          value={style.mode2LabelAngle}
                          onChange={(e) =>
                            updateStyle({
                              mode2LabelAngle: parseInt(e.target.value, 10) as 0 | -45 | -90,
                            })
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded-md bg-white"
                        >
                          <option value={0}>0° (Yatay)</option>
                          <option value={-45}>45° Açılı</option>
                          <option value={-90}>90° Dikey</option>
                        </select>
                      </div>

                      <div>
                        <span className="block text-[11px] font-medium text-slate-600 mb-1">
                          Etiket İçeriği
                        </span>
                        <div className="grid grid-cols-2 gap-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={style.mode2ShowCdnaChange}
                              onChange={(e) =>
                                updateStyle({ mode2ShowCdnaChange: e.target.checked })
                              }
                            />
                            <span>cDNA (c.)</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={style.mode2ShowProteinChange}
                              onChange={(e) =>
                                updateStyle({ mode2ShowProteinChange: e.target.checked })
                              }
                            />
                            <span>Protein (p.)</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={style.mode2ShowCount}
                              onChange={(e) =>
                                updateStyle({ mode2ShowCount: e.target.checked })
                              }
                            />
                            <span>Hasta/Allel (n)</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={style.mode2ShowPhenotype}
                              onChange={(e) =>
                                updateStyle({ mode2ShowPhenotype: e.target.checked })
                              }
                            />
                            <span>Fenotip</span>
                          </label>
                        </div>
                      </div>

                      {/* Etiket Font & Punto */}
                      <div className="border-t border-slate-200 pt-2 space-y-2">
                        <span className="block text-[11px] font-semibold text-slate-700">
                          Etiket Yazı Tipi & Punto
                        </span>
                        <select
                          value={style.mode2LabelFontFamily}
                          onChange={(e) =>
                            updateStyle({
                              mode2LabelFontFamily: e.target.value as
                                | 'inherit'
                                | FontFamilyOption,
                            })
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded-md bg-white"
                        >
                          <option value="inherit">
                            Genel Font ({style.fontFamily})
                          </option>
                          {FONT_FAMILIES.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] text-slate-500 mb-0.5">
                              Punto (pt)
                            </label>
                            <input
                              type="number"
                              min={7}
                              max={24}
                              step={0.5}
                              value={style.mode2LabelFontSize}
                              onChange={(e) =>
                                updateStyle({
                                  mode2LabelFontSize: Math.max(
                                    7,
                                    Math.min(24, parseFloat(e.target.value) || 10.5),
                                  ),
                                })
                              }
                              className="w-full px-2 py-1 border border-slate-300 rounded-md font-mono bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">
                              Renk
                            </label>
                            <input
                              type="color"
                              value={style.mode2LabelColor}
                              onChange={(e) =>
                                updateStyle({ mode2LabelColor: e.target.value })
                              }
                              className="w-8 h-7 rounded border border-slate-300 cursor-pointer p-0 bg-white"
                            />
                          </div>
                          <div className="pt-3.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateStyle({
                                  mode2LabelFontWeight:
                                    style.mode2LabelFontWeight === 'bold'
                                      ? 'normal'
                                      : 'bold',
                                })
                              }
                              className={`px-2.5 py-1 rounded-md border font-bold text-[11px] ${
                                style.mode2LabelFontWeight === 'bold'
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-700 border-slate-300'
                              }`}
                              title="Etiketleri Kalın (Bold) Yap"
                            >
                              B
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Küme & Sembol Yerleşimi */}
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Kümeleme Eşiği (Sayı &gt; Eşik)</span>
                      <span className="font-mono font-semibold text-indigo-700">
                        {style.mode2ClusterThreshold}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={25}
                      value={style.mode2ClusterThreshold}
                      onChange={(e) =>
                        updateStyle({
                          mode2ClusterThreshold: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full accent-indigo-600"
                    />
                    <p className="text-[10px] text-slate-500">
                      Eşiği aşan yığınlar yukarı çıkarken 2&apos;li, 3&apos;lü, 4&apos;lü piramit kümesine dönüşür.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Maksimum Küme Genişliği</span>
                      <span className="font-mono">{style.mode2MaxClusterWidth} sütun</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={8}
                      value={style.mode2MaxClusterWidth}
                      onChange={(e) =>
                        updateStyle({
                          mode2MaxClusterWidth: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full accent-indigo-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Semboller Arası Boşluk</span>
                      <span className="font-mono">{style.mode2SymbolGap} px</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={8}
                      step={0.5}
                      value={style.mode2SymbolGap}
                      onChange={(e) =>
                        updateStyle({
                          mode2SymbolGap: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>

                {/* Ekzon & Bağlantı Çizgisi */}
                <div className="border-t border-slate-100 pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Alt Bağlantı Kalınlığı</span>
                        <span className="font-mono">{style.mode2StemWidth} px</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={3.5}
                        step={0.25}
                        value={style.mode2StemWidth}
                        onChange={(e) =>
                          updateStyle({
                            mode2StemWidth: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-indigo-600"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5">Çizgi</span>
                      <input
                        type="color"
                        value={style.mode2StemColor}
                        onChange={(e) =>
                          updateStyle({ mode2StemColor: e.target.value })
                        }
                        className="w-7 h-6 rounded border border-slate-300 cursor-pointer p-0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Ekzon Yük.</span>
                        <span className="font-mono">{style.mode2BarHeight}</span>
                      </div>
                      <input
                        type="range"
                        min={16}
                        max={52}
                        value={style.mode2BarHeight}
                        onChange={(e) =>
                          updateStyle({
                            mode2BarHeight: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-indigo-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Ekzon Boşluk</span>
                        <span className="font-mono">{style.mode2ExonGap}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={style.mode2ExonGap}
                        onChange={(e) =>
                          updateStyle({
                            mode2ExonGap: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-indigo-600"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={style.mode2ShowDomainsBelow}
                      onChange={(e) =>
                        updateStyle({ mode2ShowDomainsBelow: e.target.checked })
                      }
                    />
                    <span>Ekzonların Altında Domain Belirteçleri</span>
                  </label>
                </div>
              </section>
            )}

            {/* Mutation Types Styling */}
            <section className="space-y-2 border-t border-slate-100 pt-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Mutasyon Tipi Renk ve Sembolleri
              </h3>
              <div className="space-y-2">
                {MUTATION_TYPES.map((type) => {
                  const st = style.mutationStyles[type];
                  return (
                    <div
                      key={type}
                      className="p-2 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{type}</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={st.color}
                            onChange={(e) =>
                              updateMutationStyle(type, { color: e.target.value })
                            }
                            className="w-6 h-5 rounded border border-slate-300 cursor-pointer p-0"
                          />
                          <input
                            type="number"
                            min={3}
                            max={12}
                            step={0.5}
                            value={st.size}
                            onChange={(e) =>
                              updateMutationStyle(type, {
                                size: Math.max(3, Math.min(12, parseFloat(e.target.value) || 6)),
                              })
                            }
                            className="w-12 px-1.5 py-0.5 border border-slate-300 rounded text-[11px] font-mono bg-white"
                            title="Sembol boyutu"
                          />
                        </div>
                      </div>
                      <select
                        value={st.shape}
                        onChange={(e) =>
                          updateMutationStyle(type, {
                            shape: e.target.value as SymbolShape,
                          })
                        }
                        className="w-full px-2 py-1 text-[11px] border border-slate-300 rounded bg-white"
                      >
                        {SYMBOL_SHAPES.map((shape) => (
                          <option key={shape} value={shape}>
                            {SYMBOL_SHAPE_LABELS_TR[shape]}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Typography & Canvas Dimensions */}
            <section className="space-y-2.5 border-t border-slate-100 pt-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Yazı Tipi, Boyut & Lejant
              </h3>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Yazı Tipi</label>
                <select
                  value={style.fontFamily}
                  onChange={(e) =>
                    updateStyle({ fontFamily: e.target.value as FontFamilyOption })
                  }
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Etiket Boyutu (pt)
                  </label>
                  <input
                    type="number"
                    min={7}
                    max={18}
                    step={0.5}
                    value={style.labelFontSize}
                    onChange={(e) =>
                      updateStyle({
                        labelFontSize: Math.max(7, parseFloat(e.target.value) || 10.5),
                      })
                    }
                    className="w-full px-2 py-1 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Başlık Boyutu (pt)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={36}
                    value={style.titleFontSize}
                    onChange={(e) =>
                      updateStyle({
                        titleFontSize: Math.max(10, parseInt(e.target.value, 10) || 18),
                      })
                    }
                    className="w-full px-2 py-1 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Genişlik (px)
                  </label>
                  <input
                    type="number"
                    min={600}
                    max={3200}
                    step={50}
                    value={style.width}
                    onChange={(e) =>
                      updateStyle({
                        width: Math.max(600, Math.min(3200, parseInt(e.target.value, 10) || 1200)),
                      })
                    }
                    className="w-full px-2 py-1 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Yükseklik (px)
                  </label>
                  <input
                    type="number"
                    min={420}
                    max={2400}
                    step={40}
                    value={style.height}
                    onChange={(e) =>
                      updateStyle({
                        height: Math.max(420, Math.min(2400, parseInt(e.target.value, 10) || 720)),
                      })
                    }
                    className="w-full px-2 py-1 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Lejant Konumu</label>
                <select
                  value={style.legendPosition}
                  onChange={(e) =>
                    updateStyle({ legendPosition: e.target.value as LegendPosition })
                  }
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                >
                  {LEGEND_POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {LEGEND_LABELS_TR[pos]}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={style.legendShowCounts}
                  onChange={(e) => updateStyle({ legendShowCounts: e.target.checked })}
                />
                <span>Lejantta mutasyon sayılarını göster</span>
              </label>
            </section>
          </>
        ) : (
          /* FILTER TAB */
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Veri Filtreleme
              </h3>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
              >
                <RotateCcw className="w-3 h-3" />
                Sıfırla
              </button>
            </div>

            {/* Search */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Varyant / Metin Arama
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filter.searchQuery}
                  onChange={(e) => updateFilter({ searchQuery: e.target.value })}
                  placeholder="ör. Gly284, c.850, Ex-8"
                  className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-md"
                />
              </div>
            </div>

            {/* Minimum Count Threshold */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <div className="flex justify-between text-[11px] font-medium text-slate-700">
                <span>
                  Minimum {style.countMetric === 'family_count' ? 'Aile' : 'Allel'} Sayısı
                </span>
                <span className="font-mono font-bold text-indigo-700">{filter.minCount}</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={filter.minCount}
                onChange={(e) =>
                  updateFilter({ minCount: parseInt(e.target.value, 10) || 1 })
                }
                className="w-full accent-indigo-600"
              />
              <p className="text-[10px] text-slate-500">
                Bu değerin altındaki nadir mutasyonlar grafikten geçici olarak gizlenir.
              </p>
            </div>

            {/* Mutation Types */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Mutasyon Tipleri
                </span>
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      updateFilter({
                        enabledTypes: Object.fromEntries(
                          MUTATION_TYPES.map((t) => [t, true]),
                        ) as typeof filter.enabledTypes,
                      })
                    }
                    className="text-indigo-600 hover:underline"
                  >
                    Tümü
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateFilter({
                        enabledTypes: Object.fromEntries(
                          MUTATION_TYPES.map((t) => [t, false]),
                        ) as typeof filter.enabledTypes,
                      })
                    }
                    className="text-slate-500 hover:underline"
                  >
                    Hiçbiri
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {MUTATION_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filter.enabledTypes[type]}
                        onChange={(e) =>
                          updateFilter({
                            enabledTypes: {
                              ...filter.enabledTypes,
                              [type]: e.target.checked,
                            },
                          })
                        }
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: style.mutationStyles[type].color }}
                      />
                      <span>{type}</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {countsByType[type]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Phenotypes */}
            {uniquePhenotypes.length > 0 && (
              <div className="border-t border-slate-100 pt-3 space-y-1.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Fenotipler
                </span>
                <div className="space-y-1">
                  {uniquePhenotypes.map((ph) => (
                    <label
                      key={ph}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filter.enabledPhenotypes.includes(ph)}
                        onChange={() => togglePhenotype(ph)}
                      />
                      <span>{ph}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Position Range */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                AA Pozisyon Aralığı
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="Min aa"
                  value={filter.minPosition ?? ''}
                  onChange={(e) =>
                    updateFilter({
                      minPosition: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  className="px-2 py-1 border border-slate-300 rounded-md font-mono"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Max aa"
                  value={filter.maxPosition ?? ''}
                  onChange={(e) =>
                    updateFilter({
                      maxPosition: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  className="px-2 py-1 border border-slate-300 rounded-md font-mono"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
