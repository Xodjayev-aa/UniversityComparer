import { describe, expect, it } from 'vitest';

const enabled = process.env.LIVE_TESTS === '1';
const headers = {
  'user-agent': 'UniScope/0.1 (source verification; contact via repository)',
  accept: 'application/json, text/html;q=0.9',
};

describe.runIf(enabled)('live directory and official-source checks', () => {
  it('ROR still identifies the University of Oxford', async () => {
    const response = await fetch('https://api.ror.org/v2/organizations?query=University%20of%20Oxford', {
      headers,
    });
    expect(response.ok).toBe(true);
    const body = (await response.json()) as { items?: Array<{ id?: string; names?: Array<{ value?: string }> }> };
    const oxford = body.items?.find((item) => item.id?.endsWith('/052gg0110'));
    expect(oxford?.names?.some((name) => name.value === 'University of Oxford')).toBe(true);
  });

  it('Oxford still publishes a 2027-entry course-fee page with an overseas range', async () => {
    const response = await fetch('https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding/course-fees', {
      headers,
    });
    expect(response.ok).toBe(true);
    const html = await response.text();
    expect(html).toContain('Course fees for 2027 entry');
    expect(html).toMatch(/Overseas[\s\S]{0,400}?39,620/);
  });

  it('the Hipo directory is still reachable and returns a JSON array', async () => {
    const response = await fetch(
      'https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json',
      {
        headers,
        signal: AbortSignal.timeout(45_000),
      },
    );
    expect(response.ok).toBe(true);
    const body = (await response.json()) as unknown;
    expect(Array.isArray(body)).toBe(true);
    expect((body as unknown[]).length).toBeGreaterThan(5_000);
  });
});
