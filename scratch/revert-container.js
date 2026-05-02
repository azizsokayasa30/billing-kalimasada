const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '..', 'views', 'admin', 'billing');
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.ejs'));

for (const file of files) {
    if (file === 'invoice-print.ejs') continue;
    
    const fullPath = path.join(viewsDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    // Restore container-fluid
    if (content.match(/<div class="container">/g)) {
        content = content.replace(/<div class="container">/g, '<div class="container-fluid">');
        changed = true;
    }
    if (content.match(/<div class="container px-3">/g)) {
        content = content.replace(/<div class="container px-3">/g, '<div class="container-fluid px-3">');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Reverted layout for ${file}`);
    }
}
