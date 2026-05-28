// Supabase Admin 客户端（服务端使用，拥有完整权限）
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabaseAdmin;
}

// Storage 辅助函数
export async function ensureBucket(bucket: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error('listBuckets 失败:', listErr);
    throw new Error(`列出 Storage bucket 失败: ${listErr.message}`);
  }
  if (!buckets?.find((b) => b.name === bucket)) {
    const { error: createErr } = await supabase.storage.createBucket(bucket, { public: true });
    if (createErr) {
      console.error('createBucket 失败:', createErr);
      throw new Error(`创建 Storage bucket 失败: ${createErr.message}`);
    }
  }
}

export async function uploadToStorage(
  bucket: string,
  path: string,
  file: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  return getPublicUrl(bucket, path);
}

export function getPublicUrl(bucket: string, path: string): string {
  const supabase = getSupabaseAdmin();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
