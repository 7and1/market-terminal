import { describe, expect, it } from 'vitest';

import {
  getComparisonBySubjectSet,
  listComparisonsForAssetKey,
  listRelatedComparisons,
} from '@/lib/topic-catalog';

describe('topic-catalog', () => {
  it('finds curated comparisons regardless of subject order', () => {
    const direct = getComparisonBySubjectSet(['gold', 'bitcoin']);
    const reversed = getComparisonBySubjectSet(['bitcoin', 'gold']);

    expect(direct?.key).toBe('gold-vs-bitcoin');
    expect(reversed?.key).toBe('gold-vs-bitcoin');
  });

  it('lists curated comparisons for an asset key', () => {
    const goldComparisons = listComparisonsForAssetKey('gold').map((item) => item.key);

    expect(goldComparisons).toContain('gold-vs-bitcoin');
    expect(goldComparisons).toContain('yields-vs-gold');
  });

  it('returns related comparisons from catalog metadata', () => {
    const related = listRelatedComparisons('gold-vs-bitcoin').map((item) => item.key);

    expect(related).toContain('yields-vs-gold');
    expect(related).toContain('bitcoin-vs-qqq');
  });
});
