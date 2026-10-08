import { describe, expect, it } from 'vitest';

import { classifyField } from '../src/domain/classification/classifier';
import type { FieldInput } from '../src/domain/classification/types';

function classify(overrides: Partial<FieldInput>): ReturnType<typeof classifyField> {
  return classifyField({ tag: 'input', ...overrides });
}

describe('confidence scoring', () => {
  it('autocomplete is the strongest single signal (0.99)', () => {
    expect(classify({ autocomplete: 'given-name' }).confidence).toBe(0.99);
  });

  it('name attribute alone scores 0.92 and passes the review threshold', () => {
    const result = classify({ name: 'first_name' });
    expect(result.confidence).toBe(0.92);
    expect(result.needsReview).toBe(false);
  });

  it('combines agreeing signals with a bonus, capped at 0.99', () => {
    const result = classify({ name: 'first_name', autocomplete: 'given-name' });
    expect(result.confidence).toBe(0.99);
  });

  it('adds the agreement bonus for name + label agreement', () => {
    const result = classify({ name: 'phone_number', label: 'Phone' });
    expect(result.confidence).toBe(0.96);
  });

  it('label alone scores 0.85', () => {
    expect(classify({ label: 'Vorname' }).confidence).toBe(0.85);
  });

  it('placeholder alone is below the review threshold', () => {
    const result = classify({ placeholder: 'Enter your email' });
    expect(result.confidence).toBe(0.62);
    expect(result.needsReview).toBe(true);
  });

  it('flags conflicts between signals for manual review', () => {
    // name="name" suggests fullName, label "Company Name" suggests company.
    const result = classify({ name: 'name', label: 'Company Name' });
    expect(result.field).toBe('fullName');
    expect(result.needsReview).toBe(true);
    expect(result.confidence).toBeLessThan(0.85);
    expect(result.reason).toContain('conflicting');
  });

  it('reports a reason with signal evidence', () => {
    const result = classify({ name: 'billing_zip' });
    expect(result.reason).toContain('name');
    expect(result.reason).toContain('zip');
  });
});
