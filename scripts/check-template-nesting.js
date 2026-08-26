// Quote-aware HTML/Vue template nesting scanner.
//
// Walks a template file character-by-character and verifies real tag
// nesting via a stack, instead of relying on open/close tag *counts* (equal
// counts do not prove correct nesting order, and a naive count can also be
// thrown off by tags mentioned inside comments or script/style bodies).
//
// It understands:
//   - quoted Vue/HTML attribute values, so a `>` or `=>` inside
//     `:class="a > b ? 'x' : 'y'"` or `@click="() => fn()"` does not end
//     the tag early (the whole attribute value is quote-tracked opaque).
//   - `<!-- ... -->` comments, skipped verbatim with NO quote-tracking
//     applied to their contents. This matters: an ordinary apostrophe in
//     comment prose (e.g. "WHAT'S NEW", a contraction, a possessive) is not
//     a delimiter, but a naive scanner that quote-tracks through comments
//     will read it as one, get its quote state stuck "open", skip past the
//     comment's real `-->`, and silently swallow an unpredictable stretch
//     of the real markup that follows — tags consumed that way vanish from
//     the counts without ever showing up as "unclosed", which is why that
//     failure mode shows up only as a mismatched total, never as a nesting
//     error.
//   - `<script>...</script>` and `<style>...</style>` bodies, skipped
//     verbatim to their literal closing tag. Their content (JS/CSS) may
//     contain `<`, `>`, unbalanced quotes, comments, template literals and
//     comparisons that are not markup and must never be tag-scanned.
//
// Usage:
//   node scripts/check-template-nesting.js [file...]   (defaults to index.html)
//   const { checkTemplateNesting } = require('./check-template-nesting');

const fs = require('fs');

const VOID_TAGS = new Set([
    'input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'area',
    'col', 'base', 'embed', 'wbr', 'track',
]);
const RAW_TEXT_TAGS = new Set(['script', 'style']);

function lineAt(html, index) {
    let line = 1;
    for (let k = 0; k < index && k < html.length; k++) {
        if (html[k] === '\n') line++;
    }
    return line;
}

function contextAround(html, index, radius = 60) {
    const start = Math.max(0, index - radius);
    const end = Math.min(html.length, index + radius);
    return html.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Scans `html` and returns { ok, counts, mismatches, unclosed }.
 * - counts: { [tagName]: { open, close } }
 * - mismatches: [{ line, context, message }] — a closing tag that didn't
 *   match the stack the way well-formed nesting requires
 * - unclosed: [{ tag, line, context }] — tags still open at end of file
 */
function checkTemplateNesting(html) {
    const stack = []; // { name, line, index }
    const counts = {};
    const mismatches = [];
    let i = 0;
    const n = html.length;

    function record(name, isClose) {
        counts[name] = counts[name] || { open: 0, close: 0 };
        if (isClose) counts[name].close++;
        else counts[name].open++;
    }

    while (i < n) {
        if (html[i] !== '<') { i++; continue; }

        // HTML comment — skip verbatim, no quote-tracking inside.
        if (html.startsWith('<!--', i)) {
            const end = html.indexOf('-->', i + 4);
            i = end === -1 ? n : end + 3;
            continue;
        }

        // Doctype / other bang declarations — skip to next `>`.
        if (html[i + 1] === '!') {
            const end = html.indexOf('>', i);
            i = end === -1 ? n : end + 1;
            continue;
        }

        const tagStart = i;
        let j = i + 1;
        let quote = null;
        while (j < n) {
            const c = html[j];
            if (quote) {
                if (c === quote) quote = null;
            } else if (c === '"' || c === "'") {
                quote = c;
            } else if (c === '>') {
                break;
            }
            j++;
        }
        const tagText = html.slice(tagStart, j + 1);
        i = j + 1;

        const m = tagText.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/);
        if (!m) continue; // not a real tag (e.g. a stray `<` in text)
        const name = m[1].toLowerCase();
        const isClose = tagText[1] === '/';
        const isSelfClose = /\/\s*>$/.test(tagText) || VOID_TAGS.has(name);
        record(name, isClose);

        if (isClose) {
            const topIdx = stack.length - 1;
            if (topIdx >= 0 && stack[topIdx].name === name) {
                stack.pop();
            } else {
                const matchIdx = stack.map(e => e.name).lastIndexOf(name);
                if (matchIdx === -1) {
                    mismatches.push({
                        line: lineAt(html, tagStart),
                        context: contextAround(html, tagStart),
                        message: `Closing </${name}> has no matching open tag on the stack.`,
                    });
                } else {
                    const skipped = stack.slice(matchIdx + 1).map(e => `<${e.name}> (line ${e.line})`);
                    mismatches.push({
                        line: lineAt(html, tagStart),
                        context: contextAround(html, tagStart),
                        message: `Closing </${name}> does not match innermost open tag <${stack[topIdx].name}> ` +
                            `(line ${stack[topIdx].line}). Implicitly closes: ${skipped.join(', ')}.`,
                    });
                    stack.length = matchIdx;
                }
            }
        } else if (!isSelfClose) {
            stack.push({ name, line: lineAt(html, tagStart), index: tagStart });
        }

        // Raw-text element body — skip verbatim to the literal closing tag.
        if (!isClose && !isSelfClose && RAW_TEXT_TAGS.has(name)) {
            const lower = html.toLowerCase();
            const closeIdx = lower.indexOf('</' + name, i);
            if (closeIdx !== -1) {
                const gt = html.indexOf('>', closeIdx);
                const endIdx = gt === -1 ? n : gt + 1;
                record(name, true);
                if (stack.length && stack[stack.length - 1].name === name) stack.pop();
                i = endIdx;
            }
        }
    }

    const unclosed = stack.map(e => ({ tag: e.name, line: e.line, context: contextAround(html, e.index) }));
    return {
        ok: mismatches.length === 0 && unclosed.length === 0,
        counts,
        mismatches,
        unclosed,
    };
}

function reportForFile(filePath) {
    const html = fs.readFileSync(filePath, 'utf8');
    const result = checkTemplateNesting(html);
    if (result.ok) {
        console.log(`[check-template-nesting] ${filePath}: OK (nesting balanced, stack empty)`);
        return true;
    }
    console.error(`[check-template-nesting] ${filePath}: FAILED`);
    result.mismatches.forEach(m => {
        console.error(`  mismatch at line ${m.line}: ${m.message}`);
        console.error(`    ...${m.context}...`);
    });
    result.unclosed.forEach(u => {
        console.error(`  unclosed <${u.tag}> opened at line ${u.line}`);
        console.error(`    ...${u.context}...`);
    });
    return false;
}

if (require.main === module) {
    const files = process.argv.slice(2);
    const targets = files.length ? files : ['index.html'];
    const results = targets.map(reportForFile);
    process.exit(results.every(Boolean) ? 0 : 1);
}

module.exports = { checkTemplateNesting, reportForFile };
