import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import mongoose from "mongoose";

export async function GET() {
  const uriConfigured = Boolean(process.env.MONGODB_URI);

  if (!uriConfigured) {
    return NextResponse.json(
      {
        status: "unconfigured",
        message: "MONGODB_URI is not configured in .env.local",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  try {
    await connectToDatabase();
    const readyState = mongoose.connection.readyState;
    // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const stateMap: Record<number, string> = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    return NextResponse.json({
      status: readyState === 1 ? "success" : "warning",
      database: stateMap[readyState] || "unknown",
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to connect to database";
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
