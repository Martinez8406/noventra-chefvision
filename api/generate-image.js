import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// ─── Prompt constants (mirrors aiService.ts) ──────────────────────────────────

const stylePrompts = {
  'Fine Dining':
    'dark moody background, elegant plating, marble table, soft bokeh, luxury lighting, expensive atmosphere, minimalist garnish, microgreens, precise plating, dark slate or marble, rim light, sophisticated atmosphere',
  'Rustic':
    'wooden table, warm natural sunlight, linen napkins, ceramic plates, herbs scattered around, cozy home-style lighting, handcrafted ceramics, crumbs, natural linen, slightly messy but appetizing, soft window light',
  'Street Food':
    'vibrant colors, neon lights background, paper wrapping, casual setting, urban atmosphere, high contrast, dynamic close-up, flash photography style, greasy textures, paper bags, high energy, saturated colors',
  'Bistro':
    'classic cafe setting, white tablecloth or bright wood, daylight, silverware, casual but clean look',
};

const anglePrompts = {
  'Top-down (Flatlay)':
    "Bird's eye view, camera directly above the plate at a perfect 90 degree angle, lens perfectly parallel to the table, no perspective tilt or distortion, geometric composition, centered dish, all ingredients visible from the top",
  'Eye-level':
    'Camera at table height, looking directly at the side of the food, emphasizes height and layers, shallow depth of field',
  'Makro (Zbliżenie)':
    'Extreme close-up, macro photography, focus on texture and details, glistening sauce, steam, soft bokeh background, very shallow depth of field, intimate view',
};

const NEGATIVE_PROMPT =
  'Avoid: blurry image, low resolution, distorted hands or cutlery, unnatural proportions, cartoon or illustration style, over-saturated colors, text or logos on the image, extra objects that distract from the dish.';

function buildHybridPrompt(ingredientsHint) {
  const lines = [
    'Use the provided dish photo as reference.',
    'Keep the same dish structure and composition.',
  ];
  if (ingredientsHint?.trim()) {
    lines.push('');
    lines.push(
      `IMPORTANT: The dish must clearly show these ingredients on the plate, visible and appetizing: ${ingredientsHint.trim()}.`
    );
  }
  lines.push('');
  lines.push('Improve lighting and composition to make it look like a professional restaurant menu photo.');
  lines.push('Clean restaurant background, balanced lighting, shallow depth of field, food photography style.');
  return lines.join('\n');
}

function buildDishPrompt(settings, ingredientsHint) {
  const { dishName, styleLabel, lightingLabel, plateLabel, angleLabel, hasCustomBackdrop, hasCustomTableware } =
    settings;

  const stylePhrase   = styleLabel.toLowerCase();
  const lightingPhrase = lightingLabel.toLowerCase();
  const angleDetails  = anglePrompts[angleLabel];
  const styleDetails  = stylePrompts[styleLabel] ?? '';

  const backdropInstruction = hasCustomBackdrop
    ? 'First reference image (if provided): the restaurant background – use it as the real environment. Keep perspective, colors and atmosphere; place the dish naturally in this scene.'
    : `Background: styled to match a high-end restaurant setting that fits the selected plate type (${plateLabel}).`;

  const tablewareInstruction = hasCustomTableware
    ? 'Second reference image (if provided): the plate or tableware – place the generated dish EXACTLY on this plate/setting. Preserve the shape, color and style of the plate; only add the food on top.'
    : '';

  const parts = [`Professional food photography of ${dishName}, ${stylePhrase} style.`];

  if (ingredientsHint?.trim()) {
    parts.push(
      `The dish must include and clearly show these ingredients on the plate, each visible and appetizing: ${ingredientsHint.trim()}.`
    );
  }

  parts.push(
    styleDetails
      ? `Visual style details: ${styleDetails}.`
      : `Style: ${stylePhrase} restaurant presentation, chef-level plating, sophisticated composition.`,
    `Lighting: ${lightingPhrase} lighting for food – warm, appetizing highlights, soft shadows, no harsh contrast.`,
    angleDetails
      ? `Camera angle and composition: ${angleDetails}.`
      : `Camera angle: ${angleLabel.toLowerCase()} – composed like a cinematic hero shot for restaurant menu.`,
    backdropInstruction,
    tablewareInstruction,
    'Goals: hyper-realistic textures, perfect focus on the dish, shallow depth of field, bokeh in the background, ultra-detailed ingredients, vibrant yet natural colors.',
    NEGATIVE_PROMPT,
    'Output: a single photorealistic culinary image, 4:3 aspect ratio, suitable for premium restaurant menu and marketing.'
  );

  return parts.join('\n');
}

