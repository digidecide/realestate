import type { Availability, CheckStatus, DocType, ListingStatus, PropertyType, Role, SizeUnit, VerificationStatus } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  buyer: 'Buyer', seller: 'Seller', admin: 'Admin', lawyer: 'Lawyer', surveyor: 'Land surveyor',
};

export const TYPE_LABEL: Record<PropertyType, string> = {
  residential_plot: 'Residential plot',
  agricultural: 'Agricultural land',
  converted_na: 'Converted (non-agricultural) land',
  approved_layout: 'Plot in approved layout',
  commercial_plot: 'Commercial plot',
};

export const UNIT_LABEL: Record<SizeUnit, string> = {
  sq_yards: 'sq. yards', sq_feet: 'sq. ft', cents: 'cents', acres: 'acres',
};

// Square yards per unit, used to compare sizes across units.
export const UNIT_TO_SQYD: Record<SizeUnit, number> = {
  sq_yards: 1, sq_feet: 1 / 9, cents: 48.4, acres: 4840,
};

export const LISTING_LABEL: Record<ListingStatus, string> = {
  draft: 'Draft', pending: 'Waiting for review', approved: 'Live', rejected: 'Changes needed',
};

export const AVAIL_LABEL: Record<Availability, string> = {
  available: 'Available', under_offer: 'Under offer', sold: 'Sold',
};

export const VERIF_LABEL: Record<VerificationStatus, string> = {
  not_requested: 'Not verified',
  requested: 'Verification requested',
  pending_review: 'Pending review',
  verified: 'Verified',
  discrepancy: 'Discrepancy found',
  unable: 'Unable to verify',
};

export const CHECK_LABEL: Record<CheckStatus, string> = {
  not_started: 'Not checked',
  pending_review: 'Pending review',
  verified: 'Verified',
  discrepancy: 'Discrepancy found',
  unable: 'Unable to verify',
};

export const DOC_LABEL: Record<DocType, string> = {
  sale_deed: 'Registered sale deed',
  link_documents: 'Link documents (earlier deeds)',
  adangal_1b: 'Adangal / 1-B extract',
  passbook: 'Pattadar passbook',
  ec: 'Encumbrance Certificate (EC)',
  fmb_sketch: 'FMB / survey sketch',
  layout_approval: 'DTCP / APCRDA layout approval',
  conversion_order: 'Land conversion order',
  tax_receipt: 'Property tax receipt',
  other: 'Other document',
};

export const APPROVALS = ['DTCP', 'APCRDA', 'VMRDA', 'Municipal / panchayat', 'RERA', 'NA conversion'];

export const DISTRICTS = [
  'NTR', 'Krishna', 'Guntur', 'Palnadu', 'Bapatla', 'Eluru', 'West Godavari', 'East Godavari',
  'Prakasam', 'Nellore', 'Visakhapatnam', 'Other',
];

export interface VerificationPoint { n: number; title: string; source: string }

export const TWELVE_POINTS: VerificationPoint[] = [
  { n: 1, title: 'Survey number and survey sketch', source: 'Survey and FMB records' },
  { n: 2, title: 'Legal ownership', source: 'AP MeeBhoomi (Adangal / 1-B)' },
  { n: 3, title: 'Registered sale deed and title chain', source: 'AP Registration Department' },
  { n: 4, title: 'Encumbrance Certificate', source: 'AP Registration Department (EC)' },
  { n: 5, title: 'Land classification and restrictions', source: 'Land conversion and classification records' },
  { n: 6, title: 'Mortgages and court cases', source: 'EC and court records' },
  { n: 7, title: 'DTCP / APCRDA layout approval', source: 'APCRDA / DTCP' },
  { n: 8, title: 'FTL and waterbody buffer zone', source: 'FTL and buffer-zone records' },
  { n: 9, title: 'Physical measurement and boundaries', source: 'Land surveyor site visit' },
  { n: 10, title: 'Legal road access', source: 'Layout plan and site visit' },
  { n: 11, title: 'Prohibited property and land acquisition', source: 'Section 22-A list and acquisition notices' },
  { n: 12, title: 'Independent lawyer’s title review', source: 'Assigned lawyer' },
];
