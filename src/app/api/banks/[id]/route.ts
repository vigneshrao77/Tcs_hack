import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import BankBranch from "@/models/BankBranch";
import { verifyAdminSecret, checkRateLimit, getClientIp } from "@/lib/security";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const branch = await BankBranch.findById(id);
    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Bank branch not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: branch });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch branch";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`banks-put:${ip}`, 30, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const { id } = await params;
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

    const updateData: Record<string, unknown> = {};

    if (body.bankName && typeof body.bankName === "string") {
      updateData.bankName = body.bankName.trim();
    }
    if (body.bankLocation && typeof body.bankLocation === "string") {
      updateData.bankLocation = body.bankLocation.trim();
    }
    if (body.bankPhone && typeof body.bankPhone === "string") {
      updateData.bankPhone = body.bankPhone.trim();
    }
    if (body.status === "active" || body.status === "maintenance" || body.status === "closed") {
      updateData.status = body.status;
    }

    if (body.bankCode && typeof body.bankCode === "string") {
      const formattedCode = body.bankCode.trim().toUpperCase();
      const existing = await BankBranch.findOne({
        bankCode: formattedCode,
        _id: { $ne: id },
      });
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: `Another branch with code "${formattedCode}" already exists.`,
          },
          { status: 409 }
        );
      }
      updateData.bankCode = formattedCode;
    }

    if (body.coordinates?.latitude && body.coordinates?.longitude) {
      updateData.coordinates = {
        latitude: Number(body.coordinates.latitude),
        longitude: Number(body.coordinates.longitude),
      };
    }

    if (body.staffing) {
      updateData.staffing = {
        managers: Math.min(20, Math.max(1, Number(body.staffing.managers ?? 1))),
        cashCounters: Math.min(50, Math.max(0, Number(body.staffing.cashCounters ?? 0))),
        loanOfficers: Math.min(50, Math.max(0, Number(body.staffing.loanOfficers ?? 0))),
        customerService: Math.min(50, Math.max(0, Number(body.staffing.customerService ?? 0))),
        accountAndKyc: Math.min(50, Math.max(0, Number(body.staffing.accountAndKyc ?? 0))),
      };
    }

    const updatedBranch = await BankBranch.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedBranch) {
      return NextResponse.json(
        { success: false, error: "Bank branch not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Branch updated successfully",
      data: updatedBranch,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update branch";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`banks-del:${ip}`, 10, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const { id } = await params;

    if (!verifyAdminSecret(req)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Invalid or missing Admin Secret Code.",
        },
        { status: 403 }
      );
    }

    const deleted = await BankBranch.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Bank branch not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Branch "${deleted.bankName}" (${deleted.bankCode}) deleted successfully`,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to delete branch";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
