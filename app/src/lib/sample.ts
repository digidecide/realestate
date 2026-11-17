import type { Check, CheckStatus, Property } from './types';

// Sample listings shown only in preview mode, before the database is connected.
// They are clearly labelled on screen and are not real properties.
function checks(id: string, s: CheckStatus[]): Check[] {
  return s.map((status, i) => ({ property_id: id, point: i + 1, status, note: '', updated_at: '2026-11-10' }));
}
const base = {
  seller_id: 'sample', state: 'Andhra Pradesh', listing_status: 'approved' as const, review_note: '',
  created_at: '2026-11-10T09:00:00Z', updated_at: '2026-11-12T09:00:00Z', property_media: [],
};
const V = 'verified', P = 'pending_review', N = 'not_started', D = 'discrepancy';

export const SAMPLE: Property[] = [
  {
    ...base, id: 's1', title: 'East-facing plot near Ganguru main road',
    description: 'Sample listing. 30 ft road on the east side, 2 km from Benz Circle. Clear boundary stones in place.',
    type: 'approved_layout', price: 6300000, size_value: 200, size_unit: 'sq_yards', survey_number: '112/2B',
    village: 'Ganguru', mandal: 'Penamaluru', district: 'Krishna', lat: 16.4794, lng: 80.7181,
    approvals: ['APCRDA'], approval_ref: 'LP 104/2019', road_access: '30 ft layout road', availability: 'available',
    verification_status: 'verified', featured: true,
    verification_checks: checks('s1', [V, V, V, V, V, V, V, V, V, V, V, V]),
  },
  {
    ...base, id: 's2', title: '2.4 acres of wet land beside Krishna canal',
    description: 'Sample listing. Paddy land with canal water, single owner, Adangal in owner name.',
    type: 'agricultural', price: 31200000, size_value: 2.4, size_unit: 'acres', survey_number: '45/1',
    village: 'Kankipadu', mandal: 'Kankipadu', district: 'Krishna', lat: 16.4404, lng: 80.7716,
    approvals: [], approval_ref: '', road_access: 'Cart track, 12 ft', availability: 'available',
    verification_status: 'discrepancy', featured: false,
    verification_checks: checks('s2', [V, V, D, V, V, V, N, P, P, D, V, N]),
  },
  {
    ...base, id: 's3', title: 'Corner commercial plot on Amaravati seed access road',
    description: 'Sample listing. Corner site with two road frontages, suited to showroom or clinic.',
    type: 'commercial_plot', price: 14500000, size_value: 3600, size_unit: 'sq_feet', survey_number: '201/A',
    village: 'Thullur', mandal: 'Thullur', district: 'Guntur', lat: 16.5262, lng: 80.4436,
    approvals: ['APCRDA'], approval_ref: 'CRDA/LPS/2021/88', road_access: '60 ft and 40 ft roads', availability: 'under_offer',
    verification_status: 'pending_review', featured: true,
    verification_checks: checks('s3', [V, V, V, P, P, N, V, N, N, V, V, N]),
  },
  {
    ...base, id: 's4', title: 'Converted NA plot in Mangalagiri, ready for house construction',
    description: 'Sample listing. Conversion order issued, water and power lines on the road.',
    type: 'converted_na', price: 4200000, size_value: 167, size_unit: 'sq_yards', survey_number: '78/3',
    village: 'Nidamarru', mandal: 'Mangalagiri', district: 'Guntur', lat: 16.4302, lng: 80.5525,
    approvals: ['NA conversion'], approval_ref: 'RDO/CNV/2024/17', road_access: '33 ft panchayat road', availability: 'available',
    verification_status: 'not_requested', featured: false,
    verification_checks: [],
  },
  {
    ...base, id: 's5', title: 'Residential plot in Gollapudi, walk to the bypass',
    description: 'Sample listing. Quiet residential street, all sides constructed.',
    type: 'residential_plot', price: 5800000, size_value: 150, size_unit: 'sq_yards', survey_number: '310/1',
    village: 'Gollapudi', mandal: 'Vijayawada Rural', district: 'NTR', lat: 16.5466, lng: 80.5797,
    approvals: ['VMRDA'], approval_ref: '', road_access: '40 ft road', availability: 'available',
    verification_status: 'requested', featured: false,
    verification_checks: checks('s5', [V, V, P, N, N, N, N, N, N, N, N, N]),
  },
];
