import { createClient } from '@supabase/supabase-js';

// Support both Vite (import.meta.env) and Node (process.env)
const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing. Check your .env file.'
  );
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);
