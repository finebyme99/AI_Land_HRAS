// Supabase 浏览器客户端
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function createSupabaseBrowser(): SupabaseClient {
  if (!_supabase) {
    _supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
    );
  }
  return _supabase;
}
