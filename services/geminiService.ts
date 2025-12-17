import { GoogleGenAI } from "@google/genai";
import { ImageSize } from "../types";

// Helper to get client with current API Key
const getClient = () => {
  // In a Vite build, we access env vars via import.meta.env, but process.env is polyfilled in vite.config.ts
  const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please set the API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateAppAsset = async (
  prompt: string,
  imageSize: ImageSize,
  aspectRatio: string
): Promise<string> => {
  const ai = getClient();
  
  // Using gemini-3-pro-image-preview as requested for generation
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: imageSize
      }
    }
  });

  // Extract image
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  
  throw new Error("No image generated.");
};

export const editAppAsset = async (
  base64Image: string,
  prompt: string
): Promise<string> => {
  const ai = getClient();
  
  // Using gemini-2.5-flash-image for editing as requested
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image.replace(/^data:image\/\w+;base64,/, ""),
            mimeType: 'image/png' // Assuming PNG for simplicity, usually safe for uploaded base64
          }
        },
        { text: prompt }
      ]
    }
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }

  throw new Error("No image returned from edit operation.");
};

export const checkApiKey = async (): Promise<boolean> => {
  // Simplified for deployed environment
  return !!(process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY);
};

export const selectApiKey = async (): Promise<void> => {
  console.warn("API Key selection not supported in this environment. Please set API_KEY env var.");
};