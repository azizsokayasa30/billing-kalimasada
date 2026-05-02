/**
 * fix-all-hardcoded-bg.js
 * 
 * Replaces ALL hardcoded white/light backgrounds inside <style> blocks
 * with CSS variables that respond to the active theme.
 * 
 * It works ONLY inside <style>...</style> blocks to avoid touching HTML attributes.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const DIRS = [
  'views/admin/billing',
  'views/collector',
  'views/admin',
];

// Replacements inside <style> blocks only
// Maps regex pattern -> replacement string (using CSS variables)
const REPLACEMENTS = [
  // background: white → var(--panel-bg, #ffffff)
  { find: /\bbackground:\s*white\b/g,             replace: 'background: var(--panel-bg, #ffffff)' },
  // background: #fff  → var(--panel-bg, #ffffff)
  { find: /\bbackground:\s*#fff\b(?!f)/g,          replace: 'background: var(--panel-bg, #ffffff)' },
  // background-color: white → var(--panel-bg, #ffffff)
  { find: /\bbackground-color:\s*white\b/g,        replace: 'background-color: var(--panel-bg, #ffffff)' },
  // background-color: #ffffff → var(--panel-bg, #ffffff)
  { find: /\bbackground-color:\s*#ffffff\b/g,      replace: 'background-color: var(--panel-bg, #ffffff)' },
  // body light bg
  { find: /\bbackground:\s*#f8f9fa\b/g,            replace: 'background: var(--bg-secondary, #f8f9fa)' },
  { find: /\bbackground-color:\s*#f8f9fa\b/g,      replace: 'background-color: var(--bg-secondary, #f8f9fa)' },
  { find: /\bbackground:\s*#f1f5f9\b/g,            replace: 'background: var(--bg-primary, #f1f5f9)' },
  { find: /\bbackground-color:\s*#f1f5f9\b/g,      replace: 'background-color: var(--bg-primary, #f1f5f9)' },
  // report-card white
  { find: /\bbackground:\s*#f4f6f8\b/g,            replace: 'background: var(--panel-accent, #f4f6f8)' },
  // color: #333 / #212529 / #1a1a1a → use text-primary var
  { find: /\bcolor:\s*#333\b/g,                    replace: 'color: var(--text-primary, #333)' },
  { find: /\bcolor:\s*#212529\b/g,                 replace: 'color: var(--text-primary, #212529)' },
  { find: /\bcolor:\s*#1a1a1a\b/g,                 replace: 'color: var(--text-primary, #1a1a1a)' },
  { find: /\bcolor:\s*#2d3748\b/g,                 replace: 'color: var(--text-primary, #2d3748)' },
  // border-color light
  { find: /\bborder-color:\s*#dee2e6\b/g,          replace: 'border-color: var(--panel-border, #dee2e6)' },
  { find: /\bborder-color:\s*#e2e8f0\b/g,          replace: 'border-color: var(--panel-border, #e2e8f0)' },
  // card background
  { find: /\bbackground-color:\s*var\(--panel-bg,\s*#ffffff\)\s*!important/g, replace: 'background-color: var(--panel-bg, #ffffff) !important' },
];

function patchStyleBlocks(content) {
  // Find all <style>...</style> blocks and patch only within them
  const styleRegex = /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi;
  let changed = false;

  const patched = content.replace(styleRegex, (match, openTag, cssContent, closeTag) => {
    let newCss = cssContent;
    REPLACEMENTS.forEach(({ find, replace }) => {
      const before = newCss;
      newCss = newCss.replace(find, replace);
      if (newCss !== before) changed = true;
    });
    return `${openTag}${newCss}${closeTag}`;
  });

  return { patched, changed };
}

let totalPatched = 0;

DIRS.forEach(dir => {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return;

  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.ejs'));

  files.forEach(file => {
    const filePath = path.join(fullDir, file);
    const content  = fs.readFileSync(filePath, 'utf8');

    const { patched, changed } = patchStyleBlocks(content);

    if (changed) {
      fs.writeFileSync(filePath, patched, 'utf8');
      console.log(`  ✅ Patched: ${path.relative(ROOT, filePath)}`);
      totalPatched++;
    }
  });
});

console.log(`\nTotal EJS files patched: ${totalPatched}`);
