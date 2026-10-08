#!/usr/bin/env node
/**
 * Post-build validation. Verifies that dist/ contains everything the
 * manifest references and that versions stay in sync. Fails the build
 * (exit 1) if anything is missing.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));

const required = [
  'manifest.json',
  'background.js',
  'content.js',
  'src/popup/index.html',
  'src/sidepanel/index.html',
  'src/options/index.html',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

const missing = required.filter((f) => !existsSync(join(dist, f)));

if (missing.length > 0) {
  console.error(`[prepare-dist] missing required files in dist/: ${missing.join(', ')}`);
  process.exit(1);
}

if (manifest.version !== pkg.version) {
  console.error(
    `[prepare-dist] version mismatch: manifest ${manifest.version} != package.json ${pkg.version}`,
  );
  process.exit(1);
}

const versionTs = readFileSync(resolve(process.cwd(), 'src/shared/version.ts'), 'utf8');
if (!versionTs.includes(`'${pkg.version}'`)) {
  console.error(`[prepare-dist] src/shared/version.ts is out of sync with ${pkg.version}`);
  process.exit(1);
}

let total = 0;
const sizes = required.map((f) => {
  const bytes = statSync(join(dist, f)).size;
  total += bytes;
  return `  ${f} (${(bytes / 1024).toFixed(1)} kB)`;
});

console.log('[prepare-dist] dist/ is valid and complete:');
console.log(sizes.join('\n'));
console.log(`  total (key files): ${(total / 1024).toFixed(1)} kB`);
