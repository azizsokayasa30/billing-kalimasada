/**
 * inject-theme-patch.js
 * Adds <link href="/css/theme-patch.css?v=1"> after every theme-overrides.css
 * link in all EJS files that do NOT use a header partial.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const DIRS = [
  'views/admin/billing',
  'views/collector',
  'views/admin',
];

const FIND    = `<link href="/css/theme-overrides.css?v=1" rel="stylesheet">`;
const INJECT  = `<link href="/css/theme-patch.css?v=1" rel="stylesheet">`;
const ALREADY = `theme-patch.css`;

let count = 0;

DIRS.forEach(dir => {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return;

  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.ejs'));

  files.forEach(file => {
    const filePath = path.join(fullDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Skip if already has theme-patch.css
    if (content.includes(ALREADY)) return;

    // Only inject if file has the overrides link (inline theme injection)
    if (!content.includes(FIND)) return;

    content = content.replace(FIND, `${FIND}\n    ${INJECT}`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ Injected: ${path.relative(ROOT, filePath)}`);
    count++;
  });
});

console.log(`\nTotal files injected: ${count}`);
