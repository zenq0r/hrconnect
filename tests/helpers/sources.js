// Source access for the test suite.
//
// The portal is no longer one app.js and one index.html: the JavaScript is
// split across app/ and the signed-in markup is split across views/, so a
// visitor who never signs in never downloads either. These tests read source
// text rather than running a browser, so asking for 'app.js' here returns the
// entry file *and* every module under app/, and asking for 'index.html'
// returns the shell *and* every view fragment. A method or a template block is
// then found wherever it now lives.
//
// Tests that lift real code out and evaluate it should use methodSource() /
// constantSource() rather than slicing between two markers: a slice between
// two names that now live in different modules would swallow the module
// boundary (imports and all) and fail as a syntax error.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap(entry => {
            const full = path.join(dir, entry.name);
            return entry.isDirectory() ? walk(full) : [full];
        });
}

const read = (file) => fs.readFileSync(file, 'utf8');

function appFiles() {
    return [path.join(ROOT, 'app.js'), ...walk(path.join(ROOT, 'app')).filter(f => f.endsWith('.js'))];
}

function markupFiles() {
    return [path.join(ROOT, 'index.html'), ...walk(path.join(ROOT, 'views')).filter(f => f.endsWith('.html'))];
}

// Every file the browser loads for the portal itself, repository-relative.
function portalSourceFiles() {
    return [...markupFiles(), ...appFiles(), path.join(ROOT, 'firebase-config.js'), path.join(ROOT, 'sw.js')]
        .map(file => path.relative(ROOT, file).split(path.sep).join('/'));
}

function readSource(...parts) {
    const name = parts.join('/');
    if (name === 'app.js') return appFiles().map(read).join('\n');
    if (name === 'index.html') return markupFiles().map(read).join('\n');
    return read(path.join(ROOT, name));
}

// Lifts whole `name(args) { ... }` members out of the portal's method modules,
// in the order asked for, as text that can be dropped straight into an object
// literal.
function methodSource(...names) {
    const src = readSource('app.js');
    return names.map(name => {
        const start = ['\n        ' + name + '(', '\n        async ' + name + '(']
            .map(marker => src.indexOf(marker))
            .filter(index => index > -1)
            .sort((a, b) => a - b)[0];
        assert.ok(start !== undefined, `method ${name} is no longer in the portal source`);
        const firstLineEnd = src.indexOf('\n', start + 1);
        const firstLine = src.slice(start + 1, firstLineEnd);
        // A one-line member carries its own closing brace.
        const oneLiner = (firstLine.match(/\{/g) || []).length === (firstLine.match(/\}/g) || []).length;
        const body = oneLiner ? firstLine : (() => {
            // Otherwise it ends at the first `        }` sitting at member level.
            const end = src.slice(start + 1).search(/\n {8}\},?(?=\r?\n)/);
            assert.ok(end > -1, `could not delimit ${name}`);
            return src.slice(start + 1, start + 1 + end) + '\n        }';
        })();
        return body.replace(/,\s*$/, '') + ',';
    }).join('\n');
}

// Lifts whole top-level `const NAME = ...;` / `function NAME(...)` declarations,
// minus the `export`.
function constantSource(...names) {
    const src = readSource('app.js');
    return names.map(name => {
        const match = src.match(new RegExp('^export (?:const|let|function) ' + name + '\\b.*$', 'm'));
        assert.ok(match, `${name} is no longer in the portal source`);
        const firstLine = match[0];
        if (/^export (?:const|let)/.test(firstLine) && firstLine.trimEnd().endsWith(';')) {
            return firstLine.replace(/^export /, '');
        }
        // Everything else closes on a line of its own at column zero.
        const rest = src.slice(match.index + firstLine.length);
        const isFunction = /^export function/.test(firstLine);
        const end = rest.search(isFunction ? /\n\}(?=\r?\n)/ : /\n[\]}];/);
        assert.ok(end > -1, `could not delimit ${name}`);
        const closeText = isFunction ? '\n}' : rest.slice(end, end + 3);
        return (firstLine + rest.slice(0, end) + closeText).replace(/^export /, '');
    }).join('\n');
}

module.exports = { ROOT, readSource, methodSource, constantSource, appFiles, markupFiles, portalSourceFiles };
