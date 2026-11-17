import { db, PREVIEW, supabase } from './supabase';
import { SAMPLE } from './sample';
import { UNIT_TO_SQYD } from './labels';
import type {
  Check, CheckStatus, DocType, Enquiry, Media, Profile, Property, PropertyDocument, PropertyType, Role, VerificationRequest,
} from './types';

const PROPERTY_SELECT = '*, property_media(id,property_id,kind,path,position), verification_checks(property_id,point,status,note,updated_at)';

export interface SearchFilters {
  q?: string;
  district?: string;
  type?: PropertyType | '';
  minPrice?: number;
  maxPrice?: number;
  minSqyd?: number;
  maxSqyd?: number;
  approval?: string;
  verifiedOnly?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc';
}

function sqyd(p: Property) {
  return p.size_value * UNIT_TO_SQYD[p.size_unit];
}

function applyLocal(list: Property[], f: SearchFilters) {
  const q = (f.q || '').trim().toLowerCase();
  let r = list.filter((p) =>
    (!q || [p.title, p.village, p.mandal, p.district, p.survey_number].join(' ').toLowerCase().includes(q)) &&
    (!f.district || p.district === f.district) &&
    (!f.type || p.type === f.type) &&
    (!f.minPrice || p.price >= f.minPrice) &&
    (!f.maxPrice || p.price <= f.maxPrice) &&
    (!f.minSqyd || sqyd(p) >= f.minSqyd) &&
    (!f.maxSqyd || sqyd(p) <= f.maxSqyd) &&
    (!f.approval || p.approvals.includes(f.approval)) &&
    (!f.verifiedOnly || p.verification_status === 'verified'));
  if (f.sort === 'price_asc') r = r.sort((a, b) => a.price - b.price);
  else if (f.sort === 'price_desc') r = r.sort((a, b) => b.price - a.price);
  else r = r.sort((a, b) => Number(b.featured) - Number(a.featured) || b.created_at.localeCompare(a.created_at));
  return r;
}

export async function searchProperties(f: SearchFilters): Promise<Property[]> {
  if (PREVIEW) return applyLocal([...SAMPLE], f);
  let q = db().from('properties').select(PROPERTY_SELECT).eq('listing_status', 'approved').limit(300);
  if (f.district) q = q.eq('district', f.district);
  if (f.type) q = q.eq('type', f.type);
  if (f.minPrice) q = q.gte('price', f.minPrice);
  if (f.maxPrice) q = q.lte('price', f.maxPrice);
  if (f.approval) q = q.contains('approvals', [f.approval]);
  if (f.verifiedOnly) q = q.eq('verification_status', 'verified');
  const { data, error } = await q;
  if (error) throw error;
  // Text search and size (stored in mixed units) are filtered here.
  return applyLocal((data || []) as Property[], { ...f, district: '', type: '', approval: '', verifiedOnly: false, minPrice: 0, maxPrice: 0 });
}

