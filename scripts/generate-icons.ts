/**
 * Rasterize the original UniScope SVG mark into the PNG sizes required by
 * Android/Chrome PWA installation and iOS home screens.
 *
 * Run: npx tsx scripts/generate-icons.ts
 * sharp is a dev dependency; generated icons are committed so the app can be
 * built without it.
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const icons = path.join(root, 'public', 'icons');

const jobs = [
  { source: 'logo-source.svg', out: 'icon-512.png', size: 512 },
  { source: 'logo-source.svg', out: 'icon-192.png', size: 192 },
  { source: 'maskable-source.svg', out: 'maskable-512.png', size: 512 },
  { source: 'maskable-source.svg', out: 'maskable-192.png', size: 192 },
  { source: 'logo-source.svg', out: 'apple-touch-icon.png', size: 180 },
  { source: 'favicon.svg', out: 'favicon-32.png', size: 32 },
];

for (const job of jobs) {
  const svg = await readFile(path.join(icons, job.source));
  await sharp(svg, { density: 384 }).resize(job.size, job.size).png({ compressionLevel: 9 }).toFile(path.join(icons, job.out));
  console.log(`wrote ${job.out} (${job.size}x${job.size})`);
}
