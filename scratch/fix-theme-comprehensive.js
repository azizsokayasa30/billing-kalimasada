/**
 * fix-theme-comprehensive.js
 * Removes hardcoded light backgrounds from all EJS files so
 * dark-theme-global.css / theme-overrides.css can take full control.
 */

const fs   = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = path.join(__dirname, '..');

// ---------- 1. Patch inline <style> inside EJS files ----------
const EJS_DIRS = [
  'views/admin/billing',
  'views/collector',
  'views/admin',
];

// Patterns to neutralize in inline <style> blocks
const INLINE_REPLACEMENTS = [
  // main-content with hardcoded #f8f9fa or similar light bg
  {
    find: /\.main-content\s*\{([^}]*background-color\s*:\s*#f8f9fa[^}]*)\}/g,
    replace: '.main-content { min-height: 100vh; }'
  },
  {
    find: /\.main-content\s*\{([^}]*background-color\s*:\s*#f1f5f9[^}]*)\}/g,
    replace: '.main-content { min-height: 100vh; }'
  },
  // body with hardcoded light gradient
  {
    find: /body\s*\{([^}]*background\s*:\s*linear-gradient\(135deg,\s*#f8f9fa[^}]*)\}/g,
    replace: 'body { min-height: 100vh; font-family: inherit; }'
  },
  {
    find: /body\s*\{([^}]*background\s*:\s*linear-gradient\(135deg,\s*#f1f5f9[^}]*)\}/g,
    replace: 'body { min-height: 100vh; font-family: inherit; }'
  },
  // report-card white background 
  {
    find: /\.report-card\s*\{([^}]*background\s*:\s*white[^}]*)\}/g,
    replace: (match, p1) => match.replace('background: white', 'background: var(--panel-bg, #ffffff)')
  },
];

let patchedCount = 0;

EJS_DIRS.forEach(dir => {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return;

  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.ejs'));

  files.forEach(file => {
    const filePath = path.join(fullDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    INLINE_REPLACEMENTS.forEach(({ find, replace }) => {
      const orig = content;
      content = content.replace(find, replace);
      if (content !== orig) changed = true;
    });

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✅ Patched: ${path.relative(ROOT, filePath)}`);
      patchedCount++;
    }
  });
});

console.log(`\nTotal EJS files patched: ${patchedCount}`);

// ---------- 2. Write a new universal theme patch CSS ----------
const PATCH_CSS_PATH = path.join(ROOT, 'public', 'css', 'theme-patch.css');

const PATCH_CSS = `/**
 * theme-patch.css — Universal theme consistency patch
 * Loaded LAST (after all other CSS) via a <link> tag
 * This is the single source of truth for background/text on body & main-content.
 *
 * Rule: CSS variables defined in theme-overrides.css drive everything here.
 */

/* ===========================================================
   BODY & ROOT BACKGROUND
   =========================================================== */

/* Default (light) */
:root body,
[data-theme="light"] body {
  background-color: #f1f5f9 !important;
  color: #0f172a !important;
}

/* Dark */
[data-theme="dark"] body,
[data-theme="dark"] html {
  background-color: #0a0f1a !important;
  color: #f1f5f9 !important;
}

/* ===========================================================
   MAIN CONTENT AREA
   Every page wraps content in .main-content — this overrides
   all hardcoded inline #f8f9fa / white values.
   =========================================================== */

:root .main-content,
[data-theme="light"] .main-content {
  background-color: #f1f5f9 !important;
  color: #0f172a !important;
}

[data-theme="dark"] .main-content {
  background-color: #0a0f1a !important;
  color: #f1f5f9 !important;
}

/* finance-modern f-main-area */
[data-theme="dark"] .f-main-area {
  background-color: transparent !important;
  color: #f1f5f9 !important;
}
[data-theme="light"] .f-main-area,
:root .f-main-area {
  background-color: transparent !important;
  color: #0f172a !important;
}

/* ===========================================================
   CARDS — dark mode proper contrast
   =========================================================== */

[data-theme="dark"] .card,
[data-theme="dark"] .f-card,
[data-theme="dark"] .f-premium-card {
  background-color: #1e293b !important;
  background-image: none !important;
  border-color: #334155 !important;
  color: #f1f5f9 !important;
}

[data-theme="dark"] .card .card-header,
[data-theme="dark"] .f-card .f-card-header {
  background-color: #243044 !important;
  border-color: #334155 !important;
  color: #f1f5f9 !important;
}

[data-theme="dark"] .card .card-body,
[data-theme="dark"] .f-card .f-card-body {
  color: #f1f5f9 !important;
}

/* Light mode card */
[data-theme="light"] .card,
:root .card {
  background-color: #ffffff !important;
  color: #0f172a !important;
}

/* ===========================================================
   TABLES — full dark support
   =========================================================== */

[data-theme="dark"] .table,
[data-theme="dark"] .table > :not(caption) > * > * {
  background-color: transparent !important;
  color: #f1f5f9 !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .table-light,
[data-theme="dark"] thead.table-light,
[data-theme="dark"] thead.table-light th,
[data-theme="dark"] .table > thead > tr > th {
  background-color: #243044 !important;
  color: #e2e8f0 !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .table-hover > tbody > tr:hover > * {
  background-color: rgba(96, 165, 250, 0.08) !important;
  color: #f1f5f9 !important;
}

[data-theme="dark"] .table-striped > tbody > tr:nth-of-type(odd) > * {
  background-color: rgba(255, 255, 255, 0.03) !important;
  color: #f1f5f9 !important;
}

/* ===========================================================
   FORMS & INPUTS — dark mode
   =========================================================== */

[data-theme="dark"] .form-control,
[data-theme="dark"] .form-select,
[data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),
[data-theme="dark"] textarea,
[data-theme="dark"] select {
  background-color: #243044 !important;
  color: #f1f5f9 !important;
  border-color: #475569 !important;
}

[data-theme="dark"] .form-control:focus,
[data-theme="dark"] .form-select:focus,
[data-theme="dark"] input:focus,
[data-theme="dark"] textarea:focus {
  background-color: #1e293b !important;
  color: #f1f5f9 !important;
  border-color: #60a5fa !important;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2) !important;
}

[data-theme="dark"] ::placeholder {
  color: #64748b !important;
  opacity: 1;
}

[data-theme="dark"] .f-input,
[data-theme="dark"] .f-select {
  background-color: #243044 !important;
  color: #f1f5f9 !important;
  border-color: #475569 !important;
}

/* ===========================================================
   MODALS
   =========================================================== */

[data-theme="dark"] .modal-content {
  background-color: #1e293b !important;
  color: #f1f5f9 !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .modal-header {
  background-color: #243044 !important;
  border-color: #334155 !important;
  color: #f1f5f9 !important;
}

[data-theme="dark"] .modal-body {
  background-color: #1e293b !important;
  color: #f1f5f9 !important;
}

[data-theme="dark"] .modal-footer {
  background-color: #243044 !important;
  border-color: #334155 !important;
}

/* ===========================================================
   TYPOGRAPHY — guaranteed contrast
   =========================================================== */

[data-theme="dark"] h1,
[data-theme="dark"] h2,
[data-theme="dark"] h3,
[data-theme="dark"] h4,
[data-theme="dark"] h5,
[data-theme="dark"] h6 {
  color: #f1f5f9 !important;
}

[data-theme="dark"] p {
  color: #cbd5e1 !important;
}

[data-theme="dark"] label,
[data-theme="dark"] .form-label {
  color: #e2e8f0 !important;
}

[data-theme="dark"] .text-muted,
[data-theme="dark"] small {
  color: #94a3b8 !important;
}

[data-theme="dark"] .text-dark {
  color: #f1f5f9 !important;
}

[data-theme="dark"] .text-black {
  color: #e2e8f0 !important;
}

[data-theme="dark"] span {
  color: inherit;
}

/* Light mode typography */
[data-theme="light"] .text-dark,
:root .text-dark {
  color: #0f172a !important;
}

/* ===========================================================
   BACKGROUND / BG-LIGHT override
   =========================================================== */

[data-theme="dark"] .bg-white,
[data-theme="dark"] .bg-light,
[data-theme="dark"] .bg-body {
  background-color: #1e293b !important;
  color: #f1f5f9 !important;
}

/* f-container and finance wrappers */
[data-theme="dark"] .f-container {
  background-color: transparent !important;
  color: #f1f5f9 !important;
}

/* report-card used in reports.ejs */
[data-theme="dark"] .report-card {
  background-color: #1e293b !important;
  color: #f1f5f9 !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .report-card .report-label,
[data-theme="dark"] .report-card .report-value,
[data-theme="dark"] .report-card .report-section h5 {
  color: #f1f5f9 !important;
}

/* stat-card in reports.ejs */
[data-theme="dark"] .stat-card {
  color: #ffffff !important;
}

/* header glass */
[data-theme="dark"] .f-header-glass {
  background: rgba(15, 23, 42, 0.9) !important;
  border-color: rgba(51, 65, 85, 0.6) !important;
  color: #f1f5f9 !important;
}

/* ===========================================================
   ALERTS — in dark mode
   =========================================================== */

[data-theme="dark"] .alert-info {
  background-color: rgba(56, 189, 248, 0.12) !important;
  border-color: rgba(56, 189, 248, 0.3) !important;
  color: #7dd3fc !important;
}

[data-theme="dark"] .alert-warning {
  background-color: rgba(252, 211, 77, 0.12) !important;
  border-color: rgba(252, 211, 77, 0.3) !important;
  color: #fef08a !important;
}

[data-theme="dark"] .alert-success {
  background-color: rgba(74, 222, 128, 0.12) !important;
  border-color: rgba(74, 222, 128, 0.3) !important;
  color: #86efac !important;
}

[data-theme="dark"] .alert-danger {
  background-color: rgba(248, 113, 113, 0.12) !important;
  border-color: rgba(248, 113, 113, 0.3) !important;
  color: #fca5a5 !important;
}

/* ===========================================================
   BREADCRUMB & BORDERS
   =========================================================== */

[data-theme="dark"] .breadcrumb {
  background-color: transparent !important;
}

[data-theme="dark"] .breadcrumb-item a {
  color: #94a3b8 !important;
}

[data-theme="dark"] .breadcrumb-item.active {
  color: #f1f5f9 !important;
}

[data-theme="dark"] .border-bottom {
  border-color: #334155 !important;
}

/* ===========================================================
   SPECIAL — pf-header
   =========================================================== */

[data-theme="dark"] .mobile-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%) !important;
  color: #ffffff !important;
}

/* ===========================================================
   LIGHT THEME — Ensure clean white/light theme too
   =========================================================== */

:root .report-card,
[data-theme="light"] .report-card {
  background-color: #ffffff !important;
  color: #0f172a !important;
}

:root .report-label,
[data-theme="light"] .report-label {
  color: #0f172a !important;
}

:root .report-value,
[data-theme="light"] .report-value {
  color: #475569 !important;
}

/* ===========================================================
   COLLECTOR PAGES & FINANCE MODERN PAGES
   (.finance-content-area is on body for finance pages)
   =========================================================== */

[data-theme="dark"] body.finance-content-area {
  background-color: #0a0f1a !important;
  color: #f1f5f9 !important;
}

[data-theme="light"] body.finance-content-area,
:root body.finance-content-area {
  background-color: #f1f5f9 !important;
  color: #0f172a !important;
}

[data-theme="dark"] .f-wrapper {
  background-color: transparent !important;
}

/* ===========================================================
   FORCE OVERRIDE on any remaining inline styles
   These target Bootstrap's own CSS variables used internally
   =========================================================== */

[data-theme="dark"] {
  --bs-body-bg: #0a0f1a;
  --bs-body-color: #f1f5f9;
  --bs-card-bg: #1e293b;
  --bs-border-color: #334155;
  --bs-table-bg: transparent;
  --bs-table-color: #f1f5f9;
  --bs-table-border-color: #334155;
  --bs-modal-bg: #1e293b;
  --bs-modal-color: #f1f5f9;
  --bs-input-bg: #243044;
  --bs-input-color: #f1f5f9;
  --bs-input-border-color: #475569;
  --bs-form-select-bg: #243044;
  --bs-dropdown-bg: #1e293b;
  --bs-dropdown-link-color: #cbd5e1;
  --bs-dropdown-border-color: #334155;
}

[data-theme="light"],
:root {
  --bs-body-bg: #f1f5f9;
  --bs-body-color: #0f172a;
  --bs-card-bg: #ffffff;
  --bs-border-color: #e2e8f0;
  --bs-table-bg: transparent;
  --bs-table-color: #0f172a;
  --bs-input-bg: #ffffff;
  --bs-input-color: #0f172a;
}
`;

fs.writeFileSync(PATCH_CSS_PATH, PATCH_CSS, 'utf8');
console.log(`\n✅ Written: public/css/theme-patch.css`);
console.log('\nDone! Now inject <link href="/css/theme-patch.css?v=1" rel="stylesheet"> into partials.');
