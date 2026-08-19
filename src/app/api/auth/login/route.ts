import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Rate limit: Max 5 login attempts per minute per IP to prevent brute force
    const rate = checkRateLimit(`login:${ip}`, 5, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed sign-in attempts. Account access temporarily locked. Please retry in ${Math.ceil(
            rate.resetInMs / 1000
          )} seconds.`,
        },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const body = await req.json();
    const { accountNumber, password } = body;

    if (!accountNumber || !password) {
      return NextResponse.json(
        { success: false, error: "Account number and password are required" },
        { status: 400 }
      );
    }

    const cleanAccNumber = accountNumber.trim().toUpperCase();

    // Find User by unique Account Number
    const user = await User.findOne({ accountNumber: cleanAccNumber });
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid account number or password.",
        },
        { status: 401 }
      );
    }

    // Verify Password
    if (!user.password) {
      return NextResponse.json(
        { success: false, error: "Authentication configuration error" },
        { status: 500 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Invalid account number or password." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Login successful!",
      data: {
        id: user._id,
        fullName: user.fullName,
        accountNumber: user.accountNumber,
        bankName: user.bankName,
        bankCode: user.bankCode,
        phone: user.phone,
        permanentAddress: user.permanentAddress,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to log in";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
