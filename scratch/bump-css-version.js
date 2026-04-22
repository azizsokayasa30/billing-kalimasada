/**
 * bump-css-version.js
 * Updates version query strings for theme CSS files in all EJS files
 * to force browsers to reload the latest CSS.
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

const VERSION = Date.now();
let count = 0;

DIRS.forEach(dir => {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return;

  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.ejs'));

  files.forEach(file => {
    const filePath = path.join(fullDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    const orig = content;

    // Bump theme-patch.css version
    content = content.replace(
      /theme-patch\.css\?v=\d+/g,
      `theme-patch.css?v=${VERSION}`
    );
    // Bump theme-overrides.css version
    content = content.replace(
      /theme-overrides\.css\?v=\d+/g,
      `theme-overrides.css?v=${VERSION}`
    );
    // Bump dark-theme-global.css version
    content = content.replace(
      /dark-theme-global\.css\?v=\d+/g,
      `dark-theme-global.css?v=${VERSION}`
    );

    if (content !== orig) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✅ Version bumped: ${path.relative(ROOT, filePath)}`);
      count++;
    }
  });
});

console.log(`\nTotal files version bumped: ${count}`);
