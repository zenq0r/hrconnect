#!/usr/bin/env node
/**
 * One-off repair for Website Content records saved before the editor stopped
 * force-uppercasing them.
 *
 * Older `portfolio_web`, `portfolio_gaming` and `services` documents went through
 * normalizeOfficialRecord(), which uppercases every string. That is right for an
 * invoice's official party details and wrong for public marketing copy: it left
 * Our Client rendering as a wall of capitals beside a normally-cased Licensing &
 * Permits page.
 *
 * Recasing is inherently lossy — the original capitalisation is not recoverable,
 * so this reconstructs a sensible one and leaves anything already mixed-case
 * untouched. Because of that, and because it writes to production, it PREVIEWS
 * by default and only writes when passed --apply.
 *
 *   node scripts/fix-website-content-case.js              # preview, writes nothing
 *   node scripts/fix-website-content-case.js --apply      # perform the update
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY in the environment, same as the API
 * routes under api/.
 */
const { getAdminApp } = require('../api/_firebaseAdmin');

const COLLECTIONS = {
    portfolio_web: ['tag', 'companyName', 'title', 'desc'],
    portfolio_gaming: ['tag', 'companyName', 'title', 'desc'],
    services: ['name', 'desc']
};

// Words that stay capitalised: Malaysian company suffixes, authorities, and the
// document/permit vocabulary these records are full of.
const KEEP_UPPER = new Set([
    'SDN', 'BHD', 'PLT', 'LLP', 'SSM', 'ROC', 'ROB', 'TIN', 'SST', 'GST', 'EPF', 'SOCSO', 'EIS', 'LHDN',
    'DBKL', 'MBIP', 'MBSA', 'MBJB', 'MPKJ', 'MPS', 'JUPEM', 'CAAM', 'CIDB', 'MITI', 'MDEC', 'MOF',
    'HRMS', 'CDTS', 'IT', 'HR', 'API', 'PDF', 'CSV', 'KL', 'MY', 'AI', 'B2B', 'B2C', 'QR', 'ID'
]);

// Per-field casing, chosen to land where Licensing & Permits already sits:
//   tag         pill label, stays uppercase
//   companyName Malaysian company names are conventionally written uppercase
//               on official records, and this renders in the small meta line
//   title/name  Title Case, matching 'Jabatan Perlesenan (DBKL) - Lesen Perniagaan'
//   desc        sentence case, so a paragraph reads as prose
const FIELD_STYLE = {
    tag: 'keep',
    companyName: 'keep',
    title: 'title',
    name: 'title',
    desc: 'sentence'
};

// Left lowercase inside a title unless they open it.
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'via', 'with', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada']);

function keepUpper(part) {
    const bare = part.replace(/[^A-Za-z]/g, '');
    return bare && KEEP_UPPER.has(bare.toUpperCase());
}

function titleCase(raw) {
    let first = true;
    return raw.toLowerCase().split(/(\s+)/).map(part => {
        if (!part.trim()) return part;
        if (keepUpper(part)) { first = false; return part.toUpperCase(); }
        const bare = part.replace(/[^a-z]/g, '');
        const small = SMALL_WORDS.has(bare) && !first;
        first = false;
        return small ? part : part.replace(/[a-z]/, ch => ch.toUpperCase());
    }).join('');
}

function sentenceCase(raw) {
    return raw
        .toLowerCase()
        .replace(/([.!?]\s+|^)([a-z])/g, (m, lead, ch) => lead + ch.toUpperCase())
        .split(/(\s+)/)
        .map(part => (keepUpper(part) ? part.toUpperCase() : part))
        .join('');
}

function recase(value, field) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return raw;
    // Already mixed case — the editor typed it deliberately, leave it alone.
    if (raw !== raw.toUpperCase()) return raw;
    const style = FIELD_STYLE[field] || 'sentence';
    if (style === 'keep') return raw;
    return style === 'title' ? titleCase(raw) : sentenceCase(raw);
}

async function main() {
    const apply = process.argv.includes('--apply');
    const admin = getAdminApp();
    const db = admin.firestore();
    let scanned = 0;
    let changed = 0;

    for (const [name, fields] of Object.entries(COLLECTIONS)) {
        const snapshot = await db.collection(name).get();
        for (const document of snapshot.docs) {
            scanned += 1;
            const data = document.data();
            const update = {};
            for (const field of fields) {
                if (typeof data[field] !== 'string') continue;
                const next = recase(data[field], field);
                if (next !== data[field]) update[field] = next;
            }
            if (!Object.keys(update).length) continue;
            changed += 1;
            console.log(`\n${name}/${document.id}`);
            for (const [field, next] of Object.entries(update)) {
                console.log(`  ${field}`);
                console.log(`    before: ${data[field]}`);
                console.log(`    after : ${next}`);
            }
            if (apply) await document.ref.set(update, { merge: true });
        }
    }

    console.log(`\nScanned ${scanned} document(s); ${changed} would change.`);
    console.log(apply ? 'Applied.' : 'Preview only — re-run with --apply to write.');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
