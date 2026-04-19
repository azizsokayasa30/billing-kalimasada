const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');
const missing = [];

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
        } else if (entry.name.endsWith('.ejs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (!content.includes('partials/hard-reload') && !content.includes('simple_reload_')) {
                // If it includes another partial that MIGHT include it, it's tricky.
                // Let's just list ALL files that don't directly have the script or include it.
                missing.push(fullPath.replace(__dirname, ''));
            }
        }
    }
}

walk(viewsDir);
console.log('Files with NO explicit reload script:');
console.log(missing.join('\n'));
console.log('Total: ' + missing.length);
