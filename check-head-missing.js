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
            if (content.match(/<head[^>]*>/i)) {
                if (!content.includes('partials/hard-reload') && !content.includes('simple_reload_')) {
                    missing.push(fullPath);
                }
            }
        }
    }
}

walk(viewsDir);
console.log('Files with <head> but NO reload script:');
console.log(missing.join('\n'));
console.log('Total: ' + missing.length);
