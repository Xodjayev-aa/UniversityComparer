import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { request as httpsRequest } from 'node:https';
import path from 'node:path';
import type { SourceInfo } from '../../shared/types';

const GITHUB_API = 'https://api.github.com';
const UA = 'UniScope/0.1 data-ingestion (https://github.com/Xodjayev-aa/UniversityComparer)';

/**
 * The sandbox and some Linux images provide a system CA bundle that Node does
 * not use by default. Passing it explicitly keeps certificate verification on
 * (never disabled) while allowing the documented system trust store.
 */
const SYSTEM_CA = (() => {
  const candidate = process.env.NODE_EXTRA_CA_CERTS ?? '/etc/ssl/certs/ca-certificates.crt';
  try {
    if (candidate && existsSync(candidate)) return readFileSync(candidate);
  } catch {
    // fall back to Node's bundled roots
  }
  return undefined;
})();

export interface FetchedSource {
  path: string;
  release: string;
  publishedAt: string | null;
  retrievedAt: string;
  sha256: string;
}

interface CacheMeta {
  ror?: FetchedSource;
  hipo?: FetchedSource;
}

export const DIRECTORY_SOURCES: SourceInfo[] = [
  {
    id: 'ror',
    name: 'Research Organization Registry (ROR) data dump',
    publisher: 'ROR / California Digital Library, Crossref, DataCite',
    url: 'https://ror.readme.io/docs/data-dump',
    license: 'CC0 1.0 Universal',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    retrievedAt: '',
    release: null,
    use: 'Discovery: institution names, aliases, local-script names, country, city, website, domains and coordinates.',
    limitations:
      'ROR is a research-organisation identifier registry, not a university or accreditation register. Its “education” type includes non-university organisations. It records no programmes, fees, deadlines or accreditation status.',
  },
  {
    id: 'hipo',
    name: 'University Domains and Names Data List',
    publisher: 'Hipo (community project)',
    url: 'https://github.com/Hipo/university-domains-list',
    license: 'MIT',
    licenseUrl: 'https://github.com/Hipo/university-domains-list/blob/master/LICENSE.txt',
    retrievedAt: '',
    release: null,
    use: 'Discovery: community-maintained university/college name, country and domain listings.',
    limitations:
      'Community-maintained and not authoritative. It is not complete, does not prove university status or accreditation, includes some non-university institutions, and has no programme, fee or deadline data.',
  },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SimpleResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

function getBuffer(url: string, headers: Record<string, string>, redirects = 0): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('Too many redirects'));
      return;
    }
    const request = httpsRequest(
      url,
      {
        method: 'GET',
        headers,
        ca: SYSTEM_CA,
        timeout: 180_000,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          const next = new URL(location, url).toString();
          getBuffer(next, headers, redirects + 1).then(resolve, reject);
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 400 * 1024 * 1024) {
            request.destroy(new Error('Response exceeded the 400 MB safety limit'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({
            status,
            headers: response.headers as SimpleResponse['headers'],
            body: Buffer.concat(chunks),
          });
        });
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new Error('Request timed out after 180 seconds')));
    request.on('error', reject);
    request.end();
  });
}

function githubHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    'User-Agent': UA,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function githubJson(url: string): Promise<unknown> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await getBuffer(url, githubHeaders('application/vnd.github+json'));
      if (response.status === 403 || response.status === 429) {
        const reset = response.headers['x-ratelimit-reset'];
        const resetText =
          typeof reset === 'string' ? new Date(Number(reset) * 1000).toISOString() : 'unknown';
        throw new Error(
          `GitHub API rate limit hit (HTTP ${response.status}). Reset: ${resetText}. ` +
            'Set GITHUB_TOKEN for a higher limit, or pass a local data file via ROR_ZIP_PATH / HIPO_JSON_PATH.',
        );
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`GitHub API HTTP ${response.status} for ${url}`);
      }
      return JSON.parse(response.body.toString('utf8'));
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('GitHub API request failed');
}

