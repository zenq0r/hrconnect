#!/usr/bin/env node
/**
 * One-off migration: fold the retired Our Client showcase into Licensing & Permits.
 *
 * portfolio-web.html on zenqor-tech is now a redirect stub and the portal's Our
 * Client tab is gone, so `portfolio_web` documents have nowhere left to surface.
 * Licensing & Permits (`portfolio_gaming`) has taken over the multi-media gallery,
 * and both collections already share the same field shape — tag, companyName,
 * title, eventDate, desc, imgUrl/imgStoragePath, and an optional media[] array —
 * so a document moves across unchanged.
 *
 * COPIES rather than moves: the source document is left in place so the migration
 * can be re-run or reviewed, and nothing is lost if a copy is interrupted. Delete
 * the `portfolio_web` collection by hand once the result looks right.
 *
 * Storage files are NOT touched. The media URLs already point at
 * website_content/portfolio_web/... and stay valid wherever they are referenced
 * from; re-uploading them would only orphan the originals.
 *
 *   node scripts/merge-our-client-into-licensing.js            # preview
 *   node scripts/merge-our-client-into-licensing.js --apply    # perform the copy
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY, same as the routes under api/.
 */
const { getAdminApp } = require('../api/_firebaseAdmin');

const SOURCE = 'portfolio_web';
const TARGET = 'portfolio_gaming';

async function main() {
    const apply = process.argv.includes('--apply');
    const db = getAdminApp().firestore();

    const [source, target] = await Promise.all([
        db.collection(SOURCE).get(),
        db.collection(TARGET).get()
    ]);
    const existing = new Set(target.docs.map(d => d.id));

    console.log(`${SOURCE}: ${source.size} document(s)`);
    console.log(`${TARGET}: ${target.size} document(s) already present\n`);

    let copied = 0;
    let skipped = 0;
    for (const document of source.docs) {
        const data = document.data();
        const label = data.title || document.id;
        if (existing.has(document.id)) {
            skipped += 1;
            console.log(`skip  ${document.id} — already in ${TARGET} (${label})`);
            continue;
        }
        const mediaCount = Array.isArray(data.media) ? data.media.length : (data.imgUrl ? 1 : 0);
        console.log(`copy  ${document.id} — ${label} [${mediaCount} media]`);
        if (apply) {
            await db.collection(TARGET).doc(document.id).set({
                ...data,
                mergedFrom: SOURCE,
                mergedAt: new Date().toISOString()
            }, { merge: true });
        }
        copied += 1;
    }

    console.log(`\n${copied} to copy, ${skipped} already there.`);
    if (apply) {
        console.log(`Copied. ${SOURCE} is untouched — delete it once Licensing & Permits looks right.`);
    } else {
        console.log('Preview only — re-run with --apply to write.');
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
