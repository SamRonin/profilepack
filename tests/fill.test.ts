import { beforeEach, describe, expect, it } from 'vitest';

import { fillFields } from '../src/content/fill';
import { formatDate } from '../src/domain/dateFormat';
import { generatePersona } from '../src/domain/generator';
import type { FillMapping, FillRequest } from '../src/domain/messages';

function buildDom(html: string): void {
  document.body.innerHTML = html;
}

function request(
  persona: ReturnType<typeof generatePersona>,
  mappings: FillMapping[],
  locale = 'de-DE',
  mode: FillRequest['options']['mode'] = 'overwrite',
): FillRequest {
  return { persona, mappings, options: { locale, mode } };
}

describe('fill engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('sets text values and dispatches input + change events', () => {
    buildDom('<input id="name" type="text" />');
    const input = document.getElementById('name') as HTMLInputElement;
    const events: string[] = [];
    input.addEventListener('input', (e) => events.push(`input:${e.bubbles}`));
    input.addEventListener('change', (e) => events.push(`change:${e.bubbles}`));

    const persona = generatePersona('de', { seed: 9 });
    const results = fillFields(request(persona, [{ selector: '#name', target: 'firstName' }]));

    expect(results[0]?.status).toBe('filled');
    expect(input.value).toBe(persona.data.identity.firstName);
    expect(events).toEqual(['input:true', 'change:true']);
  });

  it('matches select options through country aliases (value + text)', () => {
    buildDom(`
      <select id="country">
        <option value="">Select…</option>
        <option value="DE">Germany</option>
        <option value="US">United States</option>
      </select>
    `);
    const select = document.getElementById('country') as HTMLSelectElement;
    const changeEvents: number[] = [];
    select.addEventListener('change', () => changeEvents.push(1));

    const persona = generatePersona('de', { seed: 9 });
    const results = fillFields(request(persona, [{ selector: '#country', target: 'country' }]));

    expect(results[0]?.status).toBe('filled');
    expect(select.value).toBe('DE');
    expect(changeEvents).toHaveLength(1);
  });

  it('fills ISO-3 valued selects', () => {
    buildDom(`
      <select id="land">
        <option value="">Bitte wählen…</option>
        <option value="DEU">Deutschland</option>
        <option value="AUT">Österreich</option>
      </select>
    `);
    const select = document.getElementById('land') as HTMLSelectElement;
    const persona = generatePersona('de', { seed: 9 });
    const results = fillFields(request(persona, [{ selector: '#land', target: 'country' }]));
    expect(results[0]?.status).toBe('filled');
    expect(select.value).toBe('DEU');
  });

  it('reports skipped when no select option matches', () => {
    buildDom(`
      <select id="country">
        <option value="FR">France</option>
      </select>
    `);
    const persona = generatePersona('de', { seed: 9 });
    const results = fillFields(request(persona, [{ selector: '#country', target: 'country' }]));
    expect(results[0]?.status).toBe('skipped');
    expect(results[0]?.detail).toBe('no matching option');
  });

  it('checks the matching radio in a group (country aliases)', () => {
    buildDom(`
      <form id="f">
        <input type="radio" id="r-de" name="country" value="de" />
        <input type="radio" id="r-us" name="country" value="us" />
      </form>
    `);
    const persona = generatePersona('de', { seed: 9 });
    const results = fillFields(request(persona, [{ selector: '#r-de', target: 'country' }]));
    expect(results[0]?.status).toBe('filled');
    expect((document.getElementById('r-de') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('r-us') as HTMLInputElement).checked).toBe(false);
  });

  it('handles checkboxes with boolean-ish custom values', () => {
    buildDom('<input id="cb" type="checkbox" />');
    const cb = document.getElementById('cb') as HTMLInputElement;
    const persona = generatePersona('us', { seed: 9 });
    fillFields(request(persona, [{ selector: '#cb', target: 'custom', customValue: 'true' }]));
    expect(cb.checked).toBe(true);
  });

  it('fills contenteditable elements', () => {
    buildDom('<div id="bio" contenteditable="true"></div>');
    const div = document.getElementById('bio') as HTMLElement;
    const events: string[] = [];
    div.addEventListener('input', () => events.push('input'));

    const persona = generatePersona('de', { seed: 9 });
    const results = fillFields(
      request(persona, [{ selector: '#bio', target: 'custom', customValue: 'QA note' }]),
    );
    expect(results[0]?.status).toBe('filled');
    expect(div.textContent).toBe('QA note');
    expect(events).toEqual(['input']);
  });

  it('fills date inputs with ISO values', () => {
    buildDom('<input id="dob" type="date" />');
    const input = document.getElementById('dob') as HTMLInputElement;
    const persona = generatePersona('de', { seed: 9 });
    const results = fillFields(request(persona, [{ selector: '#dob', target: 'dateOfBirth' }]));
    expect(results[0]?.status).toBe('filled');
    expect(input.value).toBe(persona.data.identity.dateOfBirth);
  });

  it('formats text date inputs using placeholder hints (locale-independent)', () => {
    buildDom('<input id="dob" type="text" placeholder="MM/DD/YYYY" />');
    const input = document.getElementById('dob') as HTMLInputElement;
    const persona = generatePersona('de', { seed: 9 });
    fillFields(request(persona, [{ selector: '#dob', target: 'dateOfBirth' }], 'de-DE'));
    expect(input.value).toBe(formatDate(persona.data.identity.dateOfBirth, 'mdy-slash'));
  });

  it('respects emptyOnly mode', () => {
    buildDom('<input id="email" type="text" value="keep@example.com" />');
    const persona = generatePersona('de', { seed: 9 });
    const results = fillFields(
      request(persona, [{ selector: '#email', target: 'email' }], 'de-DE', 'emptyOnly'),
    );
    expect(results[0]?.status).toBe('skipped');
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('keep@example.com');
  });

  it('skips read-only fields and missing elements', () => {
    buildDom('<input id="locked" type="text" readonly />');
    const persona = generatePersona('de', { seed: 9 });
    const results = fillFields(
      request(persona, [
        { selector: '#locked', target: 'firstName' },
        { selector: '#missing', target: 'email' },
      ]),
    );
    expect(results[0]).toMatchObject({ status: 'skipped', detail: 'field is read-only' });
    expect(results[1]).toMatchObject({ status: 'not-found' });
  });

  it('ignores mappings and reports empty persona values', () => {
    buildDom('<input id="a" type="text" /><input id="b" type="text" />');
    const persona = generatePersona('de', { seed: 9 });
    const results = fillFields(
      request(persona, [
        { selector: '#a', target: 'ignore' },
        { selector: '#b', target: 'middleName' },
      ]),
    );
    expect(results[0]).toMatchObject({ status: 'skipped', detail: 'ignored' });
    expect(results[1]).toMatchObject({
      status: 'skipped',
      detail: 'no value for this field in the persona',
    });
  });
});
