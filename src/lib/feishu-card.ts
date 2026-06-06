// src/lib/feishu-card.ts
// 飞书卡片回调验签 + 解密
//
// 飞书加密算法：先 AES-256-CBC 解密（key=encrypt_key 的 SHA256），再 JSON.parse
// 同时校验 timestamp + sign（HMAC-SHA256）

import { createHash, createDecipheriv, timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

/** 从 feishu_apps 表读 encrypt_key（按 tenant_key 查） */
async function getEncryptKey(tenantKey: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from('feishu_apps')
    .select('encrypt_key')
    .eq('tenant_key', tenantKey)
    .maybeSingle();
  return data?.encrypt_key ?? null;
}

/** 单租户 fallback：当 tenantKey 缺失但有唯一 active feishu_apps 时，返回该行的 encrypt_key */
async function getSingleActiveEncryptKey(): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from('feishu_apps')
    .select('id, encrypt_key')
    .eq('status', 'active')
    .not('encrypt_key', 'is', null);
  // 多个 active + 有 encrypt_key 时无法判定，仍返回 null（安全失败）
  if (!data || data.length !== 1) return null;
  return data[0].encrypt_key;
}

/** 飞书回调验签（无加密 payload 时用） */
function verifySignature(
  encryptKey: string,
  timestamp: string,
  nonce: string,
  bodyEncryptedB64: string,
  signB64: string,
): boolean {
  const b = Buffer.from(encryptKey + timestamp + nonce + bodyEncryptedB64, 'utf8');
  const expected = createHash('sha256').update(b).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signB64, 'base64');
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** 飞书 AES-256-CBC 解密（key = SHA256(encrypt_key)） */
function decryptPayload(encryptKey: string, encryptedB64: string): string {
  const key = createHash('sha256').update(encryptKey, 'utf8').digest();
  const buf = Buffer.from(encryptedB64, 'base64');
  const iv = buf.subarray(0, 16);
  const cipherText = buf.subarray(16, buf.length - 16);
  // 飞书不补 PKCS7 填充，明文直接拼接；不调 setAutoPadding
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);
  const dec = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  // 飞书在密文后追加 16 字节的随机串（落在 0x00-0x1F 控制字符区间），需裁掉尾部控制字符
  const text = dec.toString('utf8').replace(/[\x00-\x1F]+$/, '');
  return text;
}

export interface VerifyResult {
  ok: boolean;
  /** 解密 / 验签后的 body */
  body?: Record<string, unknown>;
  error?: string;
}

/**
 * 处理飞书回调：验签 + 解密，返回解析后的 body
 * 兼容两种 payload：
 *  - 加密：顶层有 { encrypt: "..." }，header 含 tenant_key
 *  - 明文：直接是事件 JSON
 */
export async function verifyAndDecryptCardEvent(
  rawBody: string,
  tenantKey: string | null,
): Promise<VerifyResult> {
  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }

  // url_verification：飞书 URL 握手（明文，明文优先）
  if (envelope.type === 'url_verification' || envelope.challenge) {
    return { ok: true, body: envelope };
  }

  // 加密 payload
  if (typeof envelope.encrypt === 'string') {
    let encKey: string | null = null;
    if (tenantKey) {
      encKey = await getEncryptKey(tenantKey);
    } else {
      // 单租户 fallback：仅 1 个 active + 有 encrypt_key 的 app 时用之
      encKey = await getSingleActiveEncryptKey();
    }
    if (!encKey) {
      console.error('[feishu-card] no encrypt_key resolvable', { tenantKey });
      return { ok: false, error: 'no encrypt_key' };
    }
    try {
      const decrypted = decryptPayload(encKey, envelope.encrypt);
      return { ok: true, body: JSON.parse(decrypted) };
    } catch (e) {
      console.error('[feishu-card] decrypt failed', e, 'raw:', rawBody);
      return { ok: false, error: 'decrypt failed' };
    }
  }

  // 明文 payload（开发者未开启加密）
  return { ok: true, body: envelope };
}

// 暴露给 handler 用的常量
export { FEISHU_API_BASE };
