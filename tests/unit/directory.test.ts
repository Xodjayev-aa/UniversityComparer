import { describe, expect, it } from 'vitest';
import { buildDirectory, isClearlyNotUniversity, looksLikeUniversity } from '../../scripts/ingest/directory';
import type { FetchedSource } from '../../scripts/ingest/sources';

const rorFetched: FetchedSource = {
  path: 'ror.zip',
  release: 'v2.14-2026-10-06',
  publishedAt: '2026-10-06',
  retrievedAt: '2026-10-17',
  sha256: 'a'.repeat(64),
};
const hipoFetched: FetchedSource = {
  path: 'hipo.json',
  release: 'sha256:test',
  publishedAt: null,
  retrievedAt: '2026-10-17',
  sha256: 'b'.repeat(64),
};

function org(id: string, name: string, country: string, domain: string, types = ['education']) {
  return {
    id: `https://ror.org/${id}`,
    names: [{ lang: 'en', types: ['ror_display'], value: name }],
    locations: [
      {
        geonames_details: {
          continent_name: country === 'GB' ? 'Europe' : 'North America',
          country_code: country,
          country_name: country === 'GB' ? 'United Kingdom' : 'Canada',
          country_subdivision_name: null,
          name: country === 'GB' ? 'Oxford' : 'Toronto',
          lat: 1,
          lng: 2,
        },
      },
    ],
    types,
    status: 'active',
    domains: [domain],
    links: [{ type: 'website', value: `https://${domain}/` }],
    established: 1900,
  };
}

describe('directory deduplication and scope', () => {
  it('merges a Hipo listing into the ROR record by domain without creating a duplicate', () => {
    const result = buildDirectory(
      [org('abc123456', 'Example University', 'GB', 'example.ac.uk')],
      [
        {
          name: 'Example University',
          alpha_two_code: 'GB',
          country: 'United Kingdom',
          domains: ['www.example.ac.uk'],
          web_pages: ['https://example.ac.uk/'],
        },
      ],
      rorFetched,
      hipoFetched,
    );
    expect(result.records).toHaveLength(1);
    const [record] = result.records;
    expect(record?.listing.hipo).toBe(true);
    expect(record?.listing.ror).toBe(true);
    expect(record?.domains).toContain('example.ac.uk');
    expect(record?.listing.basisNote).toMatch(/Neither source is an official university register/);
  });

  it('keeps same-named institutions in different countries separate', () => {
    const result = buildDirectory(
      [
        org('aaa111111', 'Example University', 'GB', 'example.ac.uk'),
        org('bbb222222', 'Example University', 'CA', 'example.ca'),
      ],
      [],
      rorFetched,
      hipoFetched,
    );
    expect(result.records).toHaveLength(2);
    expect(new Set(result.records.map((record) => record.country.code))).toEqual(new Set(['GB', 'CA']));
  });

  it('does not treat every ROR education organisation as a university', () => {
    const result = buildDirectory(
      [org('ccc333333', 'Example Mental Health Institute', 'GB', 'emhi.ac.uk')],
      [],
      rorFetched,
      hipoFetched,
    );
    expect(result.records[0]?.scope).toBe('education');
    expect(result.records[0]?.kind).toBe('institute');
  });

  it('drops non-education organisations and inactive records', () => {
    const result = buildDirectory(
      [
        org('ddd444444', 'Example University', 'GB', 'one.ac.uk', ['funder']),
        { ...org('eee555555', 'Closed University', 'GB', 'closed.ac.uk'), status: 'withdrawn' },
      ],
      [],
      rorFetched,
      hipoFetched,
    );
    expect(result.records).toHaveLength(0);
    expect(result.activeEducation).toBe(0);
  });

  it('puts a seminary or film school from Hipo into the broader education scope', () => {
    const result = buildDirectory(
      [],
      [
        {
          name: 'Example Baptist Seminary',
          alpha_two_code: 'US',
          country: 'United States',
          domains: ['seminary.example'],
          web_pages: [],
        },
        {
          name: 'Example Film School',
          alpha_two_code: 'US',
          country: 'United States',
          domains: ['film.example'],
          web_pages: [],
        },
        {
          name: 'Example University',
          alpha_two_code: 'US',
          country: 'United States',
          domains: ['uni.example'],
          web_pages: [],
        },
      ],
      rorFetched,
      hipoFetched,
    );
    const byName = new Map(result.records.map((record) => [record.names.primary, record.scope]));
    expect(byName.get('Example Baptist Seminary')).toBe('education');
    expect(byName.get('Example Film School')).toBe('education');
    expect(byName.get('Example University')).toBe('university');
  });

  it('classifies names without inventing official status', () => {
    expect(looksLikeUniversity(['Université de Montréal'])).toBe(true);
    expect(looksLikeUniversity(['東京大学'])).toBe(true);
    expect(looksLikeUniversity(['Example Research Institute'])).toBe(false);
    expect(isClearlyNotUniversity('Example Baptist Seminary')).toBe(true);
    expect(isClearlyNotUniversity('Example University')).toBe(false);
  });
});
