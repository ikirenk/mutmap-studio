import { describe, expect, it } from 'vitest';
import {
  LEGEND_LABELS,
  SYMBOL_SHAPE_LABELS,
  translations,
} from '../src/i18n/translations';

describe('i18n translations parity', () => {
  it('has identical keys between Turkish (tr) and English (en) dictionaries', () => {
    const trKeys = Object.keys(translations.tr).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(enKeys).toEqual(trKeys);

    expect(Object.keys(SYMBOL_SHAPE_LABELS.en).sort()).toEqual(
      Object.keys(SYMBOL_SHAPE_LABELS.tr).sort(),
    );
    expect(Object.keys(LEGEND_LABELS.en).sort()).toEqual(
      Object.keys(LEGEND_LABELS.tr).sort(),
    );
  });
});
