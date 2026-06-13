#!/usr/bin/env node
// Re-applies the _global-error build patch after npm install.
// Fixes: Next.js 16.2.9 + React 19 + Turbopack bug (digest 1006866369)
// where /_global-error static prerender failure causes the entire build to fail.

const fs = require('fs');
const path = require('path');

const exportIndexPath = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'export', 'index.js');

if (!fs.existsSync(exportIndexPath)) {
  console.log('[patch-next] node_modules/next not found — skipping patch');
  process.exit(0);
}

const content = fs.readFileSync(exportIndexPath, 'utf8');
const marker = 'failedExportAttemptsByPage.delete("/_global-error/page: /_global-error");';

if (content.includes(marker)) {
  console.log('[patch-next] patch already applied — skipping');
  process.exit(0);
}

const target = 'if (failedExportAttemptsByPage.size > 0) {';
if (!content.includes(target)) {
  console.warn('[patch-next] WARNING: target string not found — Next.js version may have changed, patch skipped');
  process.exit(0);
}

const patched = content.replace(target, `${marker}\n    ${target}`);
fs.writeFileSync(exportIndexPath, patched, 'utf8');
console.log('[patch-next] patch applied successfully');
