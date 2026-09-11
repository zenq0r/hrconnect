const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource } = require('./helpers/sources');

const root = path.join(__dirname, '..');

test('Vercel production upload excludes repository-only source folders', () => {
    const ignore = readSource('.vercelignore');

    // This static portal deploys from the repository root. Keep test suites,
    // maintenance scripts, Firebase deployment sources, and rule files out of
    // the public Vercel artifact. The runtime /api directory stays deployed.
    for (const pattern of [
        'tests/',
        'scripts/',
        'functions/',
        '.claude/',
        '.firebaserc',
        'MIGRATION_GUIDE.md',
        'firebase.json',
        'firestore.rules',
        'firestore.indexes.json',
        'storage.rules'
    ]) {
        assert.match(ignore, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `${pattern} must not be uploaded to Vercel`);
    }
});

test('production portal code does not import test or development paths', () => {
    const files = ['index.html', 'app.js', 'firebase-config.js', 'sw.js'];
    for (const file of files) {
        const source = readSource(file);
        assert.doesNotMatch(source, /(?:from|src=|import\()['"][^'"]*(?:\/tests\/|\/scripts\/)/i, `${file} must not load a test or script asset`);
    }
});
