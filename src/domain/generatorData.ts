export type PresetId = 'de' | 'us' | 'uk' | 'jp';

export interface PresetMeta {
  id: PresetId;
  /** Human label shown in the UI. */
  label: string;
  locale: string;
  country: string;
}

export interface CityData {
  city: string;
  state?: string;
  postal: string;
  /** Phone area code (already includes trunk/mobile prefix where relevant). */
  phoneArea: string;
}

export interface PresetData {
  meta: PresetMeta;
  firstNames: string[];
  middleNames?: string[];
  lastNames: string[];
  cities: CityData[];
  streets: string[];
  companyTypes: string[];
  companySuffixes: string[];
  jobTitles: string[];
  departments: string[];
  addressLine2Samples?: string[];
  vatPrefix?: string;
}

export const PRESET_IDS: PresetId[] = ['de', 'us', 'uk', 'jp'];

export const PRESETS: Record<PresetId, PresetData> = {
  de: {
    meta: { id: 'de', label: 'German customer', locale: 'de-DE', country: 'Germany' },
    firstNames: [
      'Anna',
      'Lena',
      'Mia',
      'Emma',
      'Sofia',
      'Klara',
      'Marie',
      'Laura',
      'Jonas',
      'Lukas',
      'Felix',
      'Paul',
      'Leon',
      'Maximilian',
      'Niklas',
      'Tobias',
    ],
    lastNames: [
      'Müller',
      'Schmidt',
      'Schneider',
      'Fischer',
      'Weber',
      'Meyer',
      'Wagner',
      'Becker',
      'Hoffmann',
      'Schäfer',
      'Schulz',
      'Koch',
      'Bauer',
      'Richter',
      'Klein',
      'Schröder',
      'Braun',
      'Wolf',
    ],
    cities: [
      { city: 'München', state: 'Bayern', postal: '80331', phoneArea: '89' },
      { city: 'Berlin', state: 'Berlin', postal: '10115', phoneArea: '30' },
      { city: 'Hamburg', state: 'Hamburg', postal: '20095', phoneArea: '40' },
      { city: 'Köln', state: 'Nordrhein-Westfalen', postal: '50667', phoneArea: '221' },
      { city: 'Leipzig', state: 'Sachsen', postal: '04109', phoneArea: '341' },
      { city: 'Stuttgart', state: 'Baden-Württemberg', postal: '70173', phoneArea: '711' },
    ],
    streets: ['Examplestraße', 'Musterstraße', 'Beispielweg', 'Demoallee', 'Testgasse'],
    companyTypes: ['Design', 'Consulting', 'Systems', 'Logistics', 'Media', 'Analytics'],
    companySuffixes: ['GmbH', 'AG', 'e.K.'],
    jobTitles: [
      'Softwareentwickler',
      'QA Engineer',
      'Product Designer',
      'Projektleiter',
      'Data Analyst',
      'Vertriebsmitarbeiter',
    ],
    departments: ['Entwicklung', 'Qualitätssicherung', 'Design', 'Vertrieb', 'Einkauf', 'Finanzen'],
    vatPrefix: 'DE',
  },
  us: {
    meta: { id: 'us', label: 'US customer', locale: 'en-US', country: 'United States' },
    firstNames: [
      'James',
      'Mary',
      'Robert',
      'Patricia',
      'John',
      'Jennifer',
      'Michael',
      'Emily',
      'Olivia',
      'Jacob',
      'Ethan',
      'Ava',
      'Noah',
      'Liam',
      'Mia',
      'Sophia',
    ],
    middleNames: ['Marie', 'Rose', 'Grace', 'Lee', 'James', 'Ray', 'Alex', 'Jae'],
    lastNames: [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
      'Wilson',
      'Anderson',
      'Taylor',
      'Thomas',
      'Moore',
      'Martin',
    ],
    cities: [
      { city: 'Austin', state: 'Texas', postal: '78701', phoneArea: '512' },
      { city: 'Denver', state: 'Colorado', postal: '80202', phoneArea: '303' },
      { city: 'Seattle', state: 'Washington', postal: '98101', phoneArea: '206' },
      { city: 'Portland', state: 'Oregon', postal: '97205', phoneArea: '503' },
      { city: 'Chicago', state: 'Illinois', postal: '60601', phoneArea: '312' },
      { city: 'Boston', state: 'Massachusetts', postal: '02108', phoneArea: '617' },
      { city: 'New York', state: 'New York', postal: '10001', phoneArea: '212' },
      { city: 'Phoenix', state: 'Arizona', postal: '85001', phoneArea: '602' },
    ],
    streets: ['Example Street', 'Sample Avenue', 'Demo Lane', 'Test Boulevard', 'Mock Court'],
    companyTypes: ['Design', 'Consulting', 'Systems', 'Logistics', 'Media', 'Analytics'],
    companySuffixes: ['LLC', 'Inc.', 'Corp.'],
    jobTitles: [
      'Software Engineer',
      'QA Engineer',
      'Product Designer',
      'Project Manager',
      'Data Analyst',
      'Account Executive',
    ],
    departments: ['Engineering', 'Quality Assurance', 'Design', 'Sales', 'Operations', 'Finance'],
    addressLine2Samples: ['Apt 4B', 'Suite 200', 'Unit 12'],
  },
  uk: {
    meta: { id: 'uk', label: 'UK customer', locale: 'en-GB', country: 'United Kingdom' },
    firstNames: [
      'Oliver',
      'Amelia',
      'Harry',
      'Isla',
      'Jack',
      'Emily',
      'George',
      'Sophia',
      'Charlie',
      'Lily',
      'Oscar',
      'Freya',
    ],
    middleNames: ['Marie', 'Rose', 'Grace', 'Lee', 'Alex', 'Louise'],
    lastNames: [
      'Smith',
      'Jones',
      'Taylor',
      'Brown',
      'Williams',
      'Wilson',
      'Johnson',
      'Davies',
      'Robinson',
      'Wright',
      'Thompson',
      'Evans',
      'Clarke',
    ],
    cities: [
      { city: 'London', postal: 'E1 6AN', phoneArea: '20 7946' },
      { city: 'Manchester', postal: 'M1 5GD', phoneArea: '161 496' },
      { city: 'Birmingham', postal: 'B2 4QA', phoneArea: '121 496' },
      { city: 'Leeds', postal: 'LS1 4AB', phoneArea: '113 496' },
      { city: 'Bristol', postal: 'BS1 4QA', phoneArea: '117 496' },
      { city: 'Edinburgh', postal: 'EH1 1AE', phoneArea: '131 496' },
    ],
    streets: ['Example Road', 'Sample Lane', 'Demo Gardens', 'Test Close', 'Mock Row'],
    companyTypes: ['Design', 'Consulting', 'Systems', 'Logistics', 'Media', 'Analytics'],
    companySuffixes: ['Ltd', 'PLC', '& Co.'],
    jobTitles: [
      'Software Engineer',
      'QA Engineer',
      'Product Designer',
      'Project Manager',
      'Data Analyst',
      'Account Manager',
    ],
    departments: ['Engineering', 'Quality Assurance', 'Design', 'Sales', 'Operations', 'Finance'],
    addressLine2Samples: ['Flat 2', 'Suite 5'],
    vatPrefix: 'GB',
  },
  jp: {
    meta: { id: 'jp', label: 'Japanese customer', locale: 'ja-JP', country: 'Japan' },
    firstNames: [
      'Yuki',
      'Haruto',
      'Sakura',
      'Hana',
      'Rin',
      'Aoi',
      'Ren',
      'Mei',
      'Kaori',
      'Daiki',
      'Sora',
      'Yuina',
    ],
    lastNames: [
      'Sato',
      'Suzuki',
      'Takahashi',
      'Tanaka',
      'Watanabe',
      'Ito',
      'Yamamoto',
      'Nakamura',
      'Kobayashi',
      'Kato',
    ],
    cities: [
      { city: 'Tokyo', state: 'Tokyo', postal: '100-0001', phoneArea: '90' },
      { city: 'Osaka', state: 'Osaka', postal: '530-0001', phoneArea: '90' },
      { city: 'Kyoto', state: 'Kyoto', postal: '600-8001', phoneArea: '90' },
      { city: 'Fukuoka', state: 'Fukuoka', postal: '812-0018', phoneArea: '90' },
    ],
    streets: ['Example-dori', 'Sample-machi', 'Demo-suji'],
    companyTypes: ['Design', 'Consulting', 'Systems', 'Logistics', 'Media', 'Analytics'],
    companySuffixes: ['K.K.', 'Co., Ltd.'],
    jobTitles: [
      'Software Engineer',
      'QA Engineer',
      'Product Designer',
      'Project Manager',
      'Data Analyst',
      'Account Planner',
    ],
    departments: ['Engineering', 'Quality Assurance', 'Design', 'Sales', 'Operations', 'Finance'],
  },
};