async function download(
  url: string,
  destination: string,
  accept: string,
): Promise<{ sha256: string; bytes: number }> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await getBuffer(url, githubHeaders(accept));
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Download failed: HTTP ${response.status}`);
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, response.body);
      return {
        sha256: createHash('sha256').update(response.body).digest('hex'),
        bytes: response.body.length,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Download failed');
}

async function readMeta(cacheDir: string): Promise<CacheMeta> {
  try {
    return JSON.parse(await readFile(path.join(cacheDir, 'source-meta.json'), 'utf8')) as CacheMeta;
  } catch {
    return {};
  }
}

async function writeMeta(cacheDir: string, meta: CacheMeta): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(path.join(cacheDir, 'source-meta.json'), JSON.stringify(meta, null, 2));
}

interface RepoEntry {
  name: string;
  sha: string;
  size: number;
  type: string;
}

export function formatRorRelease(fileName: string): { release: string; publishedAt: string | null } {
  const version = fileName.match(/^(v\d+\.\d+(?:\.\d+)?)-/)?.[1] ?? fileName.replace(/-ror-data\.zip$/, '');
  const date = fileName.match(/(\d{4}-\d{2}-\d{2})-ror-data\.zip$/)?.[1] ?? null;
  return { release: date ? `${version} (${date})` : version, publishedAt: date };
}

export async function ensureRorZip(options: {
  cacheDir: string;
  refresh: boolean;
  offline: boolean;
}): Promise<FetchedSource> {
  if (process.env.ROR_ZIP_PATH) {
    const filePath = path.resolve(process.env.ROR_ZIP_PATH);
    const buffer = await readFile(filePath);
    const { release, publishedAt } = formatRorRelease(path.basename(filePath));
    return {
      path: filePath,
      release,
      publishedAt,
      retrievedAt: today(),
      sha256: createHash('sha256').update(buffer).digest('hex'),
    };
  }

  const meta = await readMeta(options.cacheDir);
  if (options.offline) {
    if (!meta.ror) throw new Error('Offline mode requires a cached ROR dump; none found.');
    return meta.ror;
  }

  const entries = (await githubJson(`${GITHUB_API}/repos/ror-community/ror-data/contents/`)) as RepoEntry[];
  const zips = entries
    .filter((entry) => /^v\d+\.\d+(?:\.\d+)?-\d{4}-\d{2}-\d{2}-ror-data\.zip$/.test(entry.name))
    .sort((a, b) => b.name.localeCompare(a.name));
  const latest = zips[0];
  if (!latest) throw new Error('Could not find a ROR data release zip in the ror-community/ror-data repository.');

  const cachedPath = path.join(options.cacheDir, latest.name);
  if (!options.refresh && meta.ror?.release === formatRorRelease(latest.name).release) {
    try {
      await stat(cachedPath);
      return meta.ror;
    } catch {
      // fall through to download
    }
  }

  const result = await download(
    `${GITHUB_API}/repos/ror-community/ror-data/git/blobs/${latest.sha}`,
    cachedPath,
    'application/vnd.github.raw+json',
  );
  const { release, publishedAt } = formatRorRelease(latest.name);
  const ror: FetchedSource = {
    path: cachedPath,
    release,
    publishedAt,
    retrievedAt: today(),
    sha256: result.sha256,
  };
  await writeMeta(options.cacheDir, { ...meta, ror });
  console.info(`[ingest] downloaded ROR ${release} (${(result.bytes / 1024 / 1024).toFixed(1)} MB)`);
  return ror;
}

export async function ensureHipoJson(options: {
  cacheDir: string;
  refresh: boolean;
  offline: boolean;
}): Promise<FetchedSource> {
  if (process.env.HIPO_JSON_PATH) {
    const filePath = path.resolve(process.env.HIPO_JSON_PATH);
    const buffer = await readFile(filePath);
    const sha = createHash('sha256').update(buffer).digest('hex');
    return {
      path: filePath,
      release: `snapshot sha256:${sha.slice(0, 12)}`,
      publishedAt: null,
      retrievedAt: today(),
      sha256: sha,
    };
  }

  const meta = await readMeta(options.cacheDir);
  if (options.offline) {
    if (!meta.hipo) throw new Error('Offline mode requires a cached Hipo file; none found.');
    return meta.hipo;
  }

  const contents = (await githubJson(
    `${GITHUB_API}/repos/Hipo/university-domains-list/contents/world_universities_and_domains.json`,
  )) as RepoEntry & { sha: string };
  const cachedPath = path.join(options.cacheDir, 'hipo-world-universities.json');
  const release = `snapshot sha256:${contents.sha.slice(0, 12)}`;

  if (!options.refresh && meta.hipo?.release === release) {
    try {
      await stat(cachedPath);
      return meta.hipo;
    } catch {
      // fall through
    }
  }

  const result = await download(
    `${GITHUB_API}/repos/Hipo/university-domains-list/git/blobs/${contents.sha}`,
    cachedPath,
    'application/vnd.github.raw+json',
  );
  const hipo: FetchedSource = {
    path: cachedPath,
    release,
    publishedAt: null,
    retrievedAt: today(),
    sha256: result.sha256,
  };
  await writeMeta(options.cacheDir, { ...meta, hipo });
  console.info(`[ingest] downloaded Hipo snapshot (${(result.bytes / 1024 / 1024).toFixed(1)} MB)`);
  return hipo;
}

export function sourceInfoForRun(
  id: 'ror' | 'hipo',
  fetched: FetchedSource,
): SourceInfo {
  const base = DIRECTORY_SOURCES.find((source) => source.id === id)!;
  const release =
    id === 'ror' && fetched.path.endsWith('.zip')
      ? formatRorRelease(path.basename(fetched.path)).release
      : fetched.release;
  return { ...base, release, retrievedAt: fetched.retrievedAt };
}
