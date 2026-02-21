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

/** Buduje bogaty prompt dla Geminiego na podstawie aktualnych ustawień studia. */
export function buildDishPrompt(settings: AiDishSettings): string {
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
  const anglePhrase = angleLabel.toLowerCase();

  const backdropInstruction = hasCustomBackdrop
    ? 'First reference image (if provided): the restaurant background – use it as the real environment. Keep perspective, colors and atmosphere; place the dish naturally in this scene.'
    : `Background: styled to match a high-end restaurant setting that fits the selected plate type (${plateLabel}).`;

  const tablewareInstruction = hasCustomTableware
    ? 'Second reference image (if provided): the plate or tableware – place the generated dish EXACTLY on this plate/setting. Preserve the shape, color and style of the plate; only add the food on top.'
    : '';

  return [
    `Professional food photography of ${dishName}.`,
    `Style: ${stylePhrase} fine dining restaurant presentation, chef-level plating, sophisticated composition.`,
    `Lighting: ${lightingPhrase} lighting for food – warm, appetizing highlights, soft shadows, no harsh contrast.`,
    `Camera angle: ${anglePhrase} – composed like a cinematic hero shot for restaurant menu.`,
    backdropInstruction,
    tablewareInstruction,
    'Goals: hyper-realistic textures, perfect focus on the dish, shallow depth of field, bokeh in the background, ultra-detailed ingredients, vibrant yet natural colors.',
    'Output: a single photorealistic culinary image, 4:3 aspect ratio, suitable for premium restaurant menu and marketing.',
  ].join('\n');
}

/** Pełna generacja obrazu dania z użyciem Gemini 2.x Flash (image model). */
export async function generateDishImageWithAI(
  params: GeneratorParams,
  settings: AiDishSettings,
  options?: { backdropImage?: string; tablewareImage?: string }
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = buildDishPrompt(settings);

  const parts: any[] = [{ text: prompt }];

  const addImagePart = (dataUrl: string) => {
    try {
      const mimeType = dataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
      const base64Data = dataUrl.split(',')[1];
      if (mimeType && base64Data) {
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }
    } catch (e) {
      console.error('Error parsing image for AI:', e);
    }
  };

  // Kolejność: 1) tło (środowisko), 2) zastawa (talerz) – AI najpierw widzi tło, potem talerz
  if (options?.backdropImage) addImagePart(options.backdropImage);
  if (options?.tablewareImage) addImagePart(options.tablewareImage);

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

