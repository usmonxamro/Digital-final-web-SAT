/**
 * Sends e-mail through Resend (https://resend.com — free tier, HTTPS API, no SMTP needed).
 * Env: RESEND_API_KEY, MAIL_FROM (e.g. "SAT Akademiyasi <noreply@satbyusmon.com>" after the
 * domain is verified in Resend; for a quick test use "onboarding@resend.dev").
 */
export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'SAT Akademiyasi <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        text,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
