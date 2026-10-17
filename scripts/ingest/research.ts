import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type {
  AdmissionRequirement,
  Campus,
  DeadlineFact,
  FeeFact,
  Institution,
  OfficialLink,
  Program,
  Recognition,
  Scholarship,
  SourceRef,
} from '../../shared/types';
import { canonicalDomain, foldText } from '../../shared/text';
import { institutionSchema, researchFileSchema, type ResearchFileInput } from '../../shared/schema';

type CompactSource = ResearchFileInput['sources'][string];

export interface ResearchResult {
  records: Institution[];
  profiles: number;
  facts: number;
  files: string[];
  warnings: string[];
}

function expandSource(source: CompactSource): SourceRef {
  return {
    url: source.url,
    title: source.title,
    publisher: source.publisher,
    retrievedAt: source.retrievedAt,
    publishedAt: source.publishedAt ?? null,
    effectiveAt: source.effectiveAt ?? null,
    license: source.license ?? null,
  };
}

function uniqueSources(sources: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  const result: SourceRef[] = [];
  for (const source of sources) {
    const key = source.url.replace(/#.*$/, '').replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function latestDate(sources: SourceRef[]): string | null {
  return sources.reduce<string | null>((latest, source) => (!latest || source.retrievedAt > latest ? source.retrievedAt : latest), null);
}

function safeId(value: string, fallback: string): string {
  const cleaned = foldText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return cleaned.length >= 3 ? cleaned : fallback;
}

export async function loadResearchFiles(directory: string): Promise<{ files: string[]; research: ResearchFileInput[] }> {
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return { files: [], research: [] };
  }
  const files = entries.filter((name) => name.endsWith('.json')).sort();
  const research: ResearchFileInput[] = [];
  for (const file of files) {
    const fullPath = path.join(directory, file);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(fullPath, 'utf8'));
    } catch (error) {
      throw new Error(`${file}: invalid JSON — ${error instanceof Error ? error.message : String(error)}`);
    }
    const parsed = researchFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `${file}: research schema failed\n${parsed.error.issues
          .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('\n')}`,
      );
    }
    research.push(parsed.data);
  }
  return { files, research };
}

function findMatch(record: Institution, research: ResearchFileInput): boolean {
  if (research.match.rorId) {
    const suffix = research.match.rorId.replace(/\/+$/, '').split('/').pop();
    if (record.rorId && suffix && record.rorId.endsWith(suffix)) return true;
  }
  if (research.match.domains.length > 0) {
    const domains = new Set(record.domains);
    if (
      research.match.domains.some((domain) => {
        const canonical = canonicalDomain(domain);
        return canonical ? domains.has(canonical) : false;
      })
    ) {
      return true;
    }
  }
  return (
    record.country.code === research.match.countryCode &&
    foldText(record.names.primary) === foldText(research.match.name)
  );
}

function matchRecord(
  research: ResearchFileInput,
  candidates: Institution[],
  file: string,
): Institution | null {
  const matches = candidates.filter((candidate) => findMatch(candidate, research));
  const byName = matches.filter(
    (candidate) =>
      candidate.country.code === research.match.countryCode &&
      foldText(candidate.names.primary) === foldText(research.match.name),
  );
  const chosen = byName.length === 1 ? byName : matches.length === 1 ? matches : null;
  if (chosen) return chosen[0] ?? null;
  if (matches.length > 1) {
    throw new Error(
      `${file}: ambiguous directory match (${matches.map((item) => item.id).join(', ')}). Add match.rorId or a unique domain.`,
    );
  }
  return null;
}

function expandFee(
  input: ResearchFileInput['tuition'][number],
  sources: Record<string, SourceRef>,
  id: string,
  context: { degreeLevel: Program['degreeLevel'] | null; programId: string | null; key: string },
): FeeFact {
  if (!context.degreeLevel) {
    throw new Error(`${context.key}: an institution-wide fee needs an explicit degreeLevel`);
  }
  return {
    id: input.id ?? id,
    label: input.label,
    amount: input.amount,
    unit: input.unit,
    coverage: input.coverage,
    academicYear: input.academicYear,
    intake: input.intake ?? null,
    applicantCategory: input.applicantCategory,
    degreeLevel: context.degreeLevel,
    studyMode: input.studyMode ?? null,
    campus: input.campus ?? null,
    programId: context.programId,
    notes: input.notes ?? null,
    source: sources[input.source]!,
    verification: 'official-source-checked',
  };
}

