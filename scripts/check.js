const { execFileSync } = require('child_process');
const { readdirSync, statSync } = require('fs');
const { join } = require('path');
const { reportForFile } = require('./check-template-nesting');

function findJavaScript(dir) {
    return readdirSync(dir).flatMap(name => {
        if (name === 'node_modules' || name === '.git') return [];
        const path = join(dir, name);
        return statSync(path).isDirectory() ? findJavaScript(path) : (path.endsWith('.js') ? [path] : []);
    });
}

for (const file of findJavaScript(process.cwd())) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

// index.html is the sign-in shell; every signed-in screen is its own file in
// views/. Each one has to nest correctly on its own, because each is compiled
// on its own at runtime.
const templates = ['index.html', ...readdirSync('views').filter(name => name.endsWith('.html')).map(name => join('views', name))];

let templatesOk = true;
for (const template of templates) {
    if (!reportForFile(template)) templatesOk = false;
}
if (!templatesOk) {
    process.exit(1);
}
