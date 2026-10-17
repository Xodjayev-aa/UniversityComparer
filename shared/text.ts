/**
 * Unicode-aware normalization used by search, deduplication and tests.
 * The goal is to match names across accents, case and common latin variants
 * without transliterating non-Latin scripts (those are preserved and can be
 * searched directly).
 */

const SPECIAL_FOLDS: Record<string, string> = {
  ø: 'o',
  Ø: 'o',
  æ: 'ae',
  Æ: 'ae',
  œ: 'oe',
  Œ: 'oe',
  ß: 'ss',
  ł: 'l',
  Ł: 'l',
  đ: 'd',
  Đ: 'd',
  ð: 'd',
  Ð: 'd',
  þ: 'th',
  Þ: 'th',
  ı: 'i',
  ĸ: 'k',
  ŋ: 'n',
};

export function foldText(input: string): string {
  if (!input) return '';
  let value = input.normalize('NFKC');
  // Strip combining marks (accents, Arabic harakat, Hebrew niqqud, Greek tonos).
  value = value.normalize('NFKD').replace(/\p{M}+/gu, '');
  // Re-compose Hangul syllables and other canonical pairs after mark removal.
  value = value.normalize('NFC');
  value = value.replace(/\u0640/g, ''); // Arabic tatweel
  value = value.replace(/[øØæÆœŒßłŁđĐðÐþÞıĸŋ]/g, (ch) => SPECIAL_FOLDS[ch] ?? ch);
  return value
    .toLocaleLowerCase('und')
    .replace(/['’`´]/g, '')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function compactText(input: string): string {
  return foldText(input).replace(/\s+/g, '');
}

export function tokenize(input: string): string[] {
  const folded = foldText(input);
  if (!folded) return [];
  return folded.split(' ').filter(Boolean);
}

/** Compare a domain list for dedupe: lowercase, no scheme/www/port/path/trailing dot. */
export function canonicalDomain(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  let host = raw;
  try {
    host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname;
  } catch {
    host = raw.split('/')[0]?.split(':')[0] ?? '';
  }
  host = host.replace(/^www\d*\./, '').replace(/\.$/, '');
  if (!host || !host.includes('.') || /\s/.test(host)) return null;
  return host;
}

export function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function slugify(input: string): string {
  const folded = foldText(input).replace(/-+/g, ' ');
  const slug = folded.replace(/\s+/g, '-').replace(/^-|-$/g, '');
  return slug.slice(0, 70) || 'institution';
}
