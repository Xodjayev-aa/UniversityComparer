import type { Institution, InstitutionSummary } from '../../shared/types';

const STORAGE_KEY = 'uniscope.shortlist.v1';
const SHORTLIST_EVENT = 'uniscope:shortlist';

export class StorageError extends Error {}

export interface SavedInstitution {
  id: string;
  savedAt: string;
  summary: InstitutionSummary;
  /** Full public profile snapshot, when saved from a profile page (for offline viewing). */
  full: Institution | null;
  /** Private, local-only note. Never sent to the server and excluded from exports by default. */
  notes: string;
}

function isSavedInstitution(value: unknown): value is SavedInstitution {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SavedInstitution>;
  return Boolean(
    item.id &&
      typeof item.id === 'string' &&
      item.summary &&
      typeof item.summary === 'object' &&
      (item.summary as InstitutionSummary).name &&
      typeof item.savedAt === 'string',
  );
}

export function loadShortlist(): SavedInstitution[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedInstitution).map((item) => ({
      ...item,
      full: item.full ?? null,
      notes: typeof item.notes === 'string' ? item.notes : '',
    }));
  } catch {
    return [];
  }
}

function persist(items: SavedInstitution[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    throw new StorageError(
      'Your browser could not save this shortlist. Private browsing or a full storage quota can block local saves.',
    );
  }
  window.dispatchEvent(new Event(SHORTLIST_EVENT));
}

export function getSaved(id: string): SavedInstitution | null {
  return loadShortlist().find((item) => item.id === id) ?? null;
}

export function saveInstitution(summary: InstitutionSummary, full: Institution | null = null): SavedInstitution {
  const items = loadShortlist();
  const existing = items.find((item) => item.id === summary.id);
  const saved: SavedInstitution = {
    id: summary.id,
    savedAt: existing?.savedAt ?? new Date().toISOString(),
    summary,
    full: full ?? existing?.full ?? null,
    notes: existing?.notes ?? '',
  };
  const next = existing ? items.map((item) => (item.id === summary.id ? saved : item)) : [...items, saved];
  persist(next);
  return saved;
}

export function removeInstitution(id: string): void {
  persist(loadShortlist().filter((item) => item.id !== id));
}

export function updateNotes(id: string, notes: string): void {
  const items = loadShortlist();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return;
  items[index] = { ...items[index]!, notes: notes.slice(0, 4_000) };
  persist(items);
}

export function clearShortlist(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    throw new StorageError('Your browser blocked access to local storage.');
  }
  window.dispatchEvent(new Event(SHORTLIST_EVENT));
}

export function subscribeShortlist(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener('storage', handler);
  window.addEventListener(SHORTLIST_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(SHORTLIST_EVENT, handler);
  };
}

export function shortlistSnapshot(items: SavedInstitution[]): string {
  return items.map((item) => `${item.id}:${item.savedAt}:${item.notes.length}`).join('|');
}
