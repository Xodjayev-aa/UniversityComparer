import { describe, expect, it } from 'vitest';
import { buildFacets, parseSearchParams, searchStore } from '../../server/search';
import { makeEntry } from '../../server/data';
import { FIXTURE_INSTITUTIONS, directoryRecord, makeFixtureStore } from '../helpers/fixtures';

const store = makeFixtureStore();

function query(params: string) {
  return searchStore(store, parseSearchParams(new URLSearchParams(params)));
}

describe('search parameter parsing', () => {
  it('clamps pagination and rejects unknown enum values', () => {
    const parsed = parseSearchParams(
      new URLSearchParams('page=-4&pageSize=999&scope=everything&country=gb&degree=phd&region=Mars&mode=hybrid'),
    );
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(100);
    expect(parsed.scope).toBe('university');
    expect(parsed.country).toBe('GB');
    expect(parsed.degree).toBeNull();
    expect(parsed.region).toBeNull();
    expect(parsed.mode).toBeNull();
    expect(parseSearchParams(new URLSearchParams('scope=all')).scope).toBe('all');
    expect(parseSearchParams(new URLSearchParams('scope=education')).scope).toBe('education');
  });
});

describe('Unicode and alternate-name matching', () => {
  it('finds an accented name from an unaccented query and vice versa', () => {
    expect(query('q=montreal').items[0]?.name).toBe('Université de Montréal');
    expect(query('q=Montréal').items[0]?.name).toBe('Université de Montréal');
    expect(query('q=UdeM').items[0]?.name).toBe('Université de Montréal');
  });

  it('matches Arabic script and a former or alternate English name', () => {
    expect(query('q=جامعة القاهرة').items[0]?.name).toBe('جامعة القاهرة');
    expect(query('q=جامعة').items[0]?.name).toBe('جامعة القاهرة');
    expect(query('q=Cairo University').items[0]?.name).toBe('جامعة القاهرة');
    expect(query('q=Egyptian University').items[0]?.name).toBe('جامعة القاهرة');
  });

  it('matches city and country queries', () => {
    expect(query('q=Toronto').items.some((item) => item.name === 'Example University Two')).toBe(true);
    expect(query('q=Canada&sort=name').items.length).toBeGreaterThanOrEqual(2);
    expect(query('q=CA').items.length).toBeGreaterThan(0);
  });
});

describe('scope, filters and withheld counts', () => {
  it('excludes broader education records by default but counts them', () => {
    const defaultSearch = query('scope=university');
    const all = query('scope=all');
    expect(defaultSearch.scopeCounts.education).toBe(1);
    expect(defaultSearch.items.some((item) => item.scope === 'education')).toBe(false);
    expect(all.items.some((item) => item.name === 'Example Baptist Seminary')).toBe(true);
  });

  it('filters by degree level, teaching language, study mode and source-checked fee data', () => {
    expect(query('degree=master').items.map((item) => item.name)).toEqual(['Example University Two']);
    expect(query('language=fr').items.map((item) => item.name)).toEqual(['Example University Two']);
    expect(query('mode=part-time').items.map((item) => item.name)).toEqual(['Example University Two']);
    expect(query('profile=source-checked').items.every((item) => item.verificationLevel === 'source-checked')).toBe(
      true,
    );
    const feeFiltered = query('fees=source-checked');
    expect(feeFiltered.items.map((item) => item.name)).toEqual(['Example University One']);
    expect(feeFiltered.withheld.feeDataUnknown).toBeGreaterThanOrEqual(3);
  });

  it('does not silently hide unknown programme data when a degree filter is active', () => {
    const result = query('degree=bachelor&scope=all');
    expect(result.withheld.programDataUnknown).toBeGreaterThan(0);
    expect(result.notices.join(' ')).toMatch(/programme|program/i);
  });

  it('clamps a page beyond the last page instead of returning an empty false negative', () => {
    const result = query('page=99&pageSize=2');
    expect(result.page).toBe(result.pageCount);
    expect(result.items.length).toBeGreaterThan(0);
  });
});

describe('facets', () => {
  it('counts only university-scope records by country and exposes programme facts', () => {
    const facets = buildFacets(store);
    const us = facets.countries.find((country) => country.code === 'US');
    expect(us).toBeUndefined();
    const ca = facets.countries.find((country) => country.code === 'CA');
    expect(ca?.universityRecords).toBe(2);
    expect(ca?.sourceChecked).toBe(1);
    expect(facets.subjects.find((subject) => subject.id === 'computer-science')?.institutionCount).toBe(2);
    expect(facets.languages.find((language) => language.code === 'fr')?.programCount).toBe(1);
    expect(facets.totals.records).toBe(FIXTURE_INSTITUTIONS.length);
  });
});

describe('search entry construction', () => {
  it('indexes local names, aliases and former names', () => {
    const entry = makeEntry(directoryRecord({ id: 'ror-cairo-check', names: {
      primary: 'جامعة القاهرة',
      official: null,
      aliases: ['Cairo University'],
      localNames: [],
      formerNames: ['Egyptian University'],
    } }));
    expect(entry.names.map((name) => name.value)).toContain('Cairo University');
    expect(entry.names.map((name) => name.value)).toContain('Egyptian University');
    expect(entry.allTokens.has('egyptian')).toBe(true);
  });
});
