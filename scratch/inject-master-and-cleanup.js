/**
 * inject-master-and-cleanup.js
 * 1. Replaces theme-patch.css link with theme-master.css in all EJS files
 * 2. If file doesn't have theme-patch yet, adds theme-master after theme-overrides
 * 3. Removes duplicate/old theme-patch.css links
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const DIRS = [
  'views/admin/billing',
  'views/collector',
  'views/admin',
  'views/partials',
];

const TS = Date.now();
const MASTER_LINK = `<link href="/css/theme-master.css?v=${TS}" rel="stylesheet">`;
const OVERRIDES_TAG = /(<link[^>]+theme-overrides\.css[^>]+>)/i;
const PATCH_TAG     = /<link[^>]+theme-patch\.css[^>]+>\s*\n?/gi;
const MASTER_TAG    = /<link[^>]+theme-master\.css[^>]+>\s*\n?/gi;

let injected = 0;
let cleaned  = 0;

DIRS.forEach(dir => {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return;

  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.ejs'));

  files.forEach(file => {
    const filePath = path.join(fullDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Step 1: Remove all old theme-patch.css links
    const hadPatch = PATCH_TAG.test(content);
    PATCH_TAG.lastIndex = 0;
    content = content.replace(PATCH_TAG, '');

    // Step 2: Remove existing theme-master.css links (avoid duplicates)
    MASTER_TAG.lastIndex = 0;
    content = content.replace(MASTER_TAG, '');

    // Step 3: Add theme-master.css after theme-overrides.css
    const hadOverrides = OVERRIDES_TAG.test(content);
    if (hadOverrides) {
      content = content.replace(OVERRIDES_TAG, `$1\n    ${MASTER_LINK}`);
      injected++;
    }

    fs.writeFileSync(filePath, content, 'utf8');

    if (hadPatch) {
      cleaned++;
      console.log(`  🧹 Cleaned + injected: ${path.relative(ROOT, filePath)}`);
    } else if (hadOverrides) {
      console.log(`  ✅ Injected: ${path.relative(ROOT, filePath)}`);
    }
  });
});

console.log(`\nFiles injected with theme-master.css: ${injected}`);
console.log(`Files cleaned from theme-patch.css  : ${cleaned}`);
