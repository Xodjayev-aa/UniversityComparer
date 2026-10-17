// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearShortlist,
  getSaved,
  loadShortlist,
  removeInstitution,
  saveInstitution,
  updateNotes,
} from '../../src/lib/storage';
import { fixtureSummary, institution } from '../helpers/fixtures';

const record = institution();

beforeEach(() => {
  window.localStorage.clear();
});

describe('local shortlist', () => {
  it('saves, loads and removes an institution without an account', () => {
    saveInstitution(fixtureSummary(record), record);
    expect(loadShortlist()).toHaveLength(1);
    expect(getSaved(record.id)?.full?.id).toBe(record.id);
    removeInstitution(record.id);
    expect(loadShortlist()).toHaveLength(0);
  });

  it('keeps private notes local and replaces them rather than duplicating the entry', () => {
    saveInstitution(fixtureSummary(record), record);
    updateNotes(record.id, 'Ask about fee waivers');
    expect(loadShortlist()).toHaveLength(1);
    expect(loadShortlist()[0]?.notes).toBe('Ask about fee waivers');
    updateNotes(record.id, 'Updated note');
    expect(loadShortlist()[0]?.notes).toBe('Updated note');
  });

  it('ignores corrupted storage instead of crashing the app', () => {
    window.localStorage.setItem('uniscope.shortlist.v1', '{not json');
    expect(loadShortlist()).toEqual([]);
    window.localStorage.setItem('uniscope.shortlist.v1', JSON.stringify([{ id: 1 }]));
    expect(loadShortlist()).toEqual([]);
  });

  it('clears the shortlist', () => {
    saveInstitution(fixtureSummary(record), record);
    clearShortlist();
    expect(loadShortlist()).toEqual([]);
  });
});
