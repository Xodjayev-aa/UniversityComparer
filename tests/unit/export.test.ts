import { describe, expect, it } from 'vitest';
import { buildShortlistCsv, buildShortlistMarkdown } from '../../src/lib/export';
import type { SavedInstitution } from '../../src/lib/storage';
import { fixtureSummary, institution } from '../helpers/fixtures';

const record = institution();
const item: SavedInstitution = {
  id: record.id,
  savedAt: '2026-10-17T10:00:00.000Z',
  summary: fixtureSummary(record),
  full: record,
  notes: '=HYPERLINK("https://evil.example")',
};

const second: SavedInstitution = {
  ...item,
  id: 'ror-example-two',
  summary: { ...item.summary, id: 'ror-example-two', name: 'Example, "Two"' },
  notes: 'Another private note',
};

describe('shortlist export', () => {
  it('quotes CSV cells, escapes quotes and blocks spreadsheet formula injection', () => {
    const csv = buildShortlistCsv([item, second], true);
    expect(csv.split('\n')[0]).toContain('Private notes');
    expect(csv).toContain('"Example, ""Two"""');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain('\n=HYPERLINK');
  });

  it('excludes private notes from CSV and Markdown by default', () => {
    const csv = buildShortlistCsv([item], false);
    const markdown = buildShortlistMarkdown([item], false);
    expect(csv).not.toContain('=HYPERLINK');
    expect(markdown).not.toContain('=HYPERLINK');
    expect(markdown).toContain('Private notes are not included.');
  });

  it('warns when private notes are included in an export', () => {
    const markdown = buildShortlistMarkdown([item], true);
    expect(markdown).toContain('Private notes are included');
    expect(markdown).toContain('=HYPERLINK');
    expect(markdown).toContain('snapshot, not a live check');
  });

  it('states the saved date and source-checked status without promising freshness', () => {
    const markdown = buildShortlistMarkdown([item], false);
    expect(markdown).toContain('Exported 20');
    expect(markdown).toContain('## Example University One');
    expect(markdown).toContain('Source-checked');
  });
});
