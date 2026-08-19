import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import OtpToken from "@/models/OtpToken";
import bcrypt from "bcryptjs";
import twilio from "twilio";
import { checkRateLimit, getClientIp } from "@/lib/security";

function formatToE164(phone: string): string {
  let cleaned = phone.trim().replace(/[\s()-]/g, "");
  if (!cleaned.startsWith("+")) {
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
    const ip = getClientIp(req);
    // Rate limit: Max 5 verification attempts per minute to prevent brute-forcing 6-digit OTPs
    const rate = checkRateLimit(`verify-otp:${ip}`, 5, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many invalid attempts. Please wait ${Math.ceil(
            rate.resetInMs / 1000
          )} seconds before trying again.`,
        },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const body = await req.json();
    const { phone, otp } = body;

    if (!phone || !otp) {
      return NextResponse.json(
        { success: false, error: "Phone number and OTP code are required" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.trim();
    const formattedPhone = formatToE164(phone);
    const cleanOtp = otp.toString().trim();

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    // Check with Twilio Verify API if configured
    if (accountSid && authToken && verifyServiceSid) {
      try {
        const client = twilio(accountSid, authToken);
        const check = await client.verify.v2
          .services(verifyServiceSid)
          .verificationChecks.create({ to: formattedPhone, code: cleanOtp });

        if (check.status === "approved") {
          await OtpToken.findOneAndUpdate(
            { $or: [{ phone: cleanPhone }, { phone: formattedPhone }] },
            { verified: true },
            { sort: { createdAt: -1 } }
          );
          return NextResponse.json({
            success: true,
            message: "Phone number verified successfully",
          });
        } else {
          return NextResponse.json(
            { success: false, error: "Invalid or expired OTP code" },
            { status: 400 }
          );
        }
      } catch (twilioErr) {
        console.error("Twilio Verify API check error:", twilioErr);
      }
    }

    // Standard database OTP verification
    const tokenRecord = await OtpToken.findOne({
      $or: [{ phone: cleanPhone }, { phone: formattedPhone }],
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!tokenRecord) {
      return NextResponse.json(
        {
          success: false,
          error: "No active verification code found or OTP expired. Please request a new OTP.",
        },
        { status: 400 }
      );
    }

    const isMatch = await bcrypt.compare(cleanOtp, tokenRecord.otpHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Incorrect OTP code. Please check SMS on your phone and try again." },
        { status: 400 }
      );
    }

    tokenRecord.verified = true;
    await tokenRecord.save();

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully!",
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to verify OTP";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
