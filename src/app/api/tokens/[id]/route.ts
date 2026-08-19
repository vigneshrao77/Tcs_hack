import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import ServiceToken from "@/models/ServiceToken";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const token = await ServiceToken.findByIdAndUpdate(
      id,
      { status: "cancelled" },
      { new: true }
    );

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token ticket not found" },
        { status: 404 }
      );
    }

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
