import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Rate limit: Max 20 speech synthesis requests per minute per IP
    const rate = checkRateLimit(`speech:${ip}`, 20, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: "Speech synthesis rate limit exceeded. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { text, language = "en" } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { success: false, error: "Text is required for speech synthesis" },
        { status: 400 }
      );
    }

    const sarvamApiKey = (process.env.SARVAM_API_KEY || "").trim();
    const isTelugu = language === "te";

    // Clean text for speech synthesis (truncate if excessively long)
    const cleanedText = text
      .replace(/[*_#`~]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 450);

    if (sarvamApiKey) {
      try {
        const ttsRes = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "api-subscription-key": sarvamApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: [cleanedText],
            target_language_code: isTelugu ? "te-IN" : "en-IN",
            speaker: isTelugu ? "anushka" : "anushka",
            model: "bulbul:v2",
            pitch: 0,
            pace: 1.0,
            loudness: 1.2,
          }),
        });

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          if (ttsData.audios && ttsData.audios.length > 0) {
            return NextResponse.json({
              success: true,
              audioBase64: ttsData.audios[0],
              mimeType: "audio/wav",
              engine: "Sarvam AI (bulbul:v2)",
            });
          }
        } else {
          const errText = await ttsRes.text();
          console.warn("Sarvam AI TTS API error:", ttsRes.status, errText);
        }
      } catch (sarvamErr) {
        console.warn("Sarvam AI TTS Exception:", sarvamErr);
      }
    }

    return NextResponse.json({
      success: true,
      audioBase64: null,
      useBrowserSpeech: true,
      text: cleanedText,
      language: isTelugu ? "te-IN" : "en-IN",
      engine: "Web Speech Synthesis Fallback",
    });
  } catch (error: unknown) {
    console.error("Text to speech exception:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to synthesize speech",
      },
      { status: 500 }
    );
  }
}
