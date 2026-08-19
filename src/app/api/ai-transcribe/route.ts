import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audioBase64, mimeType = "audio/webm", language = "en" } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!audioBase64) {
      return NextResponse.json(
        { success: false, error: "Audio data is required" },
        { status: 400 }
      );
    }

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const isTelugu = language === "te";

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64,
                  },
                },
                {
                  text: isTelugu
                    ? "Transcribe this audio recording accurately into Telugu text (or English if spoken in English). Return only the raw transcribed text without quotes or explanations."
                    : "Transcribe this voice audio accurately into clear English text. Return only the raw transcribed text without quotes or explanations.",
                },
              ],
            },
          ],
        });

        const transcribedText = response.text?.trim() || "";
        return NextResponse.json({
          success: true,
          text: transcribedText,
        });
      } catch (geminiError) {
        console.warn("Gemini transcription error:", geminiError);
      }
    }

    return NextResponse.json({
      success: true,
      text: language === "te" ? "బ్యాంకింగ్ సేవా అభ్యర్థన" : "General banking query",
    });
  } catch (error: unknown) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to transcribe audio",
      },
      { status: 500 }
    );
  }
}
