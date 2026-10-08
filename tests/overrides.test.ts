import { describe, expect, it } from 'vitest';

import { resolveMappings, type FieldOverride } from '../src/domain/resolve';
import type { FormTemplate } from '../src/domain/template';
import type { ScanResult } from '../src/domain/scan';
import { unknownClassification, type ClassificationKind } from '../src/domain/classification/types';

function classification(field: ClassificationKind, confidence = 0.92, needsReview = false) {
  return { field, confidence, needsReview, reason: 'test', signals: [] };
}

function fakeScan(): ScanResult {
  return {
    fields: [
      {
        selector: '#first_name',
        tag: 'input',
        label: 'First Name',
        isSelect: false,
        optionTexts: [],
        visible: true,
        classification: classification('firstName'),
      },
      {
        selector: '#mystery',
        tag: 'input',
        label: 'Customer ID',
        isSelect: false,
        optionTexts: [],
        visible: true,
        classification: unknownClassification(),
      },
      {
        selector: '#password',
        tag: 'input',
        isSelect: false,
        optionTexts: [],
        visible: true,
        classification: classification('neverFill', 0.99),
      },
    ],
    forms: [],
    sensitiveSkipped: 1,
    limitations: [],
    scannedAt: 0,
  };
}

const template: FormTemplate = {
  id: 't1',
  name: 'Learned',
  hostname: 'example.test',
  mappings: [{ selector: '#first_name', label: 'First Name', target: 'ignore' }],
  createdAt: 0,
  updatedAt: 0,
};

describe('mapping resolution', () => {
  it('auto-maps recognized fields and drops neverFill/unknown', () => {
    const mappings = resolveMappings(fakeScan());
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({
      selector: '#first_name',
      target: 'firstName',
      source: 'auto',
    });
  });

  it('applies template mappings over auto suggestions', () => {
    const mappings = resolveMappings(fakeScan(), { template });
    expect(mappings[0]).toMatchObject({
      selector: '#first_name',
      target: 'ignore',
      source: 'template',
    });
  });

  it('manual overrides win over templates', () => {
    const overrides: Record<string, FieldOverride> = {
      '#first_name': { target: 'fullName' },
    };
    const mappings = resolveMappings(fakeScan(), { template, overrides });
    expect(mappings[0]).toMatchObject({ target: 'fullName', source: 'manual', confidence: 1 });
  });

  it('fills unknown fields only through explicit overrides', () => {
    const mappings = resolveMappings(fakeScan(), {
      overrides: { '#mystery': { target: 'custom', customValue: 'QA-42' } },
    });
    const mystery = mappings.find((m) => m.selector === '#mystery');
    expect(mystery).toMatchObject({ target: 'custom', customValue: 'QA-42', source: 'manual' });
  });
});
