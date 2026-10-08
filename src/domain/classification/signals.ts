import type { DictField } from './dictionary';

/**
 * HTML autocomplete token → ProfilePack field.
 * https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill-detail-tokens
 */
export const AUTOCOMPLETE_MAP: Record<string, DictField> = {
  'given-name': 'firstName',
  'additional-name': 'middleName',
  'family-name': 'lastName',
  name: 'fullName',
  username: 'username',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'tel-local': 'phone',
  'postal-code': 'postalCode',
  'street-address': 'addressLine1',
  'address-line1': 'addressLine1',
  'address-line2': 'addressLine2',
  'address-level1': 'state',
  'address-level2': 'city',
  country: 'country',
  'country-name': 'country',
  organization: 'company',
  'organization-title': 'jobTitle',
  'organization-unit': 'department',
  bday: 'dateOfBirth',
  url: 'website',
  // security-relevant autocomplete tokens
  'current-password': 'neverFill',
  'new-password': 'neverFill',
  'cc-number': 'neverFill',
  'cc-csc': 'neverFill',
  'cc-exp': 'neverFill',
  'cc-exp-month': 'neverFill',
  'cc-exp-year': 'neverFill',
  'cc-name': 'neverFill',
  'cc-given-name': 'neverFill',
  'cc-family-name': 'neverFill',
};

/** input[type] → classification (used as one signal among many). */
export const TYPE_MAP: Record<string, { field: DictField; score: number }> = {
  email: { field: 'email', score: 0.95 },
  tel: { field: 'phone', score: 0.9 },
  url: { field: 'website', score: 0.85 },
};

/** Attribute tokens that are stripped from the front of name/id values. */
export const NOISE_PREFIXES: ReadonlySet<string> = new Set([
  'billing',
  'shipping',
  'delivery',
  'invoice',
  'home',
  'work',
  'main',
  'primary',
  'secondary',
  'account',
  'user',
  'profile',
  'signup',
  'register',
  'registration',
  'reg',
  'form',
  'field',
  'input',
  'txt',
  'tb',
  'ddl',
  'drp',
  'cbo',
  'ctl',
  'edit',
  'new',
]);
