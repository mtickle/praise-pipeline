import { createClient } from '@supabase/supabase-js';

// Pull in the secure, frontend-safe environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Initialize and export the client so your dashboard can use it
export const supabase = createClient(supabaseUrl, supabaseKey);