function expandDeadline(
  input: ResearchFileInput['admissions']['deadlines'][number],
  sources: Record<string, SourceRef>,
  id: string,
  context: { degreeLevel: Program['degreeLevel']; programId: string | null },
): DeadlineFact {
  return {
    id: input.id ?? id,
    date: input.date ?? null,
    dateText: input.dateText,
    intake: input.intake,
    academicYear: input.academicYear,
    applicantCategory: input.applicantCategory,
    degreeLevel: context.degreeLevel,
    programId: context.programId,
    notes: input.notes ?? null,
    source: sources[input.source]!,
    verification: 'official-source-checked',
  };
}

function applyResearch(record: Institution, research: ResearchFileInput, key: string): { record: Institution; facts: number } {
  const sources = Object.fromEntries(
    Object.entries(research.sources).map(([sourceKey, source]) => [sourceKey, expandSource(source)]),
  ) as Record<string, SourceRef>;
  const usedSources: SourceRef[] = [sources[research.profileSource]!];
  let facts = 1; // profile identity (name/website) is itself a sourced claim

  const programs: Program[] = research.programs.map((program, index) => {
    const programId = program.id ?? `p-${safeId(key, 'profile')}-${index + 1}`;
    usedSources.push(sources[program.source]!);
    facts += 1;
    const tuition = program.tuition.map((fee, feeIndex) => {
      const expanded = expandFee(
        fee,
        sources,
        `pf-${safeId(key, 'profile')}-${index + 1}-${feeIndex + 1}`,
        { degreeLevel: program.degreeLevel, programId, key },
      );
      usedSources.push(expanded.source);
      facts += 1;
      return expanded;
    });
    const deadlines = program.deadlines.map((deadline, deadlineIndex) => {
      const expanded = expandDeadline(
        deadline,
        sources,
        `pd-${safeId(key, 'profile')}-${index + 1}-${deadlineIndex + 1}`,
        { degreeLevel: program.degreeLevel, programId },
      );
      usedSources.push(expanded.source);
      facts += 1;
      return expanded;
    });
    return {
      id: programId,
      name: program.name,
      degreeLevel: program.degreeLevel,
      subjectArea: program.subjectArea,
      language: program.language ?? null,
      studyModes: program.studyModes,
      duration: program.duration ?? null,
      campus: program.campus ?? null,
      faculty: program.faculty ?? null,
      admissionsUrl: program.admissionsUrl ?? null,
      source: sources[program.source]!,
      verification: 'official-source-checked',
      tuition,
      deadlines,
      notes: program.notes ?? null,
    };
  });

  const tuition: FeeFact[] = research.tuition.map((fee, index) => {
    const expanded = expandFee(fee, sources, `f-${safeId(key, 'profile')}-${index + 1}`, {
      degreeLevel: fee.degreeLevel ?? null,
      programId: null,
      key: `${key} tuition[${index}]`,
    });
    usedSources.push(expanded.source);
    facts += 1;
    return expanded;
  });

  const deadlines: DeadlineFact[] = research.admissions.deadlines.map((deadline, index) => {
    if (!deadline.degreeLevel) {
      throw new Error(`${key}: an institution-wide deadline needs an explicit degreeLevel`);
    }
    const expanded = expandDeadline(deadline, sources, `d-${safeId(key, 'profile')}-${index + 1}`, {
      degreeLevel: deadline.degreeLevel,
      programId: null,
    });
    usedSources.push(expanded.source);
    facts += 1;
    return expanded;
  });

  const requirements: AdmissionRequirement[] = research.admissions.requirements.map((requirement, index) => {
    const expanded: AdmissionRequirement = {
      id: requirement.id ?? `req-${safeId(key, 'profile')}-${index + 1}`,
      text: requirement.text,
      degreeLevel: requirement.degreeLevel,
      applicantCategory: requirement.applicantCategory,
      academicYear: requirement.academicYear,
      intake: requirement.intake ?? null,
      source: sources[requirement.source]!,
      verification: 'official-source-checked',
    };
    usedSources.push(expanded.source);
    facts += 1;
    return expanded;
  });

  const links: OfficialLink[] = research.admissions.links.map((link, index) => {
    const expanded: OfficialLink = {
      id: link.id ?? `lnk-${safeId(key, 'profile')}-${index + 1}`,
      label: link.label,
      kind: link.kind,
      url: link.url,
      source: sources[link.source]!,
    };
    usedSources.push(expanded.source);
    facts += 1;
    return expanded;
  });

  const recognition: Recognition[] = research.recognition.map((entry, index) => {
    const expanded: Recognition = {
      id: entry.id ?? `rec-${safeId(key, 'profile')}-${index + 1}`,
      body: entry.body,
      bodyUrl: entry.bodyUrl ?? null,
      scope: entry.scope,
      status: entry.status,
      notes: entry.notes ?? null,
      source: sources[entry.source]!,
      verification: 'official-source-checked',
    };
    usedSources.push(expanded.source);
    facts += 1;
    return expanded;
  });

  const scholarships: Scholarship[] = research.scholarships.map((entry, index) => {
    const expanded: Scholarship = {
      id: entry.id ?? `sch-${safeId(key, 'profile')}-${index + 1}`,
      name: entry.name,
      description: entry.description,
      amountText: entry.amountText ?? null,
      audience: entry.audience ?? null,
      url: entry.url,
      source: sources[entry.source]!,
      verification: 'official-source-checked',
    };
    usedSources.push(expanded.source);
    facts += 1;
    return expanded;
  });

  const campuses: Campus[] = research.campuses.map((campus, index) => {
    const expanded: Campus = {
      id: campus.id ?? `camp-${safeId(key, 'profile')}-${index + 1}`,
      name: campus.name,
      city: campus.city ?? null,
      countryCode: campus.countryCode ?? research.match.countryCode,
      source: sources[campus.source]!,
      verification: 'official-source-checked',
    };
    usedSources.push(expanded.source);
    facts += 1;
    return expanded;
  });

  const localNames = [
    ...record.names.localNames.filter((name) => name.source !== 'official'),
    ...(research.names.localNames ?? []).map((name) => ({
      lang: name.lang,
      value: name.value,
      source: 'official' as const,
      type: name.type,
    })),
  ];
  const aliases = [
    ...record.names.aliases,
    ...(research.names.aliases ?? []),
  ].filter(
    (alias, index, all) =>
      all.findIndex((candidate) => foldText(candidate) === foldText(alias)) === index,
  );
  const primary = research.names.primary?.trim() || research.match.name || record.names.primary;
  const formerNames = [...new Set([...record.names.formerNames, ...(research.names.formerNames ?? [])])];

  const allSources = uniqueSources([...usedSources, ...record.sources]);
  const languages = [...new Set([...research.languages, ...programs.map((program) => program.language).filter((value): value is string => Boolean(value))])];
  const studyModes = [...new Set([...research.studyModes, ...programs.flatMap((program) => program.studyModes)])];
  const lastCheckedAt = latestDate(usedSources);

  const curatedNote =
    'Source-checked profile: only the facts shown were read from official pages. Anything not listed remains “Not available” in this release.';

  const updated: Institution = {
    ...record,
    names: {
      primary,
      official: research.names.official ?? record.names.official ?? null,
      aliases: aliases.filter((alias) => foldText(alias) !== foldText(primary)).slice(0, 40),
      localNames: localNames.filter((name) => foldText(name.value) !== foldText(primary)).slice(0, 40),
      formerNames,
    },
    domains: [...new Set([...record.domains, ...research.match.domains.map((domain) => domain.toLowerCase().replace(/^www\./, ''))])].slice(0, 20),
    website: research.website ?? record.website,
    kind: research.kind ?? record.kind,
    scope: 'university',
    listing: {
      ...record.listing,
      curated: true,
      scopeBasis: 'source-checked',
      basisNote: 'Source-checked profile built on a directory record. Official pages were read for the facts shown.',
    },
    established: research.established ?? record.established,
    languages,
    studyModes,
    campuses,
    recognition,
    programs,
    tuition,
    scholarships,
    admissions: { requirements, deadlines, links },
    verification: {
      level: 'source-checked',
      lastCheckedAt,
      checkedFacts: facts,
      note: `We read the linked official pages on the dates shown. ${facts} sourced fact${facts === 1 ? '' : 's'} in this release. Pages can change; this is not a guarantee of currentness.`,
    },
    sources: allSources,
    dataNotes: [
      curatedNote,
      ...(record.scope === 'education' ? ['This record was previously in the broader education scope and is now presented as a university because an official page was checked.'] : []),
      ...research.dataNotes,
      ...record.dataNotes.filter((note) => note.startsWith('No city is recorded')),
    ],
  };

  const validated = institutionSchema.safeParse(updated);
  if (!validated.success) {
    throw new Error(
      `${key}: expanded profile failed validation\n${validated.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n')}`,
    );
  }
  return { record: validated.data as Institution, facts };
}

