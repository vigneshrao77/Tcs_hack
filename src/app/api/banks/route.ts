import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import BankBranch from "@/models/BankBranch";
import {
  escapeRegex,
  verifyAdminSecret,
  checkRateLimit,
  getClientIp,
} from "@/lib/security";

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`banks-get:${ip}`, 60, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    let query = {};
    if (search && search.trim()) {
      const sanitizedSearch = escapeRegex(search.trim());
      const regex = new RegExp(sanitizedSearch, "i");
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
    const ip = getClientIp(req);
    const rate = checkRateLimit(`banks-post:${ip}`, 20, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const body = await req.json();

    if (!verifyAdminSecret(req, body.secretCode)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Invalid or missing Admin Secret Code.",
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

    // Process staffing numbers with bounds enforcement
    const cleanStaffing = {
      managers: Math.min(20, Math.max(1, Number(staffing?.managers ?? 1))),
      cashCounters: Math.min(50, Math.max(0, Number(staffing?.cashCounters ?? 0))),
      loanOfficers: Math.min(50, Math.max(0, Number(staffing?.loanOfficers ?? 0))),
      customerService: Math.min(50, Math.max(0, Number(staffing?.customerService ?? 0))),
      accountAndKyc: Math.min(50, Math.max(0, Number(staffing?.accountAndKyc ?? 0))),
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
      status: status === "maintenance" || status === "closed" ? status : "active",
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
