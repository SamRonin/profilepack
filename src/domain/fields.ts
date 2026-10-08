import type { PersonaData } from './persona';

/**
 * The internal ProfilePack schema that website fields are mapped to.
 * Extending this list is a breaking change for saved templates — add
 * new fields at the end and update FIELD_LABELS / FIELD_PATHS.
 */
export const PROFILE_FIELDS = [
  'firstName',
  'middleName',
  'lastName',
  'fullName',
  'username',
  'dateOfBirth',
  'email',
  'phone',
  'country',
  'state',
  'city',
  'street',
  'addressLine1',
  'addressLine2',
  'postalCode',
  'company',
  'jobTitle',
  'department',
  'vatId',
  'website',
  'notes',
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

/** What a website field can be mapped to. */
export type MappingTarget = ProfileField | 'custom' | 'ignore';

export const FIELD_LABELS: Record<ProfileField, string> = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  fullName: 'Full name',
  username: 'Username',
  dateOfBirth: 'Date of birth',
  email: 'Email',
  phone: 'Phone',
  country: 'Country',
  state: 'State / region',
  city: 'City',
  street: 'Street',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',
  postalCode: 'Postal code',
  company: 'Company',
  jobTitle: 'Job title',
  department: 'Department',
  vatId: 'VAT ID',
  website: 'Website',
  notes: 'Notes',
};

/** Dotted path of each field inside PersonaData. */
export const FIELD_PATHS: Record<ProfileField, string> = {
  firstName: 'identity.firstName',
  middleName: 'identity.middleName',
  lastName: 'identity.lastName',
  fullName: 'identity.fullName',
  username: 'identity.username',
  dateOfBirth: 'identity.dateOfBirth',
  email: 'contact.email',
  phone: 'contact.phone',
  country: 'address.country',
  state: 'address.state',
  city: 'address.city',
  street: 'address.street',
  addressLine1: 'address.addressLine1',
  addressLine2: 'address.addressLine2',
  postalCode: 'address.postalCode',
  company: 'business.company',
  jobTitle: 'business.jobTitle',
  department: 'business.department',
  vatId: 'business.vatId',
  website: 'optional.website',
  notes: 'optional.notes',
};

/** Reads a ProfileField value from persona data. Returns '' when unset. */
export function getPersonaValue(data: PersonaData, field: ProfileField): string {
  let current: unknown = data;
  for (const key of FIELD_PATHS[field].split('.')) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return '';
    }
  }
  return typeof current === 'string' ? current : '';
}
