import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import type { HipoEntry, RorOrganisation } from './directory';

export interface ParsedRor {
  organisations: RorOrganisation[];
  releaseFile: string;
  schemaVersions: string[];
}

export async function parseRorZip(filePath: string): Promise<ParsedRor> {
  const buffer = await readFile(filePath);
  const files = unzipSync(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  const jsonName = Object.keys(files).find((name) => name.endsWith('.json'));
  if (!jsonName) throw new Error(`ROR zip ${filePath} contains no JSON file.`);
  const raw = files[jsonName];
  if (!raw) throw new Error(`Could not read ${jsonName} from the ROR zip.`);
  const text = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString('utf8');
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('The ROR JSON root is not an array.');
  const organisations = parsed as RorOrganisation[];
  const schemaVersions = new Set<string>();
  for (const organisation of organisations) {
    const version = (organisation as { admin?: { last_modified?: { schema_version?: string } } }).admin?.last_modified
      ?.schema_version;
    if (version) schemaVersions.add(version);
  }
  return {
    organisations,
    releaseFile: jsonName,
    schemaVersions: [...schemaVersions].sort(),
  };
}

export async function parseHipoJson(filePath: string): Promise<HipoEntry[]> {
  const text = await readFile(filePath, 'utf8');
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('The Hipo JSON root is not an array.');
  return (parsed as HipoEntry[]).filter(
    (entry) => typeof entry?.name === 'string' && typeof entry?.alpha_two_code === 'string',
  );
}
