// Supabase connection. Fill these two values from your Supabase project:
// Dashboard > Project Settings > API > Project URL and the "anon public" key.
// The anon key is safe to publish; the database security rules protect the data.
// While they are empty, the site runs in preview mode with sample listings.
const URL_FROM_PROJECT = '';
const ANON_KEY_FROM_PROJECT = '';

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || URL_FROM_PROJECT;
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || ANON_KEY_FROM_PROJECT;
