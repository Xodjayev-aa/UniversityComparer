import { useEffect, useState, type FormEvent } from 'react';
import type { Facets } from '../../shared/types';
import { DEGREE_LEVELS, REGION_LABELS, SUBJECTS, LANGUAGE_LABELS } from '../../shared/taxonomy';
import { Dialog } from './Dialog';

export interface FilterValues {
  country: string;
  region: string;
  degree: string;
  language: string;
  mode: string;
  subject: string;
  fees: boolean;
  profile: boolean;
}

export const EMPTY_FILTERS: FilterValues = {
  country: '',
  region: '',
  degree: '',
  language: '',
  mode: '',
  subject: '',
  fees: false,
  profile: false,
};

export function filterCount(values: FilterValues): number {
  return [
    values.country,
    values.region,
    values.degree,
    values.language,
    values.mode,
    values.subject,
    values.fees ? 'fees' : '',
    values.profile ? 'profile' : '',
  ].filter(Boolean).length;
}

export function FilterSheet({
  open,
  onClose,
  value,
  onApply,
  facets,
  loading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  value: FilterValues;
  onApply: (value: FilterValues) => void;
  facets: Facets | null;
  loading: boolean;
  error: Error | null;
}) {
  const [local, setLocal] = useState<FilterValues>(value);

  useEffect(() => {
    if (open) setLocal(value);
  }, [open, value]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply(local);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Filter results">
      <form onSubmit={submit} className="filter-form">
        <p className="filter-note">
          Programme, degree, language and fee filters only match <strong>source-checked</strong> data. A record without
          that data is excluded as unknown — it is not a claim that the university lacks it.
        </p>

        {loading ? <p className="footer-muted">Loading filter options…</p> : null}
        {error ? <p className="inline-error">Filter counts could not be loaded. You can still type a search.</p> : null}

        <div className="filter-grid">
          <div className="field">
            <label htmlFor="filter-country">Country</label>
            <select
              id="filter-country"
              value={local.country}
              onChange={(event) => setLocal({ ...local, country: event.target.value })}
            >
              <option value="">All countries</option>
              {(facets?.countries ?? [])
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                    {country.universityRecords > 0 ? ` (${country.universityRecords} university-scope)` : ' (broader records only)'}
                  </option>
                ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-region">Region</label>
            <select
              id="filter-region"
              value={local.region}
              onChange={(event) => setLocal({ ...local, region: event.target.value })}
            >
              <option value="">All regions</option>
              {Object.entries(REGION_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-degree">Degree level</label>
            <select
              id="filter-degree"
              value={local.degree}
              onChange={(event) => setLocal({ ...local, degree: event.target.value })}
            >
              <option value="">Any degree level</option>
              {DEGREE_LEVELS.map((level) => {
                const count = facets?.degreeLevels.find((item) => item.id === level.id)?.programCount ?? 0;
                return (
                  <option key={level.id} value={level.id}>
                    {level.label}
                    {facets ? (count > 0 ? ` (${count} programmes)` : ' (no source-checked programmes yet)') : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-subject">Subject area</label>
            <select
              id="filter-subject"
              value={local.subject}
              onChange={(event) => setLocal({ ...local, subject: event.target.value })}
            >
              <option value="">Any subject</option>
              {(facets?.subjects.length ? facets.subjects : SUBJECTS.map((subject) => ({
                id: subject.id,
                label: subject.label,
                programCount: 0,
                institutionCount: 0,
              }))).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                  {facets ? (subject.programCount > 0 ? ` (${subject.programCount})` : ' (no source-checked programmes yet)') : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-language">Teaching language</label>
            <select
              id="filter-language"
              value={local.language}
              onChange={(event) => setLocal({ ...local, language: event.target.value })}
            >
              <option value="">Any teaching language</option>
              {(facets?.languages ?? []).map((language) => (
                <option key={language.code} value={language.code}>
                  {LANGUAGE_LABELS[language.code] ?? language.label} ({language.programCount})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-mode">Study mode</label>
            <select
              id="filter-mode"
              value={local.mode}
              onChange={(event) => setLocal({ ...local, mode: event.target.value })}
            >
              <option value="">Any study mode</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
            </select>
          </div>
        </div>

        <div className="filter-checks">
          <label className="check">
            <input
              type="checkbox"
              checked={local.fees}
              onChange={(event) => setLocal({ ...local, fees: event.target.checked })}
            />
            <span>
              Only institutions with a source-checked fee fact
              <small>Missing fee data is excluded, never treated as zero or cheap.</small>
            </span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={local.profile}
              onChange={(event) => setLocal({ ...local, profile: event.target.checked })}
            />
            <span>
              Only source-checked profiles
              <small>A small, non-representative sample with official-page facts.</small>
            </span>
          </label>
        </div>

        <div className="dialog__actions">
          <button type="button" className="button button--ghost" onClick={() => setLocal(EMPTY_FILTERS)}>
            Reset filters
          </button>
          <div className="dialog__actions-right">
            <button type="button" className="button button--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button--primary">
              Apply filters
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
