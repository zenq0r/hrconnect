const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource } = require('./helpers/sources');

const read = (f) => readSource(f);
const page = () => read('index.html');
const styles = () => read('custom.css');

// The entry block is the last word on the sign-in screen's colours; everything
// above it in the file is either geometry or the superseded light treatment.
function entryBlock() {
    const css = styles();
    const start = css.indexOf('/* Keep the portal entry experience aligned');
    assert.ok(start > -1, 'the entry-screen block must remain in custom.css');
    const end = css.indexOf('@media print', start);
    assert.ok(end > start, 'the entry block must stay above the print rules');
    return css.slice(start, end);
}

test('every screen before sign-in is one shell and one card', () => {
    const html = page();
    // Three <main> elements can render while signed out: the emailed action
    // link, password assistance, and the sign-in screen itself. A screen that
    // misses the shell keeps bg-brand-dark (#18212F) — a fourth navy.
    const mains = html.match(/<main[^>]*id="auth-main"[^>]*>/g) || [];
    assert.equal(mains.length, 3, 'the signed-out screens must all be accounted for');
    for (const m of mains) {
        assert.ok(/class="zq-auth-shell /.test(m), `an auth screen is missing zq-auth-shell: ${m.slice(0, 90)}`);
    }
    // Each of those screens holds exactly one card, and the card needs the hook
    // or it keeps `bg-white dark:bg-slate-800` — white in light mode, dark in
    // dark mode, which is the split this whole block exists to remove.
    // One of the three carries `v-else` before its class attribute.
    const cards = html.match(/<div [^>]*class="[^"]*max-w-md w-full bg-white[^"]*"/g) || [];
    assert.equal(cards.length, 3, 'each signed-out screen has one card');
    for (const c of cards) {
        assert.ok(c.includes('zq-auth-card'), `a sign-in card is missing zq-auth-card: ${c.slice(0, 90)}`);
    }
});

test('the entry screen looks the same in both themes', () => {
    const block = entryBlock();
    // The light treatment earlier in the file ships `.dark` counterparts at a
    // higher specificity. Any colour rule here that forgets its own `.dark`
    // half loses to them, and the screen gets two different dark palettes.
    for (const sel of ['.zq-auth-shell', '.zq-auth-landing', '.zq-auth-choice']) {
        const bare = new RegExp('^' + sel.replace('.', '\\.') + ',$', 'm');
        const paired = new RegExp('^\\.dark ' + sel.replace('.', '\\.') + ' \\{|^\\.dark ' + sel.replace('.', '\\.') + ',?$', 'm');
        assert.ok(bare.test(block) && paired.test(block),
            `${sel} must be declared for both themes in the entry block`);
    }
});

test('the card is dressed by the palette, not by per-control overrides', () => {
    const block = entryBlock();
    // Re-pointing the variables is what keeps labels, inputs, buttons and
    // alerts in step without a rule each. Losing these silently reverts the
    // card's contents to the light palette while the card stays dark.
    for (const v of ['--zq-surface:', '--zq-text:', '--zq-text-muted:', '--zq-primary:', '--zq-error-bg:']) {
        assert.ok(block.includes(v), `the entry palette must set ${v}`);
    }
    // `#app input` and `#app label` hard-code the light palette and outrank
    // .zq-input/.zq-label on ID specificity — without these the fields render
    // white with near-white text in them.
    assert.match(block, /#app \.zq-auth-shell input,/);
    assert.match(block, /#app \.zq-auth-shell label \{ color: var\(--zq-text-muted\); \}/);
});

test('the white logo chip rule cannot swallow the cards', () => {
    const block = entryBlock();
    // The card and both landing choices are also `.bg-white`. A rule matching
    // bare .bg-white turns them white with white headings on top — caught only
    // on screen, since nothing here changes the markup. .shadow-lg is unique
    // to the logo chips; the cards carry .shadow-2xl.
    const rule = block.match(/^\.zq-auth-shell \.bg-white[^\n]*$/m);
    assert.ok(rule, 'the logo-chip rule must remain');
    assert.ok(rule[0].includes('.bg-white.shadow-lg'),
        `the chip rule must stay pinned to .shadow-lg, got: ${rule[0]}`);

    const html = page();
    for (const cls of ['zq-auth-card', 'zq-auth-choice']) {
        const re = new RegExp(`class="[^"]*${cls}[^"]*"`, 'g');
        for (const m of html.match(re) || []) {
            assert.ok(!/\bshadow-lg\b/.test(m), `${cls} must not carry shadow-lg: ${m.slice(0, 90)}`);
        }
    }
});
