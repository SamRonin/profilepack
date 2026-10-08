import { describe, expect, it } from 'vitest';

import { scanDocument } from '../src/content/scanner';
import { resolveSelector } from '../src/content/selector';
import { fillFields } from '../src/content/fill';
import { resolveMappings } from '../src/domain/resolve';
import { generatePersona } from '../src/domain/generator';
import { loadFixture, loadFixtureLive } from './helpers';

function classifyOf(scan: ReturnType<typeof scanDocument>, selector: string) {
  const field = scan.fields.find((f) => f.selector === selector);
  expect(field, `field ${selector} should be detected`).toBeDefined();
  return field!.classification;
}

describe('scan -> detect -> map integration (fixtures)', () => {
  it('basic-form: detects the core signup fields', () => {
    const doc = loadFixture('basic-form.html');
    const scan = scanDocument(doc);

    expect(classifyOf(scan, '#first_name').field).toBe('firstName');
    expect(classifyOf(scan, '#last_name').field).toBe('lastName');
    expect(classifyOf(scan, '#email').field).toBe('email');
    expect(classifyOf(scan, '#phone').field).toBe('phone');
    expect(classifyOf(scan, '#company').field).toBe('company');
    expect(classifyOf(scan, '#zip').field).toBe('postalCode');
    expect(classifyOf(scan, '#country').field).toBe('country');

    // security invariants: password is counted but never listed for filling
    expect(scan.fields.find((f) => f.selector === '#password')).toBeUndefined();
    expect(scan.sensitiveSkipped).toBe(1);
    // submit buttons are never detected
    expect(scan.fields.some((f) => f.selector.includes('button'))).toBe(false);
  });

  it('german-form: detects German labels end-to-end', () => {
    const doc = loadFixture('german-form.html');
    const scan = scanDocument(doc);

    expect(classifyOf(scan, '#k-vorname').field).toBe('firstName');
    expect(classifyOf(scan, '#k-nachname').field).toBe('lastName');
    expect(classifyOf(scan, '#k-email').field).toBe('email');
    expect(classifyOf(scan, '#k-telefon').field).toBe('phone');
    expect(classifyOf(scan, '#k-firma').field).toBe('company');
    expect(classifyOf(scan, '#k-ustid').field).toBe('vatId');
    expect(classifyOf(scan, '#k-strasse').field).toBe('addressLine1');
    expect(classifyOf(scan, '#k-plz').field).toBe('postalCode');
    expect(classifyOf(scan, '#k-ort').field).toBe('city');
    expect(classifyOf(scan, '#k-land').field).toBe('country');
    expect(classifyOf(scan, '#k-geburt').field).toBe('dateOfBirth');
    expect(classifyOf(scan, '#k-bemerkung').field).toBe('notes');
    // password counted as sensitive, never exposed
    expect(scan.fields.find((f) => f.selector === '#k-passwort')).toBeUndefined();
    expect(scan.sensitiveSkipped).toBe(1);
  });

  it('us-form: strips billing prefixes and maps the state select', () => {
    const doc = loadFixture('us-form.html');
    const scan = scanDocument(doc);

    expect(classifyOf(scan, '#b-first').field).toBe('firstName');
    expect(classifyOf(scan, '#b-last').field).toBe('lastName');
    expect(classifyOf(scan, '#b-addr1').field).toBe('addressLine1');
    expect(classifyOf(scan, '#b-addr2').field).toBe('addressLine2');
    expect(classifyOf(scan, '#b-city').field).toBe('city');
    expect(classifyOf(scan, '#b-state').field).toBe('state');
    expect(classifyOf(scan, '#b-zip').field).toBe('postalCode');
    expect(classifyOf(scan, '#b-phone').field).toBe('phone');
    expect(classifyOf(scan, '#b-email').field).toBe('email');
    expect(classifyOf(scan, '#us-dob').field).toBe('dateOfBirth');
  });

  it('uk-form: maps surname/postcode/town/county', () => {
    const doc = loadFixture('uk-form.html');
    const scan = scanDocument(doc);

    expect(classifyOf(scan, '#uk-last').field).toBe('lastName');
    expect(classifyOf(scan, '#uk-postcode').field).toBe('postalCode');
    expect(classifyOf(scan, '#uk-town').field).toBe('city');
    expect(classifyOf(scan, '#uk-county').field).toBe('state');
    expect(classifyOf(scan, '#uk-company').field).toBe('company');
  });

  it('react-form: works without <label> elements and protects coupon fields', () => {
    const doc = loadFixture('react-form.html');
    const scan = scanDocument(doc);

    expect(scan.fields.find((f) => f.name === 'firstName')?.classification.field).toBe('firstName');
    expect(scan.fields.find((f) => f.name === 'lastName')?.classification.field).toBe('lastName');
    expect(scan.fields.find((f) => f.name === 'emailAddress')?.classification.field).toBe('email');
    expect(scan.fields.find((f) => f.name === 'phoneNumber')?.classification.field).toBe('phone');
    expect(scan.fields.find((f) => f.name === 'companyName')?.classification.field).toBe('company');
    expect(scan.fields.find((f) => f.name === 'postalCode')?.classification.field).toBe(
      'postalCode',
    );
    expect(scan.fields.find((f) => f.name === 'couponCode')?.classification.field).toBe(
      'neverFill',
    );
  });

  it('ambiguous-form: flags ambiguous fields for review, maps confirm email', () => {
    const doc = loadFixture('ambiguous-form.html');
    const scan = scanDocument(doc);

    const name = scan.fields.find((f) => f.id === 'a-name')!;
    expect(name.classification.needsReview).toBe(true);

    for (const id of ['a-cust-id', 'a-reference', 'a-detail']) {
      const field = scan.fields.find((f) => f.id === id)!;
      expect(field.classification.field).toBe('unknown');
      expect(field.classification.needsReview).toBe(true);
    }

    expect(scan.fields.find((f) => f.id === 'a-confirm-mail')!.classification.field).toBe('email');
  });

  it('japanese-form: falls back to autocomplete tokens and marks the limitation', () => {
    const doc = loadFixture('japanese-form.html');
    const scan = scanDocument(doc);

    expect(scan.fields.find((f) => f.id === 'j-last')!.classification.field).toBe('lastName');
    expect(scan.fields.find((f) => f.id === 'j-first')!.classification.field).toBe('firstName');
    expect(scan.fields.find((f) => f.id === 'j-email')!.classification.field).toBe('email');
    expect(scan.fields.find((f) => f.id === 'j-tel')!.classification.field).toBe('phone');
    expect(scan.fields.find((f) => f.id === 'j-postal')!.classification.field).toBe('postalCode');
    // kanji-only labels are a documented v0.1 limitation
    const addr = scan.fields.find((f) => f.id === 'j-addr')!;
    expect(addr.classification.field).toBe('addressLine1'); // autocomplete street-address
  });

  it('multi-step-form: every step maps into the same schema', () => {
    const doc = loadFixture('multi-step-form.html');
    const scan = scanDocument(doc);
    const mapped = resolveMappings(scan);

    const targets = new Set(mapped.map((m) => m.target));
    expect([...targets]).toEqual(
      expect.arrayContaining([
        'firstName',
        'lastName',
        'email',
        'street',
        'city',
        'postalCode',
        'country',
        'company',
        'jobTitle',
        'department',
      ]),
    );
    expect(scan.forms).toHaveLength(1);
    expect(scan.forms[0]?.fieldCount).toBeGreaterThanOrEqual(9);
  });

  it('dynamic-form: finds fields appended after load (SPA behaviour)', async () => {
    // Static snapshot before the script ran -> only the initial field.
    const beforeDoc = loadFixture('dynamic-form.html');
    expect(scanDocument(beforeDoc).fields).toHaveLength(1);

    // Live snapshot after scripts ran (simulated route change / modal).
    const doc = await loadFixtureLive('dynamic-form.html');
    const after = scanDocument(doc);
    expect(after.fields.length).toBeGreaterThanOrEqual(3);
    expect(after.fields.find((f) => f.id === 'd-first')?.classification.field).toBe('firstName');
    expect(after.fields.find((f) => f.id === 'd-last')?.classification.field).toBe('lastName');
  });

  it('shadow-form: reaches fields inside open shadow roots', async () => {
    const doc = await loadFixtureLive('shadow-form.html');
    const scan = scanDocument(doc);

    const first = scan.fields.find((f) => f.id === 's-first');
    expect(first).toBeDefined();
    expect(first!.selector).toContain('>>>');
    expect(first!.classification.field).toBe('firstName');

    // selectors must resolve back to the exact elements
    const el = resolveSelector(first!.selector, doc);
    expect(el?.id).toBe('s-first');
  });
});

