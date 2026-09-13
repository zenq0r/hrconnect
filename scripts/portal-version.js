// The portal's version: a hash of every file a browser loads for it.
//
// The update banner compares this against the version the page started with.
// It used to compare four files' ETags, so a release that changed only a module
// under app/ or a screen other than the shell showed no banner at all, and the
// open tab kept running code the server no longer had. Every file counts now,
// and the check is one request instead of four.
//
//   npm run stamp   rewrites version.json after a change
//   npm test        fails if version.json is out of date

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
}

function portalFiles(root) {
    const top = ['index.html', 'app.js', 'firebase-config.js', 'custom.css', 'tailwind.css', 'sw.js', 'manifest.json'];
    return [
        ...top.map(name => path.join(root, name)).filter(file => fs.existsSync(file)),
        ...walk(path.join(root, 'app')).filter(file => file.endsWith('.js')),
        ...walk(path.join(root, 'views')).filter(file => file.endsWith('.html')),
    ].map(file => path.relative(root, file).split(path.sep).join('/')).sort();
}

function computeVersion(root) {
    const hash = crypto.createHash('sha256');
    for (const file of portalFiles(root)) {
        // Line endings are normalised: a Windows checkout and the deployment
        // build must agree on the version of the same commit.
        const text = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
        hash.update(`${file}\n${text}\n`);
    }
    return hash.digest('hex').slice(0, 16);
}

module.exports = { computeVersion, portalFiles };

if (require.main === module) {
    const root = path.join(__dirname, '..');
    const version = computeVersion(root);
    fs.writeFileSync(path.join(root, 'version.json'), `${JSON.stringify({ version }, null, 2)}\n`);
    console.log(`version.json: ${version}`);
}
