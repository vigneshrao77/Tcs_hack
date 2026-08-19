import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";
import OtpToken from "@/models/OtpToken";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const {
      fullName,
      bankId,
      bankName,
      bankCode,
      accountNumber,
      phone,
      permanentAddress,
      password,
    } = body;

    // Validate Full Name
    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      return NextResponse.json(
        { success: false, error: "Full name is required" },
        { status: 400 }
      );
    }

    // Validate Bank Details
    if (!bankName || !bankCode) {
      return NextResponse.json(
        { success: false, error: "Bank selection is required" },
        { status: 400 }
      );
    }

    // Validate Account Number
    if (!accountNumber || typeof accountNumber !== "string" || !accountNumber.trim()) {
      return NextResponse.json(
        { success: false, error: "Account number is required" },
        { status: 400 }
      );
    }

    const formattedAccNumber = accountNumber.trim().toUpperCase();
    const cleanBankCode = bankCode.trim().toUpperCase();
    const cleanBankNamePrefix = bankName.trim().replace(/\s+/g, "").toUpperCase();

    // Check that Account Number starts with bank name or bank code
    const startsWithBankCode = formattedAccNumber.startsWith(cleanBankCode);
    const startsWithBankName = formattedAccNumber.startsWith(
      cleanBankNamePrefix.substring(0, 4)
    );

    if (!startsWithBankCode && !startsWithBankName) {
      return NextResponse.json(
        {
          success: false,
          error: `Account number must start with bank prefix "${cleanBankCode}" (e.g. ${cleanBankCode}-12345678)`,
        },
        { status: 400 }
      );
    }

    // Check for Duplicate Account Number
    const existingAccount = await User.findOne({
      accountNumber: formattedAccNumber,
    });
    if (existingAccount) {
      return NextResponse.json(
        {
          success: false,
          error: `Account number "${formattedAccNumber}" is already registered. Please choose or generate a unique account number.`,
        },
        { status: 409 }
      );
    }

    // Validate Phone Number
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }
    const cleanPhone = phone.trim();
    let formattedPhone = cleanPhone.replace(/[\s()-]/g, "");
    if (!formattedPhone.startsWith("+")) {
      if (formattedPhone.length === 10 && /^[6-9]/.test(formattedPhone)) {
        formattedPhone = `+91${formattedPhone}`;
      } else if (formattedPhone.length === 10) {
        formattedPhone = `+1${formattedPhone}`;
      } else {
        formattedPhone = `+${formattedPhone}`;
      }
    }

    // Validate Phone OTP Verification
    const verifiedOtp = await OtpToken.findOne({
      $or: [{ phone: cleanPhone }, { phone: formattedPhone }],
      verified: true,
    });

    if (!verifiedOtp) {
      return NextResponse.json(
        {
          success: false,
          error: "Phone number has not been verified with SMS code. Please verify your mobile number before submitting.",
        },
        { status: 400 }
      );
    }

    // Validate Address
    if (
      !permanentAddress ||
      typeof permanentAddress !== "string" ||
      !permanentAddress.trim()
    ) {
      return NextResponse.json(
        { success: false, error: "Permanent address is required" },
        { status: 400 }
      );
    }

    // Validate Password
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: "Password must be at least 6 characters long",
        },
        { status: 400 }
      );
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User Document
    const newUser = await User.create({
      fullName: fullName.trim(),
      accountNumber: formattedAccNumber,
      bankId: bankId || undefined,
      bankName: bankName.trim(),
      bankCode: cleanBankCode,
      phone: cleanPhone,
      phoneVerified: true,
      permanentAddress: permanentAddress.trim(),
      password: hashedPassword,
      role: "customer",
    });

    // Clean up OTP token after successful registration
    await OtpToken.deleteMany({ phone: cleanPhone });

    return NextResponse.json(
      {
        success: true,
        message: "Customer registered successfully!",
        data: {
          id: newUser._id,
          fullName: newUser.fullName,
          accountNumber: newUser.accountNumber,
          bankName: newUser.bankName,
          bankCode: newUser.bankCode,
          phone: newUser.phone,
          permanentAddress: newUser.permanentAddress,
          createdAt: newUser.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to register user";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
