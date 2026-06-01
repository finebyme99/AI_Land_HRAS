import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMagicLink(email: string, link: string) {
  await resend.emails.send({
    from: 'HRAS AI岛 <onboarding@resend.dev>',
    to: email,
    subject: '登录 HRAS AI岛',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <span style="font-size: 24px; font-weight: 700; color: #1a3a8a;">HRAS</span>
          <span style="font-size: 24px; font-weight: 700; color: #333;">AI岛</span>
        </div>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; text-align: center;">
          <p style="font-size: 15px; color: #333; margin-bottom: 20px;">点击下方按钮登录 HRAS AI岛</p>
          <a href="${link}" style="display: inline-block; background: #1a3a8a; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
            登录 AI岛
          </a>
          <p style="font-size: 12px; color: #999; margin-top: 20px;">链接 15 分钟内有效，仅可使用一次</p>
        </div>
      </div>
    `,
  });
}
