export type Role = 'buyer' | 'seller' | 'admin' | 'lawyer' | 'surveyor';
export type PropertyType = 'residential_plot' | 'agricultural' | 'converted_na' | 'approved_layout' | 'commercial_plot';
export type ListingStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type Availability = 'available' | 'under_offer' | 'sold';
export type VerificationStatus = 'not_requested' | 'requested' | 'pending_review' | 'verified' | 'discrepancy' | 'unable';
export type CheckStatus = 'not_started' | 'pending_review' | 'verified' | 'discrepancy' | 'unable';
export type SizeUnit = 'sq_yards' | 'sq_feet' | 'cents' | 'acres';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  seller_verified: boolean;
  city: string;
  created_at: string;
}

export interface Property {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  type: PropertyType;
  price: number;
  size_value: number;
  size_unit: SizeUnit;
  survey_number: string;
  village: string;
  mandal: string;
  district: string;
  state: string;
  lat: number | null;
  lng: number | null;
  approvals: string[];
  approval_ref: string;
  road_access: string;
  listing_status: ListingStatus;
  availability: Availability;
  verification_status: VerificationStatus;
  featured: boolean;
  review_note: string;
  created_at: string;
  updated_at: string;
  property_media?: Media[];
  verification_checks?: Check[];
}

export interface Media {
  id: string;
  property_id: string;
  kind: 'photo' | 'video';
  path: string;
  position: number;
}

export type DocType =
  | 'sale_deed' | 'link_documents' | 'adangal_1b' | 'passbook' | 'ec' | 'fmb_sketch'
  | 'layout_approval' | 'conversion_order' | 'tax_receipt' | 'other';

export interface PropertyDocument {
  id: string;
  property_id: string;
  owner_id: string;
  doc_type: DocType;
  file_name: string;
  path: string;
  review_status: 'pending' | 'accepted' | 'rejected';
  review_note: string;
  created_at: string;
}

export interface Enquiry {
  id: string;
  property_id: string;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  phone: string;
  message: string;
  wants_site_visit: boolean;
  preferred_date: string | null;
  status: 'new' | 'replied' | 'visit_scheduled' | 'closed';
  seller_reply: string;
  created_at: string;
  properties?: Pick<Property, 'id' | 'title' | 'village' | 'district'> | null;
}

export interface VerificationRequest {
  id: string;
  property_id: string;
  requested_by: string;
  kind: 'basic' | 'expert' | 'lawyer';
  status: 'requested' | 'assigned' | 'in_review' | 'completed' | 'cancelled';
  assigned_lawyer: string | null;
  assigned_surveyor: string | null;
  note: string;
  staff_note: string;
  created_at: string;
  properties?: Pick<Property, 'id' | 'title' | 'village' | 'district' | 'survey_number'> | null;
}

export interface Check {
  property_id: string;
  point: number;
  status: CheckStatus;
  note: string;
  updated_at: string;
}
