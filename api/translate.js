import { handleTranslateCategory } from '../lib/translate/category.js';
import { handleTranslateDish } from '../lib/translate/dish.js';
import { handleTranslateRecommendation } from '../lib/translate/recommendation.js';
import { handleTranslateServiceNote } from '../lib/translate/serviceNote.js';

const VALID_TARGETS = new Set(['dish', 'category', 'recommendation', 'service_note']);

/**
 * Unified translation API — routes by `body.target`:
 * - dish: requires JWT + dishId
 * - category: public, requires text
 * - recommendation: public, requires type + items/customHeaderText
 * - service_note: public, requires text (Hotel Hub — PL -> EN)
 */
export async function handleTranslate({ req, authorization, body = {} }) {
  const target = typeof body?.target === 'string' ? body.target.trim() : '';
  if (!VALID_TARGETS.has(target)) {
    return {
      status: 400,
      body: { error: 'Wymagane pole target: dish | category | recommendation | service_note.' },
    };
  }

  if (target === 'dish') {
    return handleTranslateDish({ authorization, body });
  }
  if (target === 'category') {
    return handleTranslateCategory({ req, body });
  }
  if (target === 'service_note') {
    return handleTranslateServiceNote({ req, body });
  }
  return handleTranslateRecommendation({ req, body });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleTranslate({
    req,
    authorization: req.headers.authorization,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}
