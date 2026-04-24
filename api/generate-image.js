import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerCredentials } from './supabaseServerEnv.js';

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
  'Bistro Lifestyle':
    'classic cafe setting, white tablecloth or bright wood, daylight, silverware, casual but clean look',
};

const BISTRO_BACKGROUNDS = [
  'white Carrara marble slab with subtle grey veining and perfectly smooth, polished surface',
  'warm sandy beige stone tiles with a slightly rough, natural texture and thin grout lines',
  'terrazzo surface – light grey or off-white base densely scattered with colorful mineral flecks in coral, sage green, mustard yellow and dusty violet',
  'soft dusty rose or blush pink ribbed/fluted ceramic surface with clear parallel vertical ridges casting fine shadows',
  'pale lavender or cool lilac smooth marble with faint warm peach veining',
  'classic white square ceramic tiles with clean visible grout lines forming a regular grid',
  'light warm grey brushed concrete with a matte, fine-grained texture',
];

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

// ─── Enhance flow (Studio zdjęć + Motywy sezonowe) ────────────────────────────

const STYLE_CONFIGS = {
  street_food: {
    prompt: `
Transform this food image into a high-quality street food style presentation.

Style characteristics:
- authentic street food aesthetic, not luxury or fine dining
- casual, urban, vibrant atmosphere
- natural imperfections allowed (slightly messy, realistic textures)

Lighting:
- natural or slightly harsh directional light
- stronger highlights and shadows for depth
- avoid soft studio lighting

Background:
- enhance or replace the background with a street food environment (wood, metal, street surface)
- slightly textured and realistic
- subtle depth of field allowed

Color & mood:
- warm, rich colors (reds, yellows, browns)
- slightly increased contrast and saturation
- bold and appetizing look

Details:
- preserve realistic textures (crispy, juicy, melted elements)

Quality:
- ultra realistic, high detail
- no artificial or plastic look

STRICT RULES:
- DO NOT change the plate, bowl, packaging, or serving dish
- DO NOT change camera angle or composition
- DO NOT reposition the food
- preserve original structure and proportions

IMPORTANT:
- keep the original dish recognizable
- prioritize realism over perfection
`,
    strength: 0.65,
  },
  rustic: {
    prompt: `
Transform this food image into a high-quality rustic food photography style.

Style characteristics:
- warm, natural, homely atmosphere
- rustic kitchen or countryside aesthetic
- authentic, slightly imperfect presentation
- no luxury or fine dining feel

Lighting:
- soft natural light (like window light)
- warm tones
- gentle shadows, not dramatic

Background:
- natural materials (wooden table, linen cloth, stone surface)
- slightly textured and organic
- cozy and real, not clean studio
- subtle depth of field allowed

Color & mood:
- warm, earthy tones (browns, beiges, soft greens)
- slightly muted colors (not oversaturated)
- cozy and inviting mood

Details:
- preserve natural food textures
- allow small imperfections (crumbs, uneven edges)
- emphasize homemade feeling

Quality:
- ultra realistic, high detail
- soft but sharp focus on food
- no artificial or plastic look

STRICT RULES:
- DO NOT change the plate, bowl, or serving dish
- DO NOT change camera angle or composition
- DO NOT reposition the food
- preserve original structure and proportions

IMPORTANT:
- keep the dish fully recognizable
- prioritize authenticity over perfection
- avoid modern or minimalistic styling
`,
    strength: 0.56,
  },
  fine_dining: {
    prompt: `
Transform this food image into a high-end fine dining presentation.

Style characteristics:
- elegant, refined, Michelin-level aesthetic
- minimalistic and luxurious presentation
- clean composition with strong attention to detail

Lighting:
- soft, diffused lighting
- subtle highlights, no harsh shadows
- controlled reflections for a premium look

Background:
- refined, minimal, and elegant environment
- dark, neutral, or softly blurred upscale restaurant background
- no clutter, no textures that distract from the dish

Color & mood:
- slightly desaturated tones
- balanced contrast
- clean, calm, premium color grading

Details:
- emphasize precision and cleanliness
- smooth textures, refined surfaces
- no mess, no spills, no crumbs unless extremely subtle

Focus:
- sharp focus on the main subject
- gentle depth of field for background separation

Quality:
- ultra realistic, high-end food photography
- polished but still natural (not artificial or plastic)
- magazine-quality result

STRICT RULES:
- DO NOT change the plate, bowl, or serving dish
- DO NOT change camera angle or composition
- DO NOT reposition the food
- preserve original structure and proportions

IMPORTANT:
- maintain full recognizability of the original dish
- elevate the presentation without altering its identity
- the result should feel expensive, clean, and professionally styled
`,
    strength: 0.58,
  },
  lifestyle: {
    prompt: `
Create a high-end lifestyle food photography image while STRICTLY preserving the original dish structure.

INPUT IMAGE RULE:
The dish composition, ingredients placement, proportions, shapes, and arrangement MUST remain unchanged.
Do NOT add, remove, or rearrange any food elements.
Do NOT modify portion sizes or plating structure.
Only enhance styling, lighting, colors, and environment.

Scene:
Place the dish on a textured pastel surface (light pink, beige, warm stone). Background should be minimal, tactile, slightly imperfect (subtle grain, soft texture).

Composition:

Dish remains the central focus, unchanged.
Add negative space around the plate.

Lighting:
Soft natural light, directional (left or right), gentle shadows, bright and airy look.

Props (around the dish ONLY — never touching or modifying it):
- Colored glass (orange, purple, amber)
- Small fork or spoon placed casually
- Linen napkin (natural folds)
- Raw ingredients matching the dish (placed loosely nearby, not on plate)
- Optional bold accent object (e.g. colorful teapot)

Styling:
Modern lifestyle aesthetic, slightly playful but controlled.
Allow minimal natural imperfections outside the plate (crumbs, herbs).

Colors:
Pastel base + strong accent colors (blue cutlery, pink objects, purple glass, orange drink).

Food styling:
DO NOT restyle the food itself.
No fine dining reconstruction.
No ingredient swaps.
No garnishing changes.

Camera:
High resolution, sharp focus on dish, subtle depth of field.

Mood:
Warm, inviting, modern, premium lifestyle, brand-consistent.

STRICT NEGATIVE RULES:
- No changes to dish structure
- No added sauces, garnishes, or decorations on food
- No removal of existing elements
- No reshaping or repositioning of ingredients
- No fake enhancements that alter realism
- No dark or moody scenes
- No clutter

Goal:
Make the SAME dish look like a premium lifestyle photoshoot without changing what is on the plate.
`,
    strength: 0.55,
  },
};

