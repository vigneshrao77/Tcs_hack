import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Rate limit: Max 30 transcription requests per minute per IP
    const rate = checkRateLimit(`transcribe:${ip}`, 30, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: "Speech transcription rate limit exceeded. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { audioBase64, mimeType = "audio/wav", language = "en" } = body;

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return NextResponse.json(
        { success: false, error: "Audio data is required for Sarvam AI transcription" },
        { status: 400 }
      );
    }

    // Security: Enforce maximum payload size (10MB limit)
    if (audioBase64.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Audio file exceeds maximum allowed size of 10MB." },
        { status: 413 }
      );
    }

    const sarvamApiKey = (process.env.SARVAM_API_KEY || "").trim();
    const isTelugu = language === "te";

    if (!sarvamApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "SARVAM_API_KEY is not configured in .env.local. Please add your Sarvam AI API key.",
        },
        { status: 500 }
      );
    }

    // Convert Base64 to binary buffer and send directly to Sarvam AI STT API
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
        "api-subscription-key": sarvamApiKey,
      },
      body: formData,
    });

    if (!sarvamRes.ok) {
      const errBody = await sarvamRes.text();
      console.error("Sarvam AI Speech-to-Text API Error:", sarvamRes.status, errBody);
      return NextResponse.json(
        {
          success: false,
          error: `Sarvam AI STT Error (${sarvamRes.status}): ${errBody}`,
        },
        { status: sarvamRes.status }
      );
    }

    const sarvamData = await sarvamRes.json();
    const transcript = (sarvamData.transcript || sarvamData.text || "").trim();

    return NextResponse.json({
      success: true,
      text: transcript,
      language_code: sarvamData.language_code || (isTelugu ? "te-IN" : "en-IN"),
      engine: "Sarvam AI (saarika:v2.5)",
    });
  } catch (error: unknown) {
    console.error("Sarvam AI Transcription Exception:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to transcribe audio via Sarvam AI",
      },
      { status: 500 }
    );
  }
}
