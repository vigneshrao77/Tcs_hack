import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import ServiceToken, { CounterCategory } from "@/models/ServiceToken";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const bankCode = (searchParams.get("bankCode") || "").trim().toUpperCase();
    const category = (searchParams.get("category") || "").trim() as CounterCategory;
    const employeeId = (searchParams.get("employeeId") || "").trim();

    if (!bankCode) {
      return NextResponse.json(
        { success: false, error: "bankCode query param is required" },
        { status: 400 }
      );
    }

    // Filter by branch code (case-insensitive)
    const matchFilter: any = {
      bankCode: { $regex: new RegExp(`^${bankCode}$`, "i") },
    };

    if (category) {
      matchFilter.assignedCategory = category;
    }

    const [activeTokens, completedTokens, allRecentTokens] = await Promise.all([
      // 1. Tokens currently waiting, called, or in_service
      ServiceToken.find({
        ...matchFilter,
        status: { $in: ["waiting", "called", "in_service"] },
      })
        .sort({ queuePosition: 1, createdAt: 1 })
        .lean(),

      // 2. Completed tokens
      ServiceToken.find({
        ...matchFilter,
        status: "completed",
      })
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),

      // 3. All tokens in this domain
      ServiceToken.find(matchFilter)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    // Active serving or called token
    const currentServing = activeTokens.find(
      (t) => t.status === "in_service" || t.status === "called"
    );
    const waitingQueue = activeTokens.filter(
      (t) => t.status === "waiting"
    );

    return NextResponse.json({
      success: true,
      data: {
        currentServing: currentServing || null,
        waitingQueue,
        completedToday: completedTokens,
        allBookings: allRecentTokens,
        stats: {
          totalWaiting: waitingQueue.length,
          totalServing: currentServing ? 1 : 0,
          totalCompleted: completedTokens.length,
          totalAll: allRecentTokens.length,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Employee queue fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load employee queue",
      },
      { status: 500 }
    );
  }
}