function normalizeEnhanceStyle(style) {
  if (!style || typeof style !== 'string') return null;
  const normalized = style.trim().toLowerCase();
  const aliases = {
    'fine-dining': 'fine_dining',
    'street-food': 'street_food',
  };
  return aliases[normalized] || normalized;
}

function buildEnhancePrompt(settings) {
  const s = settings || {};
  const styleKey = normalizeEnhanceStyle(s.style);
  const styleConfig = styleKey ? STYLE_CONFIGS[styleKey] : null;
  const blocks = [];

  if (!styleConfig) {
    throw { status: 400, message: 'Wybierz styl zdjecia przed generowaniem.' };
  }

  blocks.push(
    'ENHANCE TASK: The reference image shows a real dish photograph. Keep the same dish and improve it into a premium restaurant editorial photo.'
  );
  blocks.push(styleConfig.prompt.trim());

  blocks.push(
    'QUALITY: hyper-realistic textures, restaurant-menu editorial quality, balanced natural colors, razor-sharp focus on the food, shallow depth of field.'
  );
  blocks.push(`STYLE STRENGTH: ${styleConfig.strength}.`);

  const styleNegative =
    styleKey === 'street_food'
      ? ' Strictly exclude from the final image: kraft paper, parchment paper, wax paper, paper liners or sheets under or around the dish, disposable paper tray liners, newspaper, paper napkins used as a surface under the food, brown paper bag texture as the tabletop, any obvious paper substrate under the plate or bowl — use only solid wood, metal, concrete or similar non-paper street surfaces.'
      : '';

  blocks.push(`${NEGATIVE_PROMPT}${styleNegative}`);
  blocks.push('OUTPUT: a single photorealistic culinary image, 4:3 aspect ratio.');

  return blocks.join('\n\n');
}

