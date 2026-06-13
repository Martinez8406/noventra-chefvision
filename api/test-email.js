import { sendResendEmail } from './feedbackUtils.js';

const TEST_RECIPIENT = 'martinteam400@gmail.com';

/**
 * Tymczasowy endpoint testowy — usuń przed produkcją.
 * POST /api/test-email
 */
export async function handleTestEmail() {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return {
        status: 503,
        body: { ok: false, error: 'Brak RESEND_API_KEY w zmiennych środowiskowych.' },
      };
    }

    const from = process.env.RESEND_FROM_EMAIL?.trim();
    if (!from) {
      return {
        status: 503,
        body: { ok: false, error: 'Brak RESEND_FROM_EMAIL w zmiennych środowiskowych.' },
      };
    }

    const result = await sendResendEmail({
      to: TEST_RECIPIENT,
      subject: 'ChefVision Email Test',
      text: 'Resend integration is working correctly.',
    });

    return {
      status: 200,
      body: {
        ok: true,
        message: 'Test email sent successfully.',
        to: TEST_RECIPIENT,
        from,
        resendId: result?.id ?? null,
      },
    };
  } catch (err) {
    console.error('[test-email]', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      status: 502,
      body: { ok: false, error: message },
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const result = await handleTestEmail();
  return res.status(result.status).json(result.body);
}
