import { GoogleGenAI, Type } from "@google/genai";

const envApiKey = process.env.API_KEY as string;

export interface AIPlanResponse {
  title: string;
  description: string;
  tasks: {
    title: string;
    subtasks: {
      title: string;
      estimatedMinutes: number;
    }[];
  }[];
}

export const generateThesisPlan = async (
  topic: string, 
  level: string, 
  researchType: string
): Promise<AIPlanResponse> => {
  
  const ai = new GoogleGenAI({ apiKey: envApiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', // Upgraded to Pro for complex task
    contents: `
    Create a comprehensive thesis writing and research plan for a ${level} degree.
    Research Type: ${researchType}.
    Topic: ${topic}.
    
    Structure the plan into key academic phases (e.g., Literature Review, Methodology, Data Collection/Implementation, Analysis, Writing, Defense Prep).
    Break down each phase into actionable subtasks.
    Estimate time in minutes for each subtask (be realistic, writing tasks take hours, convert to minutes).
    The output must be JSON matching the schema.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                subtasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      estimatedMinutes: { type: Type.NUMBER },
                    },
                    required: ["title", "estimatedMinutes"],
                  },
                },
              },
              required: ["title", "subtasks"],
            },
          },
        },
        required: ["title", "description", "tasks"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response generated from AI.");
  }
  
  return JSON.parse(text) as AIPlanResponse;
};