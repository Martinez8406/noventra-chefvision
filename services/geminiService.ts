
import { GoogleGenAI } from "@google/genai";
import { GeneratorParams, BlurLevel } from "../types";

export const generateDishImage = async (params: GeneratorParams, plateImage?: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Professional food photography of ${params.dishName}. 
    Style: ${params.style}.
    ${plateImage ? 'COMPOSITION: Place the food EXACTLY on the plate and background shown in the attached reference image. Maintain the lighting and atmosphere of the reference.' : `PLATING: Served on a ${params.plateType}.`}
    VIEW: Shot from a ${params.cameraAngle}. 
    LIGHTING: ${params.lighting}. 
    Photorealistic, appetizing, depth of field, culinary art, ultra-detailed textures, vibrant colors, 8k resolution style.`;

  const parts: any[] = [{ text: prompt }];

  if (plateImage) {
    try {
      const mimeType = plateImage.split(';')[0].split(':')[1] || 'image/jpeg';
      const base64Data = plateImage.split(',')[1];
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    } catch (e) {
      console.error("Error parsing plate image:", e);
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "4:3"
        }
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("Model nie zwrócił żadnych propozycji.");
    }

    const candidate = response.candidates[0];
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("Brak danych obrazu w odpowiedzi modelu.");
  } catch (error: any) {
    console.error("Gemini Visualizer Error:", error);
    
    if (error.message?.includes("Requested entity was not found") || 
        error.message?.includes("API_KEY") || 
        error.message?.includes("403") ||
        error.message?.includes("404")) {
      throw new Error("API_KEY_REQUIRED");
    }
    
    throw error;
  }
};

export const processBackdropImage = async (base64Image: string, level: BlurLevel): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let blurInstructions = "";
  if (level === BlurLevel.NATURAL) {
    blurInstructions = "Do NOT apply any blur effect. Return the image exactly as provided – sharp, original, no depth-of-field effect whatsoever.";
  } else if (level === BlurLevel.INSTAGRAM) {
    blurInstructions = "Apply light blur (Gaussian blur approx. 7%). Effect: subtle subject separation, modern social-media style.";
  } else if (level === BlurLevel.FINE_DINING) {
    blurInstructions = "Apply medium-strong blur (Gaussian blur approx. 15%). Effect: elegant, premium look with noticeable background softness.";
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

  try {
    const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';
    const base64Data = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      }
    });

    const candidate = response.candidates[0];
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Brak przetworzonego obrazu.");
  } catch (error) {
    console.error("Backdrop Processing Error:", error);
    throw error;
  }
};
