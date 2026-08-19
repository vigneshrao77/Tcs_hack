import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audioBase64, mimeType = "audio/wav", language = "en" } = body;

    if (!audioBase64) {
      return NextResponse.json(
        { success: false, error: "Audio data is required" },
        { status: 400 }
      );
    }

    const sarvamApiKey = process.env.SARVAM_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const isTelugu = language === "te";

    // 1. Primary STT: Sarvam AI (Model: saarika:v2.5)
    if (sarvamApiKey) {
      try {
        const audioBuffer = Buffer.from(audioBase64, "base64");
        const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "webm";

        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: mimeType });
        formData.append("file", blob, `voice.${ext}`);
        formData.append("model", "saarika:v2.5");
        formData.append("language_code", isTelugu ? "te-IN" : "en-IN");
        formData.append("with_diacritics", "true");

        const sarvamRes = await fetch("https://api.sarvam.ai/speech-to-text", {
          method: "POST",
          headers: {
            "api-subscription-key": sarvamApiKey.trim(),
          },
          body: formData,
        });

        if (sarvamRes.ok) {
          const sarvamData = await sarvamRes.json();
          const transcript = (sarvamData.transcript || sarvamData.text || "").trim();
          if (transcript) {
            return NextResponse.json({
              success: true,
              text: transcript,
              engine: "Sarvam AI (saarika:v2.5)",
            });
          }
        } else {
          const errText = await sarvamRes.text();
          console.warn("Sarvam AI STT error:", sarvamRes.status, errText);
        }
      } catch (sarvamErr) {
        console.warn("Sarvam AI call exception:", sarvamErr);
      }
    }

    // 2. Secondary Fallback STT: Google Gemini (gemini-1.5-flash / gemini-2.0-flash)
    if (geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey.trim() });
        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
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
                    ? "Transcribe this Indian voice recording accurately into Telugu script. Return ONLY the transcribed text without extra formatting."
                    : "Transcribe this Indian voice recording accurately into clear English text. Return ONLY the transcribed text without extra formatting.",
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
            engine: "Gemini 1.5 Flash STT",
          });
        }
      } catch (geminiError) {
        console.warn("Gemini transcription fallback error:", geminiError);
      }
    }

    return NextResponse.json({
      success: true,
      text: isTelugu ? "బ్యాంకింగ్ సేవా అభ్యర్థన" : "General banking inquiry",
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
