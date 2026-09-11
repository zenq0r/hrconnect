const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, methodSource } = require('./helpers/sources');

// Receipts, payment proofs and approval documents used to be base64 inside the
// Firestore record. Every reader of a claim downloaded the image bytes whether
// they opened the attachment or not, each record crept toward Firestore's 1 MB
// document ceiling, and the picture was squeezed to 220 KB to fit.

test('an attachment is uploaded, not embedded', () => {
    const prepare = methodSource('prepareImageAttachment');
    const store = methodSource('storeAttachment');

    assert.doesNotMatch(prepare, /toDataURL/, 'an attachment must not be encoded into the record');
    assert.match(prepare, /canvas\.toBlob\(/);
    assert.match(prepare, /return await this\.storeAttachment\(blob, ownerUid\)/);

    assert.match(store, /storageRef\(storage, `receipts\/\$\{ownerUid\}\//);
    assert.match(store, /uploadBytes\(fileRef, blob, \{ contentType: 'image\/jpeg' \}\)/);
    assert.match(store, /getDownloadURL\(fileRef\)/);
});

test('records written the old way still display', () => {
    // Everything on file today holds a data URL. Both forms have to render, or
    // this change would blank out every receipt already filed.
    const supported = methodSource('isSupportedImageAttachment');
    assert.match(supported, /\^data:image\\\/\(png\|jpeg\);base64,/);
    assert.match(supported, /firebasestorage\\\.googleapis\\\.com/);
});

test('the uploaded image is still bounded', () => {
    const prepare = methodSource('prepareImageAttachment');
    // A phone camera photo of an A4 receipt is 12 megapixels of mostly white
    // paper. Storage removes the reason to crush it to 220 KB, not the reason
    // to resize it at all.
    assert.match(prepare, /maxUploadBytes = 1536 \* 1024, maxDimension = 2000/);
    assert.match(prepare, /if \(blob\.size <= maxUploadBytes\)/);
    // And the source file is still checked by its actual bytes before any of
    // this runs.
    assert.match(prepare, /await this\.validateImageFile\(file\)/);
    assert.match(methodSource('validateImageFile'), /file\.size > 2 \* 1024 \* 1024/);
});

test('storage.rules admits the uploader and the approvers, and nobody else', () => {
    const rules = readSource('storage.rules');
    const block = rules.slice(rules.indexOf('match /receipts/'), rules.indexOf('match /website_content/'));

    assert.ok(block.length > 0, 'receipts need their own rule');
    // The person who attached it, and the staff who have to approve it.
    assert.match(block, /allow read: if isStaffReader\(\) \|\| \(isSignedIn\(\) && request\.auth\.uid == ownerUid\);/);
    // Writing is limited to one's own folder, one image type, one size.
    assert.match(block, /request\.auth\.uid == ownerUid/);
    assert.match(block, /request\.resource\.size <= 2 \* 1024 \* 1024/);
    assert.match(block, /request\.resource\.contentType == 'image\/jpeg'/);
});

test('replacing an attachment does not destroy the one on file', () => {
    const store = methodSource('storeAttachment');
    // The record still points at the previous file until the save succeeds. A
    // failed save that had already deleted the old receipt is worse than an
    // unreferenced file sitting in a bucket.
    assert.doesNotMatch(store, /deleteObject/);
});

test('no operator instruction is left in a message a user reads', () => {
    const source = readSource('app.js') + readSource('index.html');
    // "Deploy the latest firestore.rules" is a deployment step. The person who
    // hit a permission error cannot do it and should not be asked to.
    assert.doesNotMatch(source, /Deploy the latest firestore\.rules/);
    assert.doesNotMatch(source, /requires firestore\.rules to already be deployed/);
    // Nor should a size limit be explained in terms of the database behind it.
    assert.doesNotMatch(source, /exceeds the (safe )?Firestore size/);
});
