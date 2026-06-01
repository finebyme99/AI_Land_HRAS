import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendMagicLink } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 生成随机 token
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // 存储 token hash（15 分钟过期）
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await getSupabaseAdmin()
      .from('login_tokens')
      .insert({ email: normalizedEmail, token_hash: tokenHash, expires_at: expiresAt });

    if (error) {
      console.error('存储登录 token 失败:', error);
      return NextResponse.json({ error: '发送失败，请稍后重试' }, { status: 500 });
    }

    // 发送邮件
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hras-ai-land.vercel.app';
    const link = `${appUrl}/api/auth/email/verify?token=${token}`;
    await sendMagicLink(normalizedEmail, link);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('发送登录邮件失败:', err);
    return NextResponse.json({ error: '发送失败，请稍后重试' }, { status: 500 });
  }
}