export async function getProperty(id: string): Promise<Property | null> {
  if (PREVIEW) return SAMPLE.find((p) => p.id === id) || null;
  const { data, error } = await db().from('properties').select(PROPERTY_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Property | null;
}

export function mediaUrl(path: string): string {
  if (!supabase) return '';
  return supabase.storage.from('property-media').getPublicUrl(path).data.publicUrl;
}

export function sortedMedia(p: Property): Media[] {
  return [...(p.property_media || [])].sort((a, b) => a.position - b.position);
}

// ---------------------------------------------------------------- profile
export async function getProfile(uid: string): Promise<Profile | null> {
  const { data, error } = await db().from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}
export async function updateMyProfile(uid: string, v: { full_name: string; city: string; phone: string }) {
  const a = await db().from('profiles').update({ full_name: v.full_name, city: v.city }).eq('id', uid);
  if (a.error) throw a.error;
  const b = await db().from('contact_details').upsert({ user_id: uid, phone: v.phone, updated_at: new Date().toISOString() });
  if (b.error) throw b.error;
}
export async function getMyPhone(uid: string): Promise<string> {
  const { data } = await db().from('contact_details').select('phone').eq('user_id', uid).maybeSingle();
  return (data as { phone: string } | null)?.phone || '';
}

// ---------------------------------------------------------------- seller
export async function myProperties(uid: string): Promise<Property[]> {
  const { data, error } = await db().from('properties').select(PROPERTY_SELECT).eq('seller_id', uid).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Property[];
}

export type PropertyInput = Omit<Property,
  'id' | 'seller_id' | 'verification_status' | 'featured' | 'review_note' | 'created_at' | 'updated_at' | 'property_media' | 'verification_checks'>;

export async function saveProperty(id: string | null, v: PropertyInput): Promise<string> {
  if (id) {
    const { error } = await db().from('properties').update(v).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await db().from('properties').insert(v).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteProperty(id: string) {
  const { error } = await db().from('properties').delete().eq('id', id);
  if (error) throw error;
}

function safeName(name: string) {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : '';
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + ext;
}

export async function uploadMedia(uid: string, propertyId: string, file: File, position: number) {
  const kind = file.type.startsWith('video/') ? 'video' : 'photo';
  if (!file.type.startsWith('image/') && kind !== 'video') throw new Error(file.name + ' is not a photo or video.');
  if (file.size > 50 * 1024 * 1024) throw new Error(file.name + ' is larger than 50 MB.');
  const path = `${uid}/${propertyId}/${safeName(file.name)}`;
  const up = await db().storage.from('property-media').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw up.error;
  const { error } = await db().from('property_media').insert({ property_id: propertyId, kind, path, position });
  if (error) throw error;
}

export async function deleteMedia(m: Media) {
  await db().storage.from('property-media').remove([m.path]);
  const { error } = await db().from('property_media').delete().eq('id', m.id);
  if (error) throw error;
}

export async function listDocuments(propertyId: string): Promise<PropertyDocument[]> {
  const { data, error } = await db().from('property_documents').select('*').eq('property_id', propertyId).order('created_at');
  if (error) throw error;
  return (data || []) as PropertyDocument[];
}

export async function uploadDocument(uid: string, propertyId: string, file: File, docType: DocType) {
  if (file.size > 20 * 1024 * 1024) throw new Error(file.name + ' is larger than 20 MB.');
  const ok = file.type === 'application/pdf' || file.type.startsWith('image/');
  if (!ok) throw new Error(file.name + ' must be a PDF or a photo.');
  const path = `${uid}/${propertyId}/${safeName(file.name)}`;
  const up = await db().storage.from('property-documents').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw up.error;
  const { error } = await db().from('property_documents').insert({ property_id: propertyId, doc_type: docType, path, file_name: file.name.slice(0, 160) });
  if (error) throw error;
}

export async function documentLink(path: string): Promise<string> {
  const { data, error } = await db().storage.from('property-documents').createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocument(d: PropertyDocument) {
  await db().storage.from('property-documents').remove([d.path]);
  const { error } = await db().from('property_documents').delete().eq('id', d.id);
  if (error) throw error;
}

// ---------------------------------------------------------------- enquiries
export async function sendEnquiry(v: { property_id: string; buyer_name: string; phone: string; message: string; wants_site_visit: boolean; preferred_date: string | null }) {
  const { error } = await db().from('enquiries').insert(v);
  if (error) throw error;
}
const ENQ_SELECT = '*, properties(id,title,village,district)';
export async function enquiriesFor(uid: string, side: 'buyer' | 'seller'): Promise<Enquiry[]> {
  const { data, error } = await db().from('enquiries').select(ENQ_SELECT).eq(side === 'buyer' ? 'buyer_id' : 'seller_id', uid).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Enquiry[];
}
export async function updateEnquiry(id: string, v: Partial<Pick<Enquiry, 'status' | 'seller_reply'>>) {
  const { error } = await db().from('enquiries').update(v).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------- favourites
export async function favouriteIds(): Promise<Set<string>> {
  if (PREVIEW) return new Set();
  const { data } = await db().from('favourites').select('property_id');
  return new Set(((data || []) as { property_id: string }[]).map((r) => r.property_id));
}
export async function setFavourite(propertyId: string, on: boolean) {
  const r = on
    ? await db().from('favourites').insert({ property_id: propertyId })
    : await db().from('favourites').delete().eq('property_id', propertyId);
  if (r.error && r.error.code !== '23505') throw r.error;
}
export async function favouriteProperties(): Promise<Property[]> {
  const { data, error } = await db().from('favourites').select('properties(' + PROPERTY_SELECT + ')').order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as unknown as { properties: Property | null }[]).map((r) => r.properties).filter((p): p is Property => !!p);
}

// ---------------------------------------------------------------- verification
const VR_SELECT = '*, properties(id,title,village,district,survey_number)';
export async function requestVerification(propertyId: string, kind: VerificationRequest['kind'], note: string) {
  const { error } = await db().from('verification_requests').insert({ property_id: propertyId, kind, note });
  if (error) throw error;
}
export async function verificationRequests(scope: { requestedBy?: string; assignedTo?: string; propertyIds?: string[] } = {}): Promise<VerificationRequest[]> {
  let q = db().from('verification_requests').select(VR_SELECT).order('created_at', { ascending: false });
  if (scope.requestedBy) q = q.eq('requested_by', scope.requestedBy);
  if (scope.assignedTo) q = q.or(`assigned_lawyer.eq.${scope.assignedTo},assigned_surveyor.eq.${scope.assignedTo}`);
  if (scope.propertyIds) q = q.in('property_id', scope.propertyIds.length ? scope.propertyIds : ['00000000-0000-0000-0000-000000000000']);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as VerificationRequest[];
}
export async function updateRequest(id: string, v: Partial<Pick<VerificationRequest, 'status' | 'assigned_lawyer' | 'assigned_surveyor' | 'staff_note'>>) {
  const { error } = await db().from('verification_requests').update(v).eq('id', id);
  if (error) throw error;
}
export async function saveCheck(propertyId: string, point: number, status: CheckStatus, note: string): Promise<Check> {
  const { data, error } = await db().from('verification_checks').upsert({ property_id: propertyId, point, status, note }).select().single();
  if (error) throw error;
  return data as Check;
}

// ---------------------------------------------------------------- admin
export async function allUsers(): Promise<Profile[]> {
  const { data, error } = await db().from('profiles').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []) as Profile[];
}
export async function setUser(id: string, v: { role?: Role; seller_verified?: boolean }) {
  const { error } = await db().from('profiles').update(v).eq('id', id);
  if (error) throw error;
}
export async function allProperties(status?: Property['listing_status']): Promise<Property[]> {
  let q = db().from('properties').select(PROPERTY_SELECT).order('updated_at', { ascending: false }).limit(300);
  if (status) q = q.eq('listing_status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Property[];
}
export async function reviewProperty(id: string, v: Partial<Pick<Property, 'listing_status' | 'review_note' | 'featured' | 'verification_status'>>) {
  const { error } = await db().from('properties').update(v).eq('id', id);
  if (error) throw error;
}
export async function documentsToReview(): Promise<(PropertyDocument & { properties: { title: string } | null })[]> {
  const { data, error } = await db().from('property_documents').select('*, properties(title)').eq('review_status', 'pending').order('created_at').limit(200);
  if (error) throw error;
  return (data || []) as (PropertyDocument & { properties: { title: string } | null })[];
}
export async function reviewDocument(id: string, review_status: PropertyDocument['review_status'], review_note: string) {
  const { error } = await db().from('property_documents').update({ review_status, review_note }).eq('id', id);
  if (error) throw error;
}

/** Opens a private document in a new tab. The tab is opened first so pop-up blockers allow it. */
export async function openDocument(path: string) {
  const w = window.open('', '_blank');
  try {
    const url = await documentLink(path);
    if (w) { w.opener = null; w.location.href = url; } else window.location.href = url;
  } catch (e) { w?.close(); throw e; }
}
