import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import ServiceToken from "@/models/ServiceToken";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { checkLagAndOptimizeQueue } from "@/lib/aiQueueOptimizer";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();
    const { status, assignedEmployeeId, assignedEmployeeName, assignedDesk } = body;

    const token = await ServiceToken.findById(id);
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token not found" },
        { status: 404 }
      );
    }

    if (status) {
      token.status = status;
    }
    if (assignedEmployeeId) {
      token.assignedEmployeeId = assignedEmployeeId;
    }
    if (assignedEmployeeName) {
      token.assignedEmployeeName = assignedEmployeeName;
    }
    if (assignedDesk) {
      token.assignedDesk = assignedDesk;
    }

    await token.save();

    let aiOptimization = null;
    if (status === "completed") {
      try {
        aiOptimization = await checkLagAndOptimizeQueue(
          token._id.toString(),
          assignedEmployeeId || token.assignedEmployeeId
        );
      } catch (optErr) {
        console.warn("AI lag optimization non-blocking warning:", optErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Token ${token.tokenNumber} updated to status: ${token.status}`,
      data: token,
      aiOptimization,
    });
  } catch (error: unknown) {
    console.error("Token update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update token",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`token-del:${ip}`, 20, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many token cancellations. Please wait." },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const { id } = await params;

    // Retrieve requesting account number to prevent IDOR (Insecure Direct Object Reference)
    const requestingAcc = (
      req.headers.get("x-account-number") ||
      req.nextUrl.searchParams.get("accountNumber") ||
      ""
    ).trim().toUpperCase();

    const token = await ServiceToken.findById(id);

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token ticket not found" },
        { status: 404 }
      );
    }

    // If requesting account number is provided, enforce ownership check
    if (requestingAcc && token.accountNumber.toUpperCase() !== requestingAcc) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: You do not have permission to cancel this token ticket.",
        },
        { status: 403 }
      );
    }

    token.status = "cancelled";
    await token.save();

    return NextResponse.json({
      success: true,
      message: `Token ${token.tokenNumber} has been cancelled`,
      data: token,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to cancel token";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
