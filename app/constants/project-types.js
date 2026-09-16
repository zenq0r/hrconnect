// ---- Project Type model ----------------------------------------------------
// Every new project now carries a type, and its projectRef is generated from
// the type's prefix (see generateProjectRef() in app/methods/projects.js) —
// never hand-typed. Existing PRJ-... projects predate this and are untouched;
// nothing on read or write parses a reference's prefix, so old and new
// records coexist without a migration.
export const PROJECT_TYPES = [
    { key: 'DOC', prefix: 'DOC', label: 'Document' },
    { key: 'CLI', prefix: 'CLI', label: 'Client Information Form' },
    { key: 'NDA', prefix: 'NDA', label: 'Non-Disclosure Agreement' },
    { key: 'SAZT', prefix: 'SAZT', label: 'Service Agreement' },
    { key: 'GOV', prefix: 'GOV', label: 'Government' }
];

// Only relevant when Project Type is 'GOV' — see MALAYSIA_STATES in
// app/constants/malaysia-locations.js for the State -> Local Authority step
// ahead of this one.
export const GOV_APPLICATION_TYPES = [
    'Business Premise Licence',
    'Signboard / Advertisement Licence',
    'Temporary Promotion Permit',
    'Event / Temporary Activity Permit',
    'Hawker / Trading Permit',
    'Renovation / Building Permit',
    'Planning Permission',
    'Compound / Appeal',
    'Licence Renewal',
    'Other Government Application'
];
