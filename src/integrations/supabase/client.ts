import { createClient } from '@supabase/supabase-js';
import { mockSupabase } from './mock';
import type { Database } from './types';

const FALLBACK_PROJECT_ID = 'jqhpzfdcjqqdigkrcffk';
const FALLBACK_SUPABASE_URL = `https://${FALLBACK_PROJECT_ID}.supabase.co`;
const FALLBACK_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxaHB6ZmRjanFxZGlna3JjZmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzQ1NzgsImV4cCI6MjA5MDc1MDU3OH0.zrvfFMG-fXdRW_-CLl3hEzpp4FbGed2QEtGAAhde4Qk';

const envSupabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const envProjectId = String(import.meta.env.VITE_SUPABASE_PROJECT_ID ?? '').trim();
const envPublishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

const resolvedSupabaseUrl =
  envSupabaseUrl || (envProjectId ? `https://${envProjectId}.supabase.co` : FALLBACK_SUPABASE_URL);
const resolvedPublishableKey = envPublishableKey || FALLBACK_PUBLISHABLE_KEY;

const useMockSupabase = String(import.meta.env.VITE_USE_MOCK_SUPABASE ?? '').toLowerCase() === 'true';
const hasValidConfig =
  resolvedSupabaseUrl.startsWith('http') && resolvedSupabaseUrl.includes('supabase.co') && resolvedPublishableKey.length > 20;

const supabaseRuntimeUrl = import.meta.env.DEV
  ? `${window.location.origin}/supabase`
  : resolvedSupabaseUrl;

let supabase: any;

if (useMockSupabase) {
  console.warn('⚠️ Usando Supabase MOCK porque VITE_USE_MOCK_SUPABASE=true');
  supabase = mockSupabase;
} else if (hasValidConfig) {
  supabase = createClient<Database>(supabaseRuntimeUrl, resolvedPublishableKey, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
} else {
  console.error('❌ Configuración de Supabase inválida. Activa VITE_USE_MOCK_SUPABASE=true para trabajar sin backend.');
  supabase = mockSupabase;
}

export { supabase };
