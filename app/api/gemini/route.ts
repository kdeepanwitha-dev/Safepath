import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function POST(req: NextRequest) {
  try {
    const { origin, destination, timeOfDay, strategies } = await req.json();

    const prompt = `
You are SafeAI, an expert urban safety and multi-objective route planning assistant.
Analyze the following journey and provide structured professional guidance:
- Origin: ${origin}
- Destination: ${destination}
- Time of Day: ${timeOfDay}
- Route Strategies Evaluated:
${JSON.stringify(strategies, null, 2)}

Provide a structured JSON or Markdown analysis covering:
1. Comparative trade-off analysis between the 4 routes (Shortest, Safety-Only, Fixed-Weighted, Adaptive Multi-Objective).
2. Key risk factors for this journey at this time of day (lighting, isolation, crowd density, emergency facilities).
3. Practical precautions and emergency checklist for the traveler.
4. Why the adaptive multi-objective route offers the best balance of safety and travel time.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return NextResponse.json({ analysis: response.text });
  } catch (error: any) {
    console.error("Gemini AI API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate AI safety analysis" },
      { status: 500 }
    );
  }
}
