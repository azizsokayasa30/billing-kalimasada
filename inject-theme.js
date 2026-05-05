const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let stat = fs.statSync(dirPath);
        if (stat.isDirectory()) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const injection = `
    <!-- GLOBAL THEME INJECTION -->
    <script>
      (function(){
        if(window.__theme_init) return; window.__theme_init=true;
        var t=localStorage.getItem('kalimasada_theme');
        if(!t) t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
        document.documentElement.setAttribute('data-theme',t);
      })();
    </script>
    <link href="/css/dark-theme-global.css?v=2" rel="stylesheet">
    <link href="/css/theme-system.css?v=2" rel="stylesheet">
    <link href="/css/theme-overrides.css?v=1" rel="stylesheet">
    <!-- END GLOBAL THEME INJECTION -->
</head>`;

let count = 0;
walkDir('./views', function(filePath) {
    if (filePath.endsWith('.ejs')) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Skip if already injected
        if (content.includes('GLOBAL THEME INJECTION')) return;
        
        // Skip if it doesn't have a head end tag (it's a partial without head)
        if (!content.includes('</head>')) return;
        
        // Skip if it includes header partials since those are centralized
        if (content.includes("include('partials/header')") || 
            content.includes('include("../partials/header")') ||
            content.includes('include("../partials/admin-header")')) {
            return;
        }

        // Clean up any old duplicate links to these files
        content = content.replace(/<link[^>]*href="\/css\/dark-theme-global\.css[^>]*>/g, '');
        content = content.replace(/<link[^>]*href="\/css\/theme-system\.css[^>]*>/g, '');
        content = content.replace(/<link[^>]*href="\/css\/theme-overrides\.css[^>]*>/g, '');

        // Inject our clean block right before </head>
        content = content.replace('</head>', injection);
        
        fs.writeFileSync(filePath, content, 'utf8');
        count++;
        console.log('Injected into:', filePath);
    }
});

console.log('Total files injected:', count);
