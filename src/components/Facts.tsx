import type {
  AdmissionRequirement,
  DeadlineFact,
  FeeFact,
  Program,
  Recognition,
  Scholarship,
} from '../../shared/types';
import { DEGREE_LABELS, FEE_COVERAGE_LABELS, FEE_UNIT_LABELS, STUDY_MODE_LABELS, subjectLabel } from '../../shared/taxonomy';
import {
  deadlineContext,
  deadlineTiming,
  feeContext,
  formatDate,
  formatFeeAmount,
  programContext,
  safeHttpUrl,
  sourceAge,
} from '../lib/format';
import { Badge } from './Badge';
import { FactSource } from './Provenance';
import { Missing } from './States';

export function FeeTable({
  facts,
  showProgramme = false,
  emptyMessage = 'No source-checked fee fact is available. “Not available” does not mean free, and no number has been guessed.',
}: {
  facts: FeeFact[];
  showProgramme?: boolean;
  emptyMessage?: string;
}) {
  if (facts.length === 0) {
    return <p className="data-empty">{emptyMessage}</p>;
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Fee facts with their applicant category, academic year and source</caption>
        <thead>
          <tr>
            <th scope="col">Amount</th>
            <th scope="col">Applies to</th>
            <th scope="col">Unit and coverage</th>
            {showProgramme ? <th scope="col">Programme</th> : null}
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {facts.map((fee) => (
            <tr key={fee.id}>
              <td>
                <strong>{formatFeeAmount(fee.amount)}</strong>
                {fee.amount.kind === 'range' ? (
                  <>
                    {' '}
                    <Badge tone="muted">Published range</Badge>
                  </>
                ) : null}
                <div className="cell-note">{fee.label}</div>
              </td>
              <td>
                <div>{feeContext(fee)}</div>
                {fee.intake ? <div className="cell-note">Intake: {fee.intake}</div> : null}
                {fee.notes ? <div className="cell-note">{fee.notes}</div> : null}
              </td>
              <td>
                <div>{FEE_UNIT_LABELS[fee.unit]}</div>
                <div className="cell-note">{FEE_COVERAGE_LABELS[fee.coverage]}</div>
                <div className="cell-note">
                  {fee.studyMode ? STUDY_MODE_LABELS[fee.studyMode] : 'Study mode not specified'}
                </div>
              </td>
              {showProgramme ? (
                <td>{fee.programId ? <span className="mono-small">{fee.programId}</span> : 'Institution-wide'}</td>
              ) : null}
              <td>
                <FactSource source={fee.source} compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeadlineList({
  deadlines,
  emptyMessage = 'No source-checked deadline is available for this scope.',
}: {
  deadlines: DeadlineFact[];
  emptyMessage?: string;
}) {
  if (deadlines.length === 0) return <p className="data-empty">{emptyMessage}</p>;
  const sorted = [...deadlines].sort((a, b) => {
    const left = a.date ? Date.parse(`${a.date}T00:00:00Z`) : Number.POSITIVE_INFINITY;
    const right = b.date ? Date.parse(`${b.date}T00:00:00Z`) : Number.POSITIVE_INFINITY;
    return left - right;
  });
  return (
    <ul className="fact-list">
      {sorted.map((deadline) => {
        const timing = deadlineTiming(deadline);
        return (
          <li className="fact-card" key={deadline.id}>
            <div className="fact-card__head">
              <div>
                <div className="fact-card__value">{deadline.dateText}</div>
                {deadline.date ? <div className="cell-note">Recorded date: {formatDate(deadline.date)}</div> : null}
              </div>
              <Badge tone={timing.tone === 'passed' ? 'caution' : timing.tone === 'soon' ? 'positive' : 'muted'}>
                {timing.label}
              </Badge>
            </div>
            <p className="fact-card__context">{deadlineContext(deadline)}</p>
            {deadline.notes ? <p className="cell-note">{deadline.notes}</p> : null}
            <p className="fact-card__caution">
              A listed date is not a promise of admission or of the next cycle’s date. Check the official page.
            </p>
            <FactSource source={deadline.source} compact />
          </li>
        );
      })}
    </ul>
  );
}

export function ProgramCard({ program }: { program: Program }) {
  return (
    <details className="program" id={`program-${program.id}`}>
      <summary>
        <div className="program__summary">
          <div>
            <h3>{program.name}</h3>
            <p className="program__meta">{programContext(program)}</p>
          </div>
          <div className="program__badges">
            <Badge tone="outline">{DEGREE_LABELS[program.degreeLevel]}</Badge>
            <Badge tone="muted">{subjectLabel(program.subjectArea)}</Badge>
            <span className="program__chevron" aria-hidden="true">⌄</span>
          </div>
        </div>
      </summary>
      <div className="program__body">
        <div className="program__links">
          {program.admissionsUrl ? (
            <a className="text-link" href={program.admissionsUrl} target="_blank" rel="noopener noreferrer">
              Official programme/admissions page
              <span aria-hidden="true"> ↗</span>
            </a>
          ) : (
            <span className="cell-note">No programme-specific admissions link in this release.</span>
          )}
          <FactSource source={program.source} compact />
        </div>
        {program.notes ? <p className="cell-note">{program.notes}</p> : null}
        <div className="program__grid">
          <div>
            <h4>Programme fees</h4>
            <FeeTable
              facts={program.tuition}
              emptyMessage="No programme-level fee fact in this release. See the institution-wide costs section; no fee has been inferred."
            />
          </div>
          <div>
            <h4>Programme deadlines</h4>
            <DeadlineList
              deadlines={program.deadlines}
              emptyMessage="No programme-specific deadline in this release. Check the university-wide deadlines and the official programme page."
            />
          </div>
        </div>
      </div>
    </details>
  );
}

export function RecognitionCard({ recognition }: { recognition: Recognition }) {
  const bodyUrl = safeHttpUrl(recognition.bodyUrl);
  return (
    <article className="recognition-card">
      <div className="recognition-card__head">
        <h3>{recognition.body}</h3>
        <Badge tone={recognition.verification === 'official-source-checked' ? 'positive' : 'caution'}>
          {recognition.status}
        </Badge>
      </div>
      <p>{recognition.scope}</p>
      {bodyUrl ? (
        <a className="text-link" href={bodyUrl} target="_blank" rel="noopener noreferrer">
          Authority website
          <span aria-hidden="true"> ↗</span>
        </a>
      ) : null}
      {recognition.notes ? <p className="cell-note">{recognition.notes}</p> : null}
      <FactSource source={recognition.source} compact />
    </article>
  );
}

export function ScholarshipCard({ scholarship }: { scholarship: Scholarship }) {
  const url = safeHttpUrl(scholarship.url);
  return (
    <article className="recognition-card">
      <div className="recognition-card__head">
        <h3>{scholarship.name}</h3>
        {scholarship.amountText ? <Badge tone="outline">{scholarship.amountText}</Badge> : <Badge tone="muted">Amount not stated</Badge>}
      </div>
      <p>{scholarship.description}</p>
      {scholarship.audience ? <p className="cell-note">Audience: {scholarship.audience}</p> : null}
      {url ? (
        <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">
          Official scholarship page
          <span aria-hidden="true"> ↗</span>
        </a>
      ) : null}
      <FactSource source={scholarship.source} compact />
    </article>
  );
}

export function RequirementsList({ requirements }: { requirements: AdmissionRequirement[] }) {
  if (requirements.length === 0) {
    return (
      <p className="data-empty">
        No source-checked admission requirement is available. This does not mean there are no requirements. Check the
        official admissions page.
      </p>
    );
  }
  return (
    <ul className="requirement-list">
      {requirements.map((requirement) => (
        <li key={requirement.id}>
          <p>{requirement.text}</p>
          <p className="cell-note">
            {DEGREE_LABELS[requirement.degreeLevel]} · {requirement.applicantCategory}
            {requirement.academicYear ? ` · ${requirement.academicYear}` : ''}
            {requirement.intake ? ` · ${requirement.intake}` : ''}
          </p>
          <FactSource source={requirement.source} compact />
        </li>
      ))}
    </ul>
  );
}

export function LastChecked({ institution }: { institution: { verification: { lastCheckedAt: string | null; checkedFacts: number } } }) {
  if (!institution.verification.lastCheckedAt) {
    return <Missing>No official pages checked in this release</Missing>;
  }
  return (
    <span>
      {formatDate(institution.verification.lastCheckedAt)} · {sourceAge(institution.verification.lastCheckedAt)} ·{' '}
      {institution.verification.checkedFacts} sourced fact{institution.verification.checkedFacts === 1 ? '' : 's'}
    </span>
  );
}
