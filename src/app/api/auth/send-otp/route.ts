import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import OtpToken from "@/models/OtpToken";
import bcrypt from "bcryptjs";
import twilio from "twilio";

// Helper function to format phone number to E.164
function formatToE164(phone: string): string {
  let cleaned = phone.trim().replace(/[\s()-]/g, "");
  if (!cleaned.startsWith("+")) {
    // If 10 digits (e.g. Indian mobile number starting with 6-9), default to +91
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
      cleaned = `+91${cleaned}`;
    } else if (cleaned.length === 10) {
      cleaned = `+1${cleaned}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { phone } = body;

    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    const formattedPhone = formatToE164(phone);

    // Generate 6-digit OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(rawOtp, 8);

    // Delete any old unverified OTPs for this phone (check both raw and formatted)
    await OtpToken.deleteMany({
      $or: [{ phone: phone.trim() }, { phone: formattedPhone }],
    });

    // Save new OTP record (expires in 5 minutes)
    await OtpToken.create({
      phone: formattedPhone,
      otpHash,
      verified: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || (!twilioPhone && !verifyServiceSid)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Twilio credentials not found in environment. Please ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are set.",
        },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    if (verifyServiceSid) {
      await client.verify.v2
        .services(verifyServiceSid)
        .verifications.create({ to: formattedPhone, channel: "sms" });
    } else if (twilioPhone) {
      await client.messages.create({
        body: `Your Bank verification code is: ${rawOtp}. Valid for 5 minutes. Do not share this code.`,
        from: twilioPhone,
        to: formattedPhone,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Verification code has been sent via SMS to ${formattedPhone}`,
      formattedPhone,
    });
  } catch (error: unknown) {
    console.error("Twilio SMS Dispatch Error:", error);
    let errorMessage = "Failed to send SMS via Twilio.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: `Twilio Error: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
