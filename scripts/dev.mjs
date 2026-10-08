#!/usr/bin/env node
/**
 * Development watcher.
 *
 * Runs one initial full build (extension pages + background + content
 * script) so dist/ is always loadable, then keeps two vite watch
 * processes running (main build + content script build).
 */
import { spawn, execSync } from 'node:child_process';

const contentCmd = 'vite build --watch --config vite.content.config.ts';
const mainCmd = 'vite build --watch';

try {
  execSync('vite build && vite build --config vite.content.config.ts', { stdio: 'inherit' });
} catch (error) {
  console.error('[profilepack] initial build failed:', error);
  process.exit(1);
}

const procs = [
  spawn(mainCmd, { stdio: 'inherit', shell: true }),
  spawn(contentCmd, { stdio: 'inherit', shell: true }),
];

const shutdown = () => {
  for (const p of procs) p.kill();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

for (const p of procs) {
  p.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[profilepack] watcher exited with code ${code}`);
    }
  });
}
