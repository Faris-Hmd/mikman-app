import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ycturdveinsiaaucontk.supabase.co';
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljdHVyZHZlaW5zaWFhdWNvbnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxOTA4MjEsImV4cCI6MjA5OTc2NjgyMX0._Xs4k4R62BuzzasyItbkKlYZR6ruOvA1NTvAmY_brQw'


// NEXT_PUBLIC_SUPABASE_URL=https://ycturdveinsiaaucontk.supabase.co
// NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljdHVyZHZlaW5zaWFhdWNvbnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxOTA4MjEsImV4cCI6MjA5OTc2NjgyMX0._Xs4k4R62BuzzasyItbkKlYZR6ruOvA1NTvAmY_brQw


export const supabase = createClient(supabaseUrl, supabaseAnon);