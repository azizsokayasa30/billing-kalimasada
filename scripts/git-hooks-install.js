#!/usr/bin/env node
/**
 * npm lifecycle "prepare": arahkan Git ke .githooks/ agar post-merge jalan setelah pull.
 * Aman di lingkungan tanpa .git (npm pack / CI): langsung keluar 0.
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

try {
    execSync('git rev-parse --git-dir', { cwd: root, stdio: 'ignore' });
} catch {
    process.exit(0);
}

try {
    execSync('git config core.hooksPath .githooks', { cwd: root, stdio: 'inherit' });
    process.stdout.write('[prepare] Git hooksPath = .githooks (post-merge → scripts/post-git-pull.sh)\n');
} catch (e) {
    process.stderr.write(`[prepare] Lewati set hooksPath: ${e.message}\n`);
}