function buildEnhanceFollowUp() {
  return 'FINAL REMINDER: Keep the exact same dish and only improve style, atmosphere, background and camera framing.';
}

function buildCustomThemePrompt() {
  return [
    'Transform the provided dish photo using the SECOND reference image as the scene/theme direction.',
    'Use the second image for atmosphere, props, colors, background texture and lighting mood.',
    'CRITICAL: Do NOT modify the dish itself. Keep exactly the same ingredients, plating, proportions and camera composition from the dish reference.',
    'Only change the surrounding scene to match the custom theme reference.',
    'Hyper-realistic textures, shallow depth of field, editorial food-magazine quality.',
    NEGATIVE_PROMPT,
    'Output: a single photorealistic culinary image, 4:3 aspect ratio.',
  ].join('\n');
}

const SEASONAL_THEME_MAP = {
  christmas: [
    'Transform the provided dish photo into a festive CHRISTMAS editorial food photograph.',
    'Atmosphere: warm candle-lit glow, cozy winter evening, rich reds and deep forest greens with touches of gold.',
    'Props around the dish: pine branches with tiny cones, small red berries, cinnamon sticks, a couple of gold baubles, a velvet Christmas ribbon, a light dusting of powdered sugar, blurred string-light bokeh in the background.',
    'Background: dark wooden table with a linen napkin in burgundy or forest green; warm Christmas lights softly blurred behind.',
  ],
  easter: [
    'Transform the provided dish photo into a bright EASTER editorial food photograph.',
    'Atmosphere: fresh spring morning, airy and pastel, warm diffused daylight.',
    'Props around the dish: pastel Easter eggs, small tulips or daffodils, sprigs of fresh green herbs, a linen napkin in pastel pink / mint / yellow, a small woven basket with eggs.',
    'Background: light wood or pale stone surface, soft window light coming from the side.',
  ],
  halloween: [
    'Transform the provided dish photo into a moody HALLOWEEN editorial food photograph.',
    'Atmosphere: dark and mysterious, warm orange candlelight glow, gentle smoke/mist haze.',
    'Props around the dish: small pumpkins and tiny gourds, dried autumn leaves, black candles with a soft flame, dark berries, a rustic dark cloth, twisted twigs subtly in the background.',
    'Background: dark weathered wood or black stone surface, low-key dramatic lighting with warm orange accents.',
  ],
  summer: [
    'Transform the provided dish photo into a vibrant SUMMER editorial food photograph.',
    'Atmosphere: bright sunny afternoon, high-key lighting, fresh and energetic.',
    'Props around the dish: fresh citrus slices, fresh herbs (mint, basil), tiny wildflowers, a cold drink glass with ice and condensation, a light blue / white striped linen napkin.',
    'Background: sun-bleached wood or a sun-lit terrace table, natural sunlight with crisp shadows.',
  ],
  valentine: [
    'Transform the provided dish photo into a romantic VALENTINE editorial food photograph.',
    'Atmosphere: intimate dinner for two, warm candlelight, soft romantic glow.',
    'Props around the dish: fresh red and pink rose petals scattered nearby, a couple of small red roses, a lit candle with a soft bokeh flame, a glass of red wine partially visible, a soft velvet ribbon, tiny heart-shaped chocolates.',
    'Background: elegant dark wooden or marble surface, deep reds and pinks with golden warm accents, shallow depth of field with bokeh.',
  ],
};

function buildThemePrompt(theme) {
  const themeLines = SEASONAL_THEME_MAP[theme];
  if (!themeLines) return buildEnhancePrompt({});
  const lines = [
    ...themeLines,
    'CRITICAL: Do NOT modify the dish itself. Keep the exact same ingredients, plating and composition as in the reference photo. Only change the surrounding scene, props, colors and lighting to match the theme.',
    'Hyper-realistic textures, shallow depth of field, editorial food-magazine quality.',
    NEGATIVE_PROMPT,
    'Output: a single photorealistic culinary image, 4:3 aspect ratio.',
  ];
  return lines.join('\n');
}

