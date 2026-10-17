import { describe, expect, it } from 'vitest';
import { canonicalDomain, compactText, foldText, slugify, tokenize } from '../../shared/text';

describe('Unicode-aware text normalisation', () => {
  it('matches accented names with and without accents', () => {
    expect(foldText('Université de Montréal')).toBe('universite de montreal');
    expect(foldText('Universite de Montreal')).toBe('universite de montreal');
    expect(foldText('İstanbul Üniversitesi')).toBe('istanbul universitesi');
    expect(foldText('Østfold')).toBe('ostfold');
    expect(foldText('Straße')).toBe('strasse');
    expect(foldText('Łódź')).toBe('lodz');
  });

  it('preserves non-Latin scripts while stripping Arabic diacritics', () => {
    expect(foldText('جامعة القاهرة')).toBe('جامعة القاهرة');
    expect(foldText('جَامِعَة القَاهِرَة')).toBe('جامعة القاهرة');
    expect(foldText('東京大学')).toBe('東京大学');
    expect(foldText('서울대학교')).toBe('서울대학교');
    expect(tokenize('University of Oxford')).toEqual(['university', 'of', 'oxford']);
  });

  it('treats punctuation, dashes and apostrophes as separators', () => {
    expect(foldText("King's College, London")).toBe('kings college london');
    expect(foldText('Winston‑Salem')).toBe('winston salem');
    expect(compactText('University of Oxford')).toBe('universityofoxford');
    expect(compactText('  Université   de  Montréal ')).toBe('universitedemontreal');
  });

  it('normalises domains used for deduplication', () => {
    expect(canonicalDomain('https://www.Example.edu:443/path?q=1')).toBe('example.edu');
    expect(canonicalDomain('www2.foo.ac.uk')).toBe('foo.ac.uk');
    expect(canonicalDomain('ox.ac.uk.')).toBe('ox.ac.uk');
    expect(canonicalDomain('not a domain')).toBeNull();
    expect(canonicalDomain('')).toBeNull();
  });

  it('builds stable slugs', () => {
    expect(slugify('Université de Montréal')).toBe('universite-de-montreal');
    expect(slugify("King's College London")).toBe('kings-college-london');
    expect(slugify('!!!')).toBe('institution');
  });
});