describe('persona -> fill -> template reuse integration', () => {
  it('fills a full German form consistently and reuses the persona across steps', async () => {
    const doc = loadFixture('german-form.html');
    const scan = scanDocument(doc);
    const persona = generatePersona('de', { seed: 123 });
    const mappings = resolveMappings(scan).map(({ selector, label, target, customValue }) => ({
      selector,
      label,
      target,
      customValue,
    }));

    const results = fillFields(
      {
        persona,
        mappings,
        options: { locale: 'de-DE', mode: 'overwrite' },
      },
      doc,
    );

    const filled = results.filter((r) => r.status === 'filled');
    expect(filled.length).toBeGreaterThanOrEqual(9);

    const vorname = doc.getElementById('k-vorname') as HTMLInputElement;
    const nachname = doc.getElementById('k-nachname') as HTMLInputElement;
    const email = doc.getElementById('k-email') as HTMLInputElement;
    const plz = doc.getElementById('k-plz') as HTMLInputElement;
    const land = doc.getElementById('k-land') as HTMLSelectElement;

    expect(vorname.value).toBe(persona.data.identity.firstName);
    expect(nachname.value).toBe(persona.data.identity.lastName);
    expect(email.value).toBe(persona.data.contact.email);
    expect(plz.value).toBe(persona.data.address.postalCode);
    expect(land.value).toBe('de'); // "Deutschland" option via alias matching
    // never filled:
    expect((doc.getElementById('k-passwort') as HTMLInputElement).value).toBe('');
  });

  it('template overrides survive rescans and protect manual decisions', async () => {
    const doc = loadFixture('german-form.html');

    const template = {
      id: 't-de',
      name: 'German checkout',
      hostname: 'shop.test',
      mappings: [
        { selector: '#k-vorname', label: 'Vorname', target: 'ignore' as const },
        { selector: '#k-firma', label: 'Firmenname', target: 'fullName' as const },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    // Simulate a rescan of the same page with the template applied.
    const rescan = scanDocument(doc);
    const mappings = resolveMappings(rescan, { template });
    const vornameMapping = mappings.find((m) => m.selector === '#k-vorname');
    const firmaMapping = mappings.find((m) => m.selector === '#k-firma');

    expect(vornameMapping?.target).toBe('ignore');
    expect(firmaMapping?.target).toBe('fullName');
    expect(firmaMapping?.source).toBe('template');

    const persona = generatePersona('de', { seed: 5 });
    const results = fillFields(
      { persona, mappings, options: { locale: 'de-DE', mode: 'overwrite' } },
      doc,
    );
    expect((doc.getElementById('k-vorname') as HTMLInputElement).value).toBe('');
    expect((doc.getElementById('k-firma') as HTMLInputElement).value).toBe(
      persona.data.identity.fullName,
    );
    expect(results.find((r) => r.selector === '#k-vorname')?.status).toBe('skipped');
  });

  it('keeps values consistent across multi-step flows', () => {
    const doc = loadFixture('multi-step-form.html');
    const scan = scanDocument(doc);
    const persona = generatePersona('de', { seed: 77 });
    const options = { locale: 'de-DE', mode: 'overwrite' as const };

    const step1 = resolveMappings(scan)
      .filter((m) => ['firstName', 'lastName', 'email'].includes(m.target))
      .map(({ selector, target }) => ({ selector, target }));
    const step2 = resolveMappings(scan)
      .filter((m) => ['city', 'postalCode'].includes(m.target))
      .map(({ selector, target }) => ({ selector, target }));

    fillFields({ persona, mappings: step1, options }, doc);
    fillFields({ persona, mappings: step2, options }, doc);

    expect((doc.getElementById('m-first') as HTMLInputElement).value).toBe(
      persona.data.identity.firstName,
    );
    expect((doc.getElementById('m-email') as HTMLInputElement).value).toBe(
      persona.data.contact.email,
    );
    expect((doc.getElementById('m-city') as HTMLInputElement).value).toBe(
      persona.data.address.city,
    );
    expect((doc.getElementById('m-postal') as HTMLInputElement).value).toBe(
      persona.data.address.postalCode,
    );
  });
});
