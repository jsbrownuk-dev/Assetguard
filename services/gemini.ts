import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AnalyzedAsset {
  title: string;
  make: string;
  serialNumber: string;
  value: number;
  location: string;
}

export const analyzeAssetImage = async (base64Image: string): Promise<AnalyzedAsset | null> => {
  try {
    // Remove data URL header if present to get pure base64
    const base64Data = base64Image.includes('base64,') 
      ? base64Image.split('base64,')[1] 
      : base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          },
          {
            text: "Analyze this image of an equipment asset. Extract or infer the following details: 'title' (a concise name of the item), 'make' (manufacturer), 'serialNumber' (if visible, otherwise empty string), 'value' (estimated current market value in GBP, number only), and 'location' (a generic room type based on background, e.g., 'Office')."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            make: { type: Type.STRING },
            serialNumber: { type: Type.STRING },
            value: { type: Type.NUMBER },
            location: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalyzedAsset;
    }
    return null;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return null;
  }
};