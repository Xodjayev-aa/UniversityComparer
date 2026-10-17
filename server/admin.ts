import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const COOKIE_NAME = 'uniscope_admin';
const SESSION_MS = 2 * 60 * 60 * 1000;

export function adminIsConfigured(
  token: string | null | undefined = process.env.ADMIN_TOKEN,
): token is string {
  return Boolean(token && token.length >= 24);
}

export function secureEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  const max = Math.max(left.length, right.length);
  const paddedLeft = Buffer.alloc(max);
  const paddedRight = Buffer.alloc(max);
  left.copy(paddedLeft);
  right.copy(paddedRight);
  return timingSafeEqual(paddedLeft, paddedRight) && left.length === right.length;
}

function sessionSecret(token: string): string {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    createHash('sha256').update(`${token}:uniscope-admin-session`).digest('hex')
  );
}

function sign(value: string, token: string): string {
  return createHmac('sha256', sessionSecret(token)).update(value).digest('hex');
}

export function createSession(token: string): { cookie: string; maxAge: number } {
  const expires = Date.now() + SESSION_MS;
  const value = `${expires}.${sign(String(expires), token)}`;
  return { cookie: `${COOKIE_NAME}=${value}`, maxAge: Math.floor(SESSION_MS / 1000) };
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function hasValidSession(
  req: Request,
  token: string | null | undefined = process.env.ADMIN_TOKEN,
): boolean {
  if (!adminIsConfigured(token)) return false;
  const raw = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!raw) return false;
  const [expiresText, signature] = raw.split('.');
  if (!expiresText || !signature) return false;
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = sign(expiresText, token);
  return secureEquals(signature, expected);
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Max-Age=0; Path=/api/admin; HttpOnly; SameSite=Strict${secure}`;
}

export function sameOrigin(req: Request): boolean {
  const origin = req.get('origin');
  const host = req.get('host');
  if (!origin) {
    const fetchSite = req.get('sec-fetch-site');
    return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
  }
  if (!host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === host;
  } catch {
    return false;
  }
}

export function sessionCookieAttributes(maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Max-Age=${maxAge}; Path=/api/admin; HttpOnly; SameSite=Strict${secure}`;
}
