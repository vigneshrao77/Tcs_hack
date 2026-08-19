import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import BankBranch from "@/models/BankBranch";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    let query = {};
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query = {
        $or: [
          { bankName: regex },
          { bankLocation: regex },
          { bankCode: regex },
          { bankPhone: regex },
        ],
      };
    }

    const branches = await BankBranch.find(query).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      count: branches.length,
      data: branches,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch bank branches";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const secretHeader = req.headers.get("x-admin-secret");
    const secretFromReq = secretHeader || body.secretCode;

    if (secretFromReq !== "123456789") {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Invalid or missing Admin Secret Code (123456789 required).",
        },
        { status: 403 }
      );
    }

    const { bankName, bankLocation, bankPhone, bankCode, staffing, status } =
      body;

    if (!bankName || typeof bankName !== "string" || !bankName.trim()) {
      return NextResponse.json(
        { success: false, error: "Bank name is required" },
        { status: 400 }
      );
    }

    if (
      !bankLocation ||
      typeof bankLocation !== "string" ||
      !bankLocation.trim()
    ) {
      return NextResponse.json(
        { success: false, error: "Bank location is required" },
        { status: 400 }
      );
    }

    if (!bankPhone || typeof bankPhone !== "string" || !bankPhone.trim()) {
      return NextResponse.json(
        { success: false, error: "Bank phone number is required" },
        { status: 400 }
      );
    }

    if (!bankCode || typeof bankCode !== "string" || !bankCode.trim()) {
      return NextResponse.json(
        { success: false, error: "Bank code is required" },
        { status: 400 }
      );
    }

    const formattedCode = bankCode.trim().toUpperCase();

    // Check for existing bankCode
    const existing = await BankBranch.findOne({ bankCode: formattedCode });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `A branch with code "${formattedCode}" is already registered.`,
        },
        { status: 409 }
      );
    }

    // Process staffing numbers
    const cleanStaffing = {
      managers: Math.max(1, Number(staffing?.managers ?? 1)),
      cashCounters: Math.max(0, Number(staffing?.cashCounters ?? 0)),
      loanOfficers: Math.max(0, Number(staffing?.loanOfficers ?? 0)),
      customerService: Math.max(0, Number(staffing?.customerService ?? 0)),
      accountAndKyc: Math.max(0, Number(staffing?.accountAndKyc ?? 0)),
    };

    const newBranch = await BankBranch.create({
      bankName: bankName.trim(),
      bankLocation: bankLocation.trim(),
      bankPhone: bankPhone.trim(),
      bankCode: formattedCode,
      coordinates: body.coordinates?.latitude && body.coordinates?.longitude
        ? {
            latitude: Number(body.coordinates.latitude),
            longitude: Number(body.coordinates.longitude),
          }
        : undefined,
      staffing: cleanStaffing,
      status: status || "active",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Bank branch registered successfully",
        data: newBranch,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to register bank branch";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
