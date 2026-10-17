import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const config = readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

describe('installable PWA configuration', () => {
  it('declares a standalone manifest with original regular and maskable icons', () => {
    expect(config).toContain("display: 'standalone'");
    expect(config).toContain('allowedHosts: true');
    expect(config).toContain("name: 'UniScope");
    expect(config).toContain("purpose: 'any'");
    expect(config).toContain("purpose: 'maskable'");
    expect(config).toContain("theme_color: '#0e2a2a'");
    expect(config).toContain('shortcuts:');
    expect(config).toContain("url: '/search'");
  });

  it('serves API requests from the network and never caches them as offline data', () => {
    expect(config).toContain("url.pathname.startsWith('/api/')");
    expect(config).toContain("handler: 'NetworkOnly'");
  });

  it('has a responsive viewport without disabling pinch zoom', () => {
    expect(html).toContain('width=device-width');
    expect(html).not.toMatch(/maximum-scale|user-scalable=no/);
    expect(html).toContain('theme-color');
  });

  it('ships icons at the declared sizes', async () => {
    for (const [file, size] of [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['maskable-192.png', 192],
      ['maskable-512.png', 512],
      ['apple-touch-icon.png', 180],
    ] as const) {
      const metadata = await sharp(path.join(root, 'public', 'icons', file)).metadata();
      expect(metadata.width).toBe(size);
      expect(metadata.height).toBe(size);
    }
  });
});