function buildDishPrompt(settings, ingredientsHint) {
  const { dishName, styleLabel, lightingLabel, plateLabel, angleLabel, hasCustomBackdrop, hasCustomTableware } =
    settings;

  if (styleLabel === 'Bistro Lifestyle') {
    const bistroNegativePrompt =
      `${NEGATIVE_PROMPT} Strictly exclude: black stone, dark slate, dark or moody backgrounds, low-key lighting, fine-dining minimalist plating, plain white studio backdrop, dark ceramics, any dark or black surface.`;

    const parts = [
      `Professional food editorial photograph of "${dishName}" in Bistro Lifestyle style.`,
      'Tableware: rustic handmade ceramic plate or bowl with warm cream or ivory body and a clearly visible natural brown or earth-toned rim. Artisanal, slightly imperfect glaze – NOT smooth fine-dining white porcelain.',
      `Background surface: use EXACTLY THIS specific surface for this image – ${BISTRO_BACKGROUNDS[Math.floor(Math.random() * BISTRO_BACKGROUNDS.length)]}. This surface fills most of the background and is clearly visible around the plate.`,
      'Lighting: bright natural side-sunlight from one direction creating crisp hard-edged cast shadows on the surface. High-key and airy. No studio softboxes, no diffused fill light.',
      'Mandatory lifestyle props (all must be present): (1) one or two ribbed colored drinking glasses – amber/orange OR purple/violet – placed upright in the background; (2) colorful matte cutlery – gold/brass OR matte purple – lying naturally beside the plate; (3) a loosely draped colored linen napkin – mustard yellow, lavender, or sage green. Optional extras: a small bowl with whole mushrooms, scattered pine nuts or peppercorns, fresh herb sprigs.',
      `Camera angle: ${anglePrompts[angleLabel] ?? '45-50 degree overhead tilt, plate dominant, props arranged casually'}. Keep the composition consistent with Bistro Lifestyle editorial style.`,
      'Color palette: warm, vibrant, high-saturation, sun-drenched. Clean bright whites mixed with saturated color accents from glassware, textiles and cutlery. Energetic food-editorial feel.',
      'Focus: main dish and plate sharply in focus. Background props have slight natural bokeh.',
      `Dish "${dishName}" must be the hero – well-plated, appetizing, with clearly visible textures and ingredients.`,
    ];

    if (ingredientsHint?.trim()) {
      parts.push(
        `IMPORTANT: These ingredients must be clearly visible and appetizing on the plate: ${ingredientsHint.trim()}.`
      );
    }

    if (hasCustomBackdrop) {
      parts.push('A reference backdrop image is provided: respect its composition and perspective, but keep the overall atmosphere bright and light.');
    }

    if (hasCustomTableware) {
      parts.push('A reference tableware image is provided: place the food on exactly this plate or bowl, preserving its shape, color and design.');
    }

    parts.push(
      'Output: a single ultra-photorealistic culinary image, 4:3 aspect ratio, suitable for premium restaurant menu, food magazine editorial, and social media.',
      bistroNegativePrompt
    );

    return parts.join('\n');
  }

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

const GENERATION_RETRY_DELAYS_MS = [1200, 2500];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(err) {
  const status = err?.status ?? err?.error?.code ?? err?.code;
  const message = String(err?.message ?? err?.error?.message ?? '');
  const normalized = message.toLowerCase();

  return (
    status === 503 ||
    status === '503' ||
    normalized.includes('deadline expired') ||
    normalized.includes('service unavailable') ||
    normalized.includes('status":"unavailable"') ||
    normalized.includes("status: 'unavailable'") ||
    normalized.includes('temporarily unavailable')
  );
}

function toUserFacingGenerateError(err) {
  if (isRetryableGeminiError(err)) {
    return {
      status: 503,
      message:
        'Generator AI chwilowo nie odpowiedzial na czas. Sprobuj ponownie za kilka sekund.',
    };
  }

  return {
    status: err?.status || 500,
    message: err?.message || 'Blad generacji AI.',
  };
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
    let detailInstructions = '';
    if (blurLevel === 'NATURAL') {
      blurInstructions = 'Do NOT apply any blur effect. Return the image exactly as provided – sharp, original, no depth-of-field effect whatsoever.';
      detailInstructions = 'Maintain sharp edges of tables, walls, and architectural elements.';
    } else if (blurLevel === 'INSTAGRAM') {
      blurInstructions = 'Apply light blur (Gaussian blur approx. 7%). Effect: subtle subject separation, modern social-media style.';
      detailInstructions = 'Keep main shapes natural and readable, with only gentle background softness.';
    } else if (blurLevel === 'FINE DINING') {
      blurInstructions = 'Apply strong blur (Gaussian blur approx. 35-45%). Create premium, soft bokeh background with clearly visible depth-of-field effect.';
      detailInstructions = 'Background details should be noticeably softened and partially unreadable; keep geometry natural but do not preserve crisp edges.';
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
    3. ${detailInstructions}
    4. Keep lighting natural and consistent with the original image.
    OUTPUT: A single processed image that remains realistic and reusable for multiple food photos.`;

    parts = [imagePart, { text: prompt }];

  } else if (type === 'enhance' || body.enhanceSettings) {
    // Nowy tryb — „Ulepsz zdjęcie” (Studio zdjęć + Motywy sezonowe).
    extraConfig = { imageConfig: { aspectRatio: '4:3' } };

    const dishPart = parseImagePart(images.dishReference);
    if (!dishPart) {
      throw { status: 400, message: 'Brak zdjęcia dania (wymagane w trybie „Ulepsz zdjęcie”).' };
    }
    const customThemePart = parseImagePart(images.customTheme);

    const enhance = body.enhanceSettings || {};
    const normalizedEnhanceStyle = normalizeEnhanceStyle(enhance.style);

    if (!enhance.theme && !normalizedEnhanceStyle && !customThemePart) {
      throw { status: 400, message: 'Wybierz styl zdjecia przed generowaniem.' };
    }
    if (!enhance.theme && normalizedEnhanceStyle && !STYLE_CONFIGS[normalizedEnhanceStyle]) {
      throw { status: 400, message: 'Nieprawidlowy styl zdjecia.' };
    }

    if (normalizedEnhanceStyle) {
      enhance.style = normalizedEnhanceStyle;
    }

    const prompt = customThemePart
      ? buildCustomThemePrompt()
      : enhance.theme
        ? buildThemePrompt(enhance.theme)
        : buildEnhancePrompt(enhance);

    const followUp = customThemePart
      ? 'FINAL REMINDER: Dish stays unchanged. Match only the environment/style from the second reference image.'
      : enhance.theme
        ? 'FINAL REMINDER: Keep the exact same dish and only change the surrounding seasonal scene.'
        : buildEnhanceFollowUp();

    // For image models, leading with the instruction helps reduce anchoring on the
    // original serving plate visible in the first reference image.
    parts = [{ text: prompt }, dishPart];
    if (customThemePart) parts.push(customThemePart);

    parts.push({ text: followUp });

  } else {
    // Dish generation (legacy flow — na wypadek wywołań z innych komponentów).
    extraConfig = { imageConfig: { aspectRatio: '4:3' } };

    if (images.dishReference) {
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

  let response = null;
  let lastError = null;

  for (let attempt = 0; attempt <= GENERATION_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts }],
        config: { ...baseConfig, ...extraConfig },
      });
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      if (!isRetryableGeminiError(err) || attempt === GENERATION_RETRY_DELAYS_MS.length) {
        throw err;
      }

      const delayMs = GENERATION_RETRY_DELAYS_MS[attempt];
      console.warn(
        `[generate-image] Gemini retryable error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${GENERATION_RETRY_DELAYS_MS.length + 1})`,
        err
      );
      await sleep(delayMs);
    }
  }

  if (!response && lastError) throw lastError;

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

async function verifyToken(authHeader) {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    console.warn('[verifyToken] No token in Authorization header. Header value:', authHeader ?? '(missing)');
    return null;
  }

  const { url, key } = getSupabaseServerCredentials();
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
  const isCreditedRequest = requestType === 'dish' || requestType === 'enhance';

  // ─── Credit reservation + generation (dish / enhance) ──────────────────────
  let isPremium      = false;
  let profileCredits = 0;
  let creditReserved = false;
  let userClient     = null;

  if (isCreditedRequest) {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerCredentials();

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

    if (isCreditedRequest) {
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

    const mapped = toUserFacingGenerateError(err);
    console.error('[generate-image]', mapped.message, err);
    return { status: mapped.status, body: { error: mapped.message } };
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
