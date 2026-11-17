import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } })
    : null;

export const PREVIEW = !supabase;

export function db(): SupabaseClient {
  if (!supabase) throw new Error('This is a preview with sample listings. Accounts and saving open once the database is connected.');
  return supabase;
}
