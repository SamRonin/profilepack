export interface IdentityData {
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  username: string;
  /** ISO 8601 date (yyyy-mm-dd). Locale-specific formatting happens at fill time. */
  dateOfBirth: string;
}

export interface ContactData {
  email: string;
  phone: string;
}

export interface AddressData {
  country: string;
  state?: string;
  city: string;
  street?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode: string;
}

export interface BusinessData {
  company?: string;
  jobTitle?: string;
  department?: string;
  vatId?: string;
}

export interface OptionalPersonaData {
  website?: string;
  notes?: string;
}

export interface PersonaData {
  identity: IdentityData;
  contact: ContactData;
  address: AddressData;
  business: BusinessData;
  optional: OptionalPersonaData;
}

export interface Persona {
  id: string;
  /** Display name, defaults to the persona full name. */
  name: string;
  locale: string;
  country: string;
  createdAt: number;
  updatedAt: number;
  data: PersonaData;
}