function parseImagePart(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  try {
    const base64Idx = dataUrl.indexOf(',');
    const header    = dataUrl.slice(0, base64Idx);
    const mimeMatch = header.match(/^data:([^;]+)/);
    const mimeType  = (mimeMatch && mimeMatch[1]) || 'image/jpeg';
    const base64Data = base64Idx >= 0 ? dataUrl.slice(base64Idx + 1).trim() : '';
    if (!mimeType || !base64Data) return null;
    return { inlineData: { mimeType, data: base64Data } };
  } catch {
    return null;
  }
}

// ─── Shared generation logic (used by both Vercel handler and Express route) ──

export async function runGeneration(body) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw { status: 503, message: 'Gemini API key not configured on server.' };

  const ai = new GoogleGenAI({ apiKey });

  const { type = 'dish', aiSettings, images = {}, ingredientsHint, blurLevel } = body;

  let parts;
  let extraConfig = {};

  // responseModalities tells Gemini to return an image (not just text)
  const baseConfig = { responseModalities: ['IMAGE', 'TEXT'] };

  if (type === 'backdrop') {
    const imagePart = parseImagePart(images.source);
    if (!imagePart) throw { status: 400, message: 'Brak obrazu tła.' };

    let blurInstructions = '';
    if (blurLevel === 'NATURAL') {
      blurInstructions = 'Do NOT apply any blur effect. Return the image exactly as provided – sharp, original, no depth-of-field effect whatsoever.';
    } else if (blurLevel === 'INSTAGRAM') {
      blurInstructions = 'Apply light blur (Gaussian blur approx. 7%). Effect: subtle subject separation, modern social-media style.';
    } else if (blurLevel === 'FINE DINING') {
      blurInstructions = 'Apply medium-strong blur (Gaussian blur approx. 15%). Effect: elegant, premium look with noticeable background softness.';
    }

    const prompt = `You are an image processing assistant for a restaurant photography app.
    GOAL: Prepare a realistic restaurant background image.
    IMAGE CONTENT: A photo of a restaurant interior (table, wall, terrace, or garden) with NO food and NO people.
    STRICT RULES:
    - Do NOT generate new objects.
    - Do NOT change the composition or perspective.
    - Do NOT stylize the image.
    - Do NOT add decorations, props, or lighting effects.
    - Preserve the original colors and geometry.
    - The result must look like a real photo taken with a professional camera.
    PROCESSING STEPS:
    1. ${blurInstructions}
    2. Slightly smooth visual noise and imperfections.
    3. Maintain sharp edges of tables, walls, and architectural elements.
    4. Keep lighting natural and consistent with the original image.
    OUTPUT: A single processed image that remains realistic and reusable for multiple food photos.`;

    parts = [imagePart, { text: prompt }];

  } else {
    // Dish generation (full ChefsStudio or legacy DishGenerator)
    extraConfig = { imageConfig: { aspectRatio: '4:3' } };

    if (images.dishReference) {
      // Hybrid mode
      const dishPart = parseImagePart(images.dishReference);
      if (!dishPart) throw { status: 400, message: 'Nieprawidłowe zdjęcie referencyjne dania.' };
      const hybridPrompt =
        buildHybridPrompt(ingredientsHint) + '\n\nOutput: a single photorealistic image, 4:3 aspect ratio.';
      parts = [dishPart, { text: hybridPrompt }];
      const bp = parseImagePart(images.backdrop);   if (bp) parts.push(bp);
      const tp = parseImagePart(images.tableware);  if (tp) parts.push(tp);
    } else {
      if (!aiSettings) throw { status: 400, message: 'Brak parametrów generacji (aiSettings).' };
      const prompt = buildDishPrompt(aiSettings, ingredientsHint);
      parts = [{ text: prompt }];
      const bp = parseImagePart(images.backdrop);   if (bp) parts.push(bp);
      const tp = parseImagePart(images.tableware);  if (tp) parts.push(tp);
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ parts }],
    config: { ...baseConfig, ...extraConfig },
  });

  if (!response.candidates || response.candidates.length === 0) {
    throw { status: 500, message: 'Model nie zwrócił żadnych propozycji.' };
  }

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw { status: 500, message: 'Brak danych obrazu w odpowiedzi modelu.' };
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

