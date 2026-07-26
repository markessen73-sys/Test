/**
 * Scan public/assets/* and write manifest.json listing available layer indices.
 * Indices are parsed from filenames: 1.png, 02.webp, head-3.png → 1, 2, 3.
 */
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_ROOT = resolve(__dirname, '../public/assets');
const MANIFEST_PATH = resolve(ASSETS_ROOT, 'manifest.json');

/** Folder name on disk → JSON key in Character config */
export const LAYER_FOLDERS = [
  'head',
  'skin',
  'ears',
  'eyes',
  'eyebrows',
  'noses',
  'mouths',
  'hair',
  'beards',
  'glasses',
  'accessories',
];

const IMAGE_EXT = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg']);

function parseIndex(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const m = base.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function scanFolder(folder) {
  const dir = resolve(ASSETS_ROOT, folder);
  if (!existsSync(dir)) return [];
  const indices = new Set();
  for (const name of readdirSync(dir)) {
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const idx = parseIndex(name);
    if (idx != null && idx > 0) indices.add(idx);
  }
  return [...indices].sort((a, b) => a - b);
}

function generate() {
  const layers = {};
  for (const folder of LAYER_FOLDERS) {
    layers[folder] = scanFolder(folder);
  }
  const manifest = {
    version: 1,
    canvas: { width: 512, height: 512, anchorX: 0.5, anchorY: 0.5 },
    layers,
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = generate();
  console.log('Wrote', MANIFEST_PATH);
  for (const [k, v] of Object.entries(m.layers)) {
    console.log(`  ${k}: ${v.length} asset(s)${v.length ? ` [${v.join(', ')}]` : ''}`);
  }
}

export { generate, ASSETS_ROOT, MANIFEST_PATH };
