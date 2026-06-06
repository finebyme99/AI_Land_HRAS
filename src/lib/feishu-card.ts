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
  // 飞书在密文后追加 16 字节的随机串 + 明文，需裁掉尾部非 JSON 内容
  const text = dec.toString('utf8').replace(/[ -]+$/, '');
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
    if (!tenantKey) return { ok: false, error: 'missing tenant_key' };
    const encKey = await getEncryptKey(tenantKey);
    if (!encKey) {
      console.error('[feishu-card] no encrypt_key for tenant', tenantKey);
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
