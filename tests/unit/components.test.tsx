// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SearchBar } from '../../src/components/SearchBar';
import { InstitutionCard } from '../../src/components/InstitutionCard';
import { fixtureSummary, institution } from '../helpers/fixtures';

describe('accessible search and result cards', () => {
  it('labels the search field and navigates to an encoded query URL', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<SearchBar />} />
          <Route path="/search" element={<p>search page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    const input = screen.getByLabelText(/search by university name, alternate name, city or country/i);
    await user.type(input, 'Université de Montréal');
    await user.click(screen.getByRole('button', { name: /search/i }));
    expect(screen.getByText('search page')).toBeInTheDocument();
  });

  it('gives each result a descriptive link and a visible verification label', () => {
    const record = institution();
    render(
      <MemoryRouter>
        <InstitutionCard summary={fixtureSummary(record)} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Example University One' })).toHaveAttribute(
      'href',
      '/university/ror-example-one',
    );
    expect(screen.getByText('Source-checked')).toBeInTheDocument();
    expect(screen.getByText('Oxford, United Kingdom')).toBeInTheDocument();
  });

  it('marks a directory record honestly and does not imply programme data exists', () => {
    const directory = institution({
      id: 'ror-directory',
      names: { primary: 'Directory Only University', official: null, aliases: [], localNames: [], formerNames: [] },
      recognition: [],
      listing: {
        hipo: true,
        ror: true,
        curated: false,
        scopeBasis: 'hipo-ror',
        basisNote: 'Directory-only fixture.',
      },
      programs: [],
      tuition: [],
      admissions: { requirements: [], deadlines: [], links: [] },
      verification: { level: 'directory-only', lastCheckedAt: null, checkedFacts: 0, note: 'Directory only.' },
    });
    render(
      <MemoryRouter>
        <InstitutionCard summary={fixtureSummary(directory)} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Directory record')).toBeInTheDocument();
    expect(screen.getByText('Programme data not available')).toBeInTheDocument();
    expect(screen.getByText('No source-checked fee')).toBeInTheDocument();
  });
});
