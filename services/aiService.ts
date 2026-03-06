import { GoogleGenAI } from '@google/genai';
import { GeneratorParams } from '../types';

export interface AiDishSettings {
  dishName: string;
  styleLabel: string;
  lightingLabel: string;
  plateLabel: string;
  angleLabel: string;
  hasCustomBackdrop: boolean;
  hasCustomTableware: boolean;
}

// Dodatkowe opisy stylów – dokładne, wizualne słowa kluczowe
const stylePrompts: Record<string, string> = {
  'Fine Dining':
    'dark moody background, elegant plating, marble table, soft bokeh, luxury lighting, expensive atmosphere, minimalist garnish, microgreens, precise plating, dark slate or marble, rim light, sophisticated atmosphere',
  'Rustic':
    'wooden table, warm natural sunlight, linen napkins, ceramic plates, herbs scattered around, cozy home-style lighting, handcrafted ceramics, crumbs, natural linen, slightly messy but appetizing, soft window light',
  'Street Food':
    'vibrant colors, neon lights background, paper wrapping, casual setting, urban atmosphere, high contrast, dynamic close-up, flash photography style, greasy textures, paper bags, high energy, saturated colors',
  'Bistro':
    'classic cafe setting, white tablecloth or bright wood, daylight, silverware, casual but clean look',
};

// Opisy perspektyw kamery
const anglePrompts: Record<string, string> = {
  'Top-down (Flatlay)':
    "Bird's eye view, camera directly above the plate at a perfect 90 degree angle, lens perfectly parallel to the table, no perspective tilt or distortion, geometric composition, centered dish, all ingredients visible from the top",
  'Eye-level':
    'Camera at table height, looking directly at the side of the food, emphasizes height and layers, shallow depth of field',
  'Makro (Zbliżenie)':
    'Extreme close-up, macro photography, focus on texture and details, glistening sauce, steam, soft bokeh background, very shallow depth of field, intimate view',
};

const NEGATIVE_PROMPT =
  'Avoid: blurry image, low resolution, distorted hands or cutlery, unnatural proportions, cartoon or illustration style, over-saturated colors, text or logos on the image, extra objects that distract from the dish.';

/** Prompt dla trybu Hybrid (ulepszenie wgranego zdjęcia dania). */
export function buildHybridPrompt(ingredientsHint?: string): string {
  const lines = [
    'Use the provided dish photo as reference.',
    'Keep the same dish structure and composition.',
  ];
  if (ingredientsHint?.trim()) {
    lines.push('');
    lines.push(`IMPORTANT: The dish must clearly show these ingredients on the plate, visible and appetizing: ${ingredientsHint.trim()}.`);
  }
  lines.push('');
  lines.push('Improve lighting and composition to make it look like a professional restaurant menu photo.');
  lines.push('Clean restaurant background, balanced lighting, shallow depth of field, food photography style.');
  return lines.join('\n');
}

/** Buduje bogaty prompt dla Geminiego na podstawie aktualnych ustawień studia. */
export function buildDishPrompt(settings: AiDishSettings, ingredientsHint?: string): string {
  const {
    dishName,
    styleLabel,
    lightingLabel,
    plateLabel,
    angleLabel,
    hasCustomBackdrop,
    hasCustomTableware,
  } = settings;

  const stylePhrase = styleLabel.toLowerCase();
  const lightingPhrase = lightingLabel.toLowerCase();
  const angleDetails = anglePrompts[angleLabel];
  const styleDetails = stylePrompts[styleLabel] ?? '';

  const backdropInstruction = hasCustomBackdrop
    ? 'First reference image (if provided): the restaurant background – use it as the real environment. Keep perspective, colors and atmosphere; place the dish naturally in this scene.'
    : `Background: styled to match a high-end restaurant setting that fits the selected plate type (${plateLabel}).`;

  const tablewareInstruction = hasCustomTableware
    ? 'Second reference image (if provided): the plate or tableware – place the generated dish EXACTLY on this plate/setting. Preserve the shape, color and style of the plate; only add the food on top.'
    : '';

  const parts: string[] = [
    `Professional food photography of ${dishName}, ${stylePhrase} style.`,
  ];

  if (ingredientsHint?.trim()) {
    parts.push(`The dish must include and clearly show these ingredients on the plate, each visible and appetizing: ${ingredientsHint.trim()}.`);
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
    'Output: a single photorealistic culinary image, 4:3 aspect ratio, suitable for premium restaurant menu and marketing.',
  );

  return parts.join('\n');
}

/** Pełna generacja obrazu dania z użyciem Gemini 2.x Flash (image model). */
export async function generateDishImageWithAI(
  params: GeneratorParams,
  settings: AiDishSettings,
  options?: { backdropImage?: string; tablewareImage?: string; dishReferenceImage?: string; ingredientsHint?: string }
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const addImagePart = (dataUrl: string, targetParts: any[]): boolean => {
    try {
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return false;
      const base64Idx = dataUrl.indexOf(',');
      const header = dataUrl.slice(0, base64Idx);
      const mimeMatch = header.match(/^data:([^;]+)/);
      const mimeType = (mimeMatch && mimeMatch[1]) || 'image/jpeg';
      const base64Data = base64Idx >= 0 ? dataUrl.slice(base64Idx + 1).trim() : '';
      if (!mimeType || !base64Data) return false;
      targetParts.push({ inlineData: { mimeType, data: base64Data } });
      return true;
    } catch (e) {
      console.error('Error parsing image for AI:', e);
      return false;
    }
  };

  let parts: any[];

  if (options?.dishReferenceImage) {
    // Hybrid mode: dish photo first, then enhance prompt; model must return one image
    parts = [];
    const dishAdded = addImagePart(options.dishReferenceImage, parts);
    if (!dishAdded) {
      throw new Error('Nie udało się załadować zdjęcia dania. Spróbuj innego pliku (JPEG/PNG).');
    }
    const hybridPrompt = buildHybridPrompt(options.ingredientsHint) + '\n\nOutput: a single photorealistic image, 4:3 aspect ratio.';
    parts.push({ text: hybridPrompt });
    if (options?.backdropImage) addImagePart(options.backdropImage, parts);
    if (options?.tablewareImage) addImagePart(options.tablewareImage, parts);
  } else {
    const prompt = buildDishPrompt(settings, options?.ingredientsHint);
    parts = [{ text: prompt }];
    if (options?.backdropImage) addImagePart(options.backdropImage, parts);
    if (options?.tablewareImage) addImagePart(options.tablewareImage, parts);
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: '4:3',
        },
      },
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('Model nie zwrócił żadnych propozycji.');
    }

    const candidate = response.candidates[0];
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error('Brak danych obrazu w odpowiedzi modelu.');
  } catch (error: any) {
    console.error('Gemini AI Dish Generator Error:', error);

    if (
      error.message?.includes('Requested entity was not found') ||
      error.message?.includes('API_KEY') ||
      error.message?.includes('403') ||
      error.message?.includes('404')
    ) {
      throw new Error('API_KEY_REQUIRED');
    }

    throw error;
  }
}

