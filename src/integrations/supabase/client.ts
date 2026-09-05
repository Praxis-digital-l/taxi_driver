import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const FALLBACK_PROJECT_ID = 'ywcgtwlhievzgflmncsq';
const FALLBACK_SUPABASE_URL = `https://${FALLBACK_PROJECT_ID}.supabase.co`;
const FALLBACK_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3Y2d0d2xoaWV2emdmbG1uY3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzU1MzQsImV4cCI6MjA5OTgxMTUzNH0.lfzCaFknUjJqt4skcB5_ko4o7gU2fYoML7xeYZouGiU';

const envSupabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const envProjectId = String(import.meta.env.VITE_SUPABASE_PROJECT_ID ?? '').trim();
const envPublishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

const resolvedSupabaseUrl =
  envSupabaseUrl || (envProjectId ? `https://${envProjectId}.supabase.co` : FALLBACK_SUPABASE_URL);
const resolvedPublishableKey = envPublishableKey || FALLBACK_PUBLISHABLE_KEY;

const supabaseRuntimeUrl = import.meta.env.DEV
  ? `${window.location.origin}/supabase`
  : resolvedSupabaseUrl;

export const supabase = createClient<Database>(supabaseRuntimeUrl, resolvedPublishableKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
