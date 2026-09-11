// Official client identity: SSM/BRN and LHDN TIN formats, the uppercasing rule
// every stored record follows, and postcode-driven address completion.
import { lookupMalaysiaPostcode } from "../constants/statutory.js";
export const clientIdentityMethods = {
        toOfficialUppercase(value) {
            return typeof value === 'string' ? value.trim().toLocaleUpperCase('en-MY') : value;
        },
        normalizeOfficialRecord(value, key = '') {
            if (Array.isArray(value)) return value.map(item => this.normalizeOfficialRecord(item, key));
            if (value && typeof value === 'object') {
                return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, this.normalizeOfficialRecord(childValue, childKey)]));
            }
            if (typeof value !== 'string') return value;
            const protectedKey = /(id$|email|password|photo|attachment|status|role|type|category|date|method|url|website)/i.test(key);
            const protectedValue = /^(data:|https?:\/\/)/i.test(value.trim());
            return protectedKey || protectedValue ? value.trim() : this.toOfficialUppercase(value);
        },
        // LHDN issues a TIN as an entity-type prefix followed by digits. The
        // prefix set below is the published list; longer prefixes are matched
        // first so "CS" is never read as "C" with a stray letter after it.
        // Non-individual numbers run 11-12 characters, individuals (IG) the
        // same, after the trailing zero LHDN appended to existing numbers in
        // January 2023.
        normalizeTin(value) {
            return String(value || '').toUpperCase().replace(/[\s-]/g, '');
        },
        // SSM has used two registration formats. Since 11 October 2019 every
        // entity carries a 12-digit number — 4-digit year of incorporation, a
        // 2-digit entity code, then a 6-digit sequence. Records from before then
        // also keep the older sequence-and-check-letter number, and both are
        // printed together during the transition, e.g. 199301012242 (266980-X).
        // Enterprises registered in a state carry a state prefix on the old one,
        // such as JM1045730-D, so the prefix is optional rather than absent.
        brnNewFormatState(value) {
            const v = String(value || '').replace(/\s/g, '');
            if (!v) return 'empty';
            return /^\d{12}$/.test(v) ? 'valid' : 'invalid';
        },
        brnOldFormatState(value) {
            const v = String(value || '').replace(/\s/g, '').toUpperCase();
            if (!v) return 'empty';
            return /^[A-Z]{0,3}\d{4,10}-[A-Z]{1,2}$/.test(v) ? 'valid' : 'invalid';
        },
        // clientSSM stays the stored, printed and searched value — 36 places read
        // it — so the parts are composed back into the shape everything expects.
        composeClientSSM(newBrn, oldBrn) {
            const a = String(newBrn || '').trim();
            const b = String(oldBrn || '').trim().toUpperCase();
            if (a && b) return `${a} (${b})`;
            return a || b;
        },
        // Existing records only have the combined string, so opening one splits
        // it back apart rather than making staff retype what is already there.
        splitClientSSM(value) {
            const raw = String(value || '').trim();
            const paired = raw.match(/^(\d{12})\s*\(([^)]+)\)$/);
            if (paired) return { newBrn: paired[1], oldBrn: paired[2].trim().toUpperCase() };
            if (/^\d{12}$/.test(raw)) return { newBrn: raw, oldBrn: '' };
            return { newBrn: '', oldBrn: raw.toUpperCase() };
        },
        tinFormatState(value) {
            const tin = this.normalizeTin(value);
            if (!tin) return 'empty';
            const shape = /^(CS|FA|PT|TA|TC|TN|TR|TP|LE|IG|C|D|E|F|J)\d{8,11}$/;
            if (!shape.test(tin)) return 'invalid';
            if (tin.length < 11 || tin.length > 12) return 'invalid';
            return 'valid';
        },
        detectClientInformationPostcode() {
            const form = this.clientInformationModal.form;
            const result = lookupMalaysiaPostcode(form.clientPostcode);
            form.clientPostcode = result.postcode;
            if (result.city) form.clientCity = result.city;
            if (result.state) form.clientState = result.state;
            if (result.postcode.length === 5) form.clientCountry = 'Malaysia';
        },
        detectCompanyPostcode() {
            const result = lookupMalaysiaPostcode(this.company.postcode);
            this.company.postcode = result.postcode;
            if (result.city) this.company.city = result.city;
            if (result.state) this.company.state = result.state;
            if (result.postcode.length === 5) this.company.country = 'Malaysia';
        },
        addressLines(record, prefix = 'client') {
            const key = name => prefix === 'company' ? name : `client${name.charAt(0).toUpperCase()}${name.slice(1)}`;
            const legacy = String(record?.[key('address')] || '').trim();
            const line1 = String(record?.[key('address1')] || legacy).trim();
            const cityLine = [record?.[key('postcode')], record?.[key('city')]].map(value => String(value || '').trim()).filter(value => value && value !== '-').join(' ');
            return [line1, record?.[key('address2')], record?.[key('address3')], cityLine, record?.[key('state')], record?.[key('country')]]
                .map(value => String(value || '').trim()).filter(value => value && value !== '-')
                .reduce((lines, value) => {
                    const existing = lines.join(' ').toLowerCase();
                    if (!existing.includes(value.toLowerCase())) lines.push(value);
                    return lines;
                }, []);
        },
        formattedClientAddress(record = this.docForm) {
            return this.addressLines(record, 'client').join('\n');
        },
        formattedCompanyAddress() {
            return this.addressLines(this.company, 'company').join('\n') || String(this.company.address || '').trim();
        },
        hydrateCompanyAddress(data) {
            const company = { ...data };
            const legacyLines = String(company.address || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            company.address1 = company.address1 || legacyLines[0] || '';
            company.address2 = company.address2 || legacyLines[1] || '';
            company.address3 = company.address3 || legacyLines[2] || '';
            company.postcode = String(company.postcode || '').replace(/\D/g, '').slice(0, 5);
            company.city = company.city || '';
            company.state = company.state || '';
            company.country = company.country || 'Malaysia';
            return company;
        }
};