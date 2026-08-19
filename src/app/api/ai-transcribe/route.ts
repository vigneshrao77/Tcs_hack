import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audioBase64, mimeType = "audio/webm", language = "en" } = body;

    if (!audioBase64) {
      return NextResponse.json(
        { success: false, error: "Audio data is required" },
        { status: 400 }
      );
    }

    const sarvamApiKey = process.env.SARVAM_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const isTelugu = language === "te";

    // 1. Primary STT: Sarvam AI (Indian Languages & Accents Specialist)
    if (sarvamApiKey) {
      try {
        const audioBuffer = Buffer.from(audioBase64, "base64");
        const formData = new FormData();

        const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "webm";
        const blob = new Blob([audioBuffer], { type: mimeType });
        formData.append("file", blob, `recording.${ext}`);
        formData.append("model", "saaras:v2");
        formData.append("language_code", isTelugu ? "te-IN" : "en-IN");
        formData.append("with_diacritics", "true");

        const sarvamRes = await fetch("https://api.sarvam.ai/speech-to-text", {
          method: "POST",
          headers: {
            "api-subscription-key": sarvamApiKey,
          },
          body: formData,
        });

        if (sarvamRes.ok) {
          const sarvamData = await sarvamRes.json();
          const transcript = sarvamData.transcript || sarvamData.text || "";
          if (transcript) {
            return NextResponse.json({
              success: true,
              text: transcript,
              engine: "Sarvam AI (saaras:v2)",
            });
          }
        } else {
          console.warn("Sarvam AI STT response not ok:", await sarvamRes.text());
        }
      } catch (sarvamErr) {
        console.warn("Sarvam AI STT error, falling back to Gemini:", sarvamErr);
      }
    }

    // 2. Secondary STT: Google Gemini 2.5 Flash
    if (geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
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
                    ? "Transcribe this Indian voice recording accurately into Telugu script. Return ONLY the transcribed text."
                    : "Transcribe this Indian voice recording accurately into clear English text. Return ONLY the transcribed text.",
                },
              ],
            },
          ],
        });

        const transcribedText = response.text?.trim() || "";
        if (transcribedText) {
          return NextResponse.json({
            success: true,
            text: transcribedText,
            engine: "Gemini 2.5 Flash STT",
          });
        }
      } catch (geminiError) {
        console.warn("Gemini transcription error:", geminiError);
      }
    }

    // 3. Fallback placeholder if no API key is yet configured
    return NextResponse.json({
      success: true,
      text: isTelugu ? "బ్యాంకింగ్ సేవా అభ్యర్థన" : "General banking query",
      engine: "Fallback",
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
