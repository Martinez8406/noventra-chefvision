import '../lib/loadEnv.js';
import { handleCreateClientAccount } from '../lib/createClientAccount.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await handleCreateClientAccount({
      authorization: req.headers.authorization || req.headers.Authorization,
      body: req.body || {},
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('[create-client-account] unhandled', err);
    return res.status(500).json({ error: err?.message || 'Błąd serwera.' });
  }
}