function getSupabaseCredentials() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return { url, key };
}

async function verifyToken(authHeader) {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    console.warn('[verifyToken] No token in Authorization header. Header value:', authHeader ?? '(missing)');
    return null;
  }

  const { url, key } = getSupabaseCredentials();
  if (!url || !key) {
    console.error('[verifyToken] Missing Supabase credentials on server. url:', !!url, 'key:', !!key);
    return null;
  }

  console.log('[verifyToken] Verifying token against:', url);
  const client = createClient(url, key);
  const { data: { user }, error } = await client.auth.getUser(token);

  if (error) {
    console.warn('[verifyToken] Supabase getUser() error:', error.message);
    return null;
  }

  console.log('[verifyToken] Token valid – user:', user?.id);
  return user;
}

// ─── Shared handler logic (used by Vercel + Express) ─────────────────────────
//     Returns { status: number, body: object }

export async function handleGenerateImage({ authorization, body = {} }) {
  // 1 — Verify JWT
  const user = await verifyToken(authorization);
  if (!user) {
    return { status: 401, body: { error: 'Brak autoryzacji. Zaloguj się, aby używać generatora.' } };
  }

  const requestType = body.type ?? 'dish';

  // ─── Credit reservation + generation (dish only) ───────────────────────────
  let isPremium      = false;
  let profileCredits = 0;
  let creditReserved = false;
  let userClient     = null;

  if (requestType === 'dish') {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseCredentials();

    if (supabaseUrl && supabaseKey) {
      userClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authorization } },
      });

      // 1 — Read current profile
      const { data: profile, error: profileError } = await userClient
        .from('profiles')
        .select('ai_credits, subscription_status')
        .eq('id', user.id)
        .single();

      console.log('[generate-image] profile query result:', JSON.stringify(profile), 'error:', profileError?.message);

      isPremium      = profile?.subscription_status === 'premium';
      profileCredits = profile?.ai_credits ?? 0;

      console.log('[generate-image] isPremium:', isPremium, 'ai_credits:', profileCredits);

      if (!isPremium && profileCredits <= 0) {
        return { status: 402, body: { error: 'Brak kredytów. Przejdź na plan Premium, aby kontynuować.' } };
      }

      // 2 — RESERVE credit (pre-decrement with optimistic lock)
      if (!isPremium) {
        const { count } = await userClient
          .from('profiles')
          .update({ ai_credits: profileCredits - 1 })
          .eq('id', user.id)
          .eq('ai_credits', profileCredits)
          .select('id', { count: 'exact', head: true });

        if (count === 0) {
          return { status: 402, body: { error: 'Brak kredytów. Przejdź na plan Premium, aby kontynuować.' } };
        }

        creditReserved = true;
      }
    }
  }

  // 3 — Generate AI
  try {
    const image = await runGeneration(body);

    // 4 — SUCCESS: credit already decremented (reservation confirmed)
    const creditsRemaining = isPremium ? 999999 : Math.max(0, profileCredits - 1);

    if (requestType === 'dish') {
      return { status: 200, body: { image, creditsRemaining } };
    }

    return { status: 200, body: { image } };

  } catch (err) {

    // 5 — FAILURE: restore reserved credit
    if (creditReserved && userClient) {
      await userClient
        .from('profiles')
        .update({ ai_credits: profileCredits })
        .eq('id', user.id);
    }

    const status  = err?.status  || 500;
    const message = err?.message || 'Błąd generacji AI.';
    console.error('[generate-image]', message, err);
    return { status, body: { error: message } };
  }
}

// ─── Vercel serverless handler ────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const result = await handleGenerateImage({
    authorization: req.headers.authorization,
    body: req.body || {},
  });
  return res.status(result.status).json(result.body);
}
