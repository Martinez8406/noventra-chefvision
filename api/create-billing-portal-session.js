import { createBillingPortalSession } from './stripe/createBillingPortalSession.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'http://localhost:3000';

  const { userId, returnUrl } = req.body || {};
  const result = await createBillingPortalSession({
    userId,
    returnUrl: returnUrl || baseUrl,
  });

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.status(200).json({ url: result.url });
}
