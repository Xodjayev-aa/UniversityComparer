// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFacets, searchStore, parseSearchParams } from '../../server/search';
import { api } from '../../src/lib/api';
import { HomePage } from '../../src/pages/Home';
import { SearchPage } from '../../src/pages/Search';
import { InstitutionPage } from '../../src/pages/Institution';
import { ComparePage } from '../../src/pages/Compare';
import { CountriesPage } from '../../src/pages/Countries';
import { SubjectsPage } from '../../src/pages/Subjects';
import { CoveragePage } from '../../src/pages/Coverage';
import { AboutPage } from '../../src/pages/About';
import { PrivacyPage } from '../../src/pages/Privacy';
import { TermsPage } from '../../src/pages/Terms';
import { InstallPage } from '../../src/pages/Install';
import { ShortlistPage } from '../../src/pages/Shortlist';
import { FIXTURE_INSTITUTIONS, fixtureSummary, makeFixtureStore } from '../helpers/fixtures';

const store = makeFixtureStore();
const facets = buildFacets(store);
const coverage = store.coverage;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/facets') return jsonResponse(facets);
      if (url.pathname === '/api/coverage') return jsonResponse(coverage);
      if (url.pathname === '/api/meta') {
        return jsonResponse({ app: 'UniScope', version: '0.1.0', generatedAt: coverage.generatedAt, coverage });
      }
      if (url.pathname === '/api/search') {
        return jsonResponse(searchStore(store, parseSearchParams(url.searchParams)));
      }
      if (url.pathname.startsWith('/api/institutions/')) {
        const id = decodeURIComponent(url.pathname.split('/').pop() ?? '');
        const institution = FIXTURE_INSTITUTIONS.find((record) => record.id === id);
        if (!institution) return jsonResponse({ error: 'Institution not found.' }, 404);
        return jsonResponse({ institution, summary: fixtureSummary(institution) });
      }
      if (url.pathname === '/api/compare') {
        const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
        const items = ids.map((id) => {
          const institution = FIXTURE_INSTITUTIONS.find((record) => record.id === id);
          return institution ? { institution, summary: fixtureSummary(institution) } : null;
        });
        return jsonResponse({ items: items.filter(Boolean) });
      }
      return jsonResponse({ error: 'Not found' }, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/university/:id" element={<InstitutionPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/shortlist" element={<ShortlistPage />} />
        <Route path="/countries" element={<CountriesPage />} />
        <Route path="/countries/:code" element={<CountriesPage />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route path="/coverage" element={<CoveragePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/install" element={<InstallPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('page smoke tests with the real API client and mocked responses', () => {
  it('renders the home page with verified profiles and honest coverage text', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/Example University One/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Source-checked/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/directory/i);
  });

  it('renders search results for an accented query', async () => {
    renderAt('/search?q=Montréal');
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Université de Montréal/ }).length).toBeGreaterThan(0));
    expect(screen.getByText(/Matched on/)).toBeInTheDocument();
  });

  it('renders a source-checked profile with fee basis, deadlines and sources', async () => {
    renderAt('/university/ror-example-one');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /Example University One/ })).toBeInTheDocument());
    expect(screen.getAllByText(/GBP 20,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/per year/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/All applicants|International applicants/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Official source/i)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/Read|read/);
  });

  it('shows a useful not-found state for an unknown profile id', async () => {
    renderAt('/university/ror-does-not-exist');
    await waitFor(() => expect(screen.getAllByText(/not found|could not|unavailable/i).length).toBeGreaterThan(0));
  });

  it('renders the compare page with a preselected pair and no fabricated scores', async () => {
    renderAt('/compare?ids=ror-example-one,ror-example-two');
    await waitFor(() => expect(screen.getAllByText(/Example University One/).length).toBeGreaterThan(0));
    expect(document.body.textContent).toMatch(/No reliable|insufficient|not a quality ranking|trade-off/i);
  });

  it('renders country, subject and coverage pages from facets', async () => {
    const countries = renderAt('/countries');
    await waitFor(() => expect(countries.getByText('Canada')).toBeInTheDocument());
    countries.unmount();

    const subjects = renderAt('/subjects');
    await waitFor(() => expect(subjects.getAllByText(/Computer science/i).length).toBeGreaterThan(0));
    subjects.unmount();

    const coveragePage = renderAt('/coverage');
    await waitFor(() => expect(coveragePage.getByText(/not a complete world register/i)).toBeInTheDocument());
    expect(coveragePage.getAllByText(/Research Organization Registry|ROR/i).length).toBeGreaterThan(0);
  });

  it('renders the shortlist empty state without requiring an account', () => {
    renderAt('/shortlist');
    expect(document.body.textContent).toMatch(/shortlist/i);
    expect(document.body.textContent).not.toMatch(/sign in to save/i);
  });

  it('renders the draft legal, about and install pages', () => {
    for (const path of ['/about', '/privacy', '/terms', '/install']) {
      const view = renderAt(path);
      expect(view.container.textContent?.length ?? 0).toBeGreaterThan(300);
      view.unmount();
    }
    const privacy = renderAt('/privacy');
    expect(privacy.getAllByText(/Draft/i).length).toBeGreaterThan(0);
  });

  it('exposes the verification anchor used by the about link', () => {
    const { container } = renderAt('/about');
    expect(container.querySelector('#verification')).not.toBeNull();
  });
});

describe('client API error handling', () => {
  it('turns an offline failure into an actionable message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api.coverage()).rejects.toMatchObject({
      name: 'ApiError',
      isNetworkError: true,
    });
    await expect(api.coverage()).rejects.toThrow(/Could not reach UniScope/);
  });

  it('surfaces the server error message for a 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Institution not found.' }, 404)));
    await expect(api.institution('ror-nope')).rejects.toMatchObject({
      status: 404,
      message: 'Institution not found.',
    });
  });
});

describe('application shell', () => {
  it('renders the header, navigation and routed content together', async () => {
    const { App } = await import('../../src/App');
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('banner').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /skip to/i }).getAttribute('href')).toBe('#main');
    await waitFor(() => expect(screen.getAllByText(/Example University One/).length).toBeGreaterThan(0));
  });

  it('renders a not-found page for an unknown route', async () => {
    const { App } = await import('../../src/App');
    render(
      <MemoryRouter initialEntries={['/definitely-not-a-page']}>
        <App />
      </MemoryRouter>,
    );
    expect(document.body.textContent).toMatch(/not found|does not exist|404/i);
  });
});
