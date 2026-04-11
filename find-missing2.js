const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');

function walk(dir) {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(walk(fullPath));
        } else if (entry.name.endsWith('.ejs')) {
            files.push(fullPath);
        }
    }
    return files;
}

const allFiles = walk(viewsDir);
const missing = [];

for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check if it has hard reload partial include or the simple_reload inline
    const hasInclude = content.includes('partials/hard-reload');
    const hasInline = content.includes('simple_reload_');
    const hasOldInline = content.includes('hReloaded_');
    
    // Check if it's a layout or partial that might not need it, but let's just log everything
    // Actually, if it includes a header that has it, it might be fine, but we want to see.
    if (!hasInclude && !hasInline && !hasOldInline) {
        // Does this file have a <head> tag or a <%- content %> tag (layout)?
        if (content.includes('<head>') || content.toLowerCase().includes('<!doctype html>')) {
            missing.push({ type: 'Full HTML Page', file: file.replace(__dirname, '') });
        } else {
            // Might be a fragment. Does it have an include for a header?
            // E.g. include('partials/header')
            if (!content.includes('header') && !content.includes('navbar') && !file.includes(path.sep + 'partials' + path.sep)) {
                missing.push({ type: 'Fragment w/o Header', file: file.replace(__dirname, '') });
            }
        }
    }
}

console.log('--- MISSING RELOAD LOGIC ---');
for (const m of missing) {
    console.log(`[${m.type}] ${m.file}`);
}
console.log(`Total missing: ${missing.length}`);
