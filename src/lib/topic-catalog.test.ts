import { describe, expect, it } from 'vitest';

import {
  getComparisonBySubjectSet,
  getTopicSearchHints,
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

  it('resolves search hints from subject aliases', () => {
    const hints = getTopicSearchHints('Why is TSLA moving today?');

    expect(hints?.domainKeywords).toContain('tesla');
    expect(hints?.preferredDomains).toContain('reuters');
    expect(hints?.preferredDomains).not.toContain('coindesk');
  });

  it('merges search hints for comparison heads', () => {
    const hints = getTopicSearchHints('Gold vs Bitcoin');

    expect(hints?.domainKeywords).toEqual(expect.arrayContaining(['gold', 'bitcoin']));
    expect(hints?.preferredDomains).toEqual(expect.arrayContaining(['reuters', 'coindesk']));
  });
});
