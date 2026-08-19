import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
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
          error: "No account found with this Account Number. Please verify or register.",
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
        { success: false, error: "Invalid password. Please try again." },
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