export function applyResearchFiles(records: Institution[], research: ResearchFileInput[]): ResearchResult {
  const updated = new Map(records.map((record) => [record.id, record]));
  const usedIds = new Set<string>();
  const curatedIds = new Set<string>();
  const warnings: string[] = [];
  let profiles = 0;
  let facts = 0;

  for (const entry of research) {
    if (usedIds.has(entry.match.rorId ?? entry.key)) {
      throw new Error(`${entry.key}: duplicate research entry`);
    }
    usedIds.add(entry.match.rorId ?? entry.key);
    const candidates = [...updated.values()];
    const match = matchRecord(entry, candidates, entry.key);

    if (!match) {
      if (!entry.allowUnmatched) {
        throw new Error(
          `${entry.key}: no directory record matched. Add match.rorId/domain, correct the name/country, or set allowUnmatched only when the institution is deliberately absent from the directory.`,
        );
      }
      // Deliberate absence: build a source-checked record from scratch. An
      // empty directory record is *not* added; curated facts stand alone.
      const synthetic: Institution = {
        id: `uni-${safeId(entry.key, 'profile')}`,
        rorId: null,
        domains: entry.match.domains,
        names: {
          primary: entry.names.primary ?? entry.match.name,
          official: entry.names.official ?? null,
          aliases: entry.names.aliases ?? [],
          localNames: (entry.names.localNames ?? []).map((name) => ({
            lang: name.lang,
            value: name.value,
            source: 'official' as const,
            type: name.type,
          })),
          formerNames: entry.names.formerNames ?? [],
        },
        country: { code: entry.match.countryCode, name: entry.match.countryCode },
        region: 'Other',
        locations: [],
        website: entry.website ?? null,
        kind: entry.kind ?? 'not-classified',
        scope: 'university',
        listing: {
          hipo: false,
          ror: false,
          curated: true,
          scopeBasis: 'source-checked',
          basisNote: 'Source-checked profile added directly; no directory record matched it.',
        },
        established: entry.established ?? null,
        languages: [],
        studyModes: [],
        campuses: [],
        recognition: [],
        programs: [],
        tuition: [],
        scholarships: [],
        admissions: { requirements: [], deadlines: [], links: [] },
        verification: { level: 'directory-only', lastCheckedAt: null, checkedFacts: 0, note: '' },
        sources: [],
        dataNotes: ['This institution is not present in the directory sources used by this build.'],
      };
      const applied = applyResearch(synthetic, entry, entry.key);
      updated.set(applied.record.id, applied.record);
      profiles += 1;
      facts += applied.facts;
      continue;
    }

    if (curatedIds.has(match.id)) {
      throw new Error(`${entry.key}: more than one research file targets institution ${match.id}`);
    }
    curatedIds.add(match.id);
    const applied = applyResearch(match, entry, entry.key);
    updated.set(match.id, applied.record);
    profiles += 1;
    facts += applied.facts;
    if (!applied.record.names.primary) warnings.push(`${entry.key}: empty primary name`);
  }

  return { records: [...updated.values()], profiles, facts, files: [], warnings };
}
