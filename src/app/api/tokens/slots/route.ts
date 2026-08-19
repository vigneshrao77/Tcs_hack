import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import ServiceToken, { CounterCategory } from "@/models/ServiceToken";
import BankBranch from "@/models/BankBranch";

export interface TimeSlotOption {
  slot: string;
  from: string;
  to: string;
  startMinutes: number;
  endMinutes: number;
  available: boolean;
  status: "available" | "full" | "past";
  bookedCount: number;
  capacity: number;
}

const DAILY_SLOT_TEMPLATES = [
  { from: "09:00 AM", to: "09:30 AM", startMinutes: 540, endMinutes: 570 },
  { from: "09:30 AM", to: "10:00 AM", startMinutes: 570, endMinutes: 600 },
  { from: "10:00 AM", to: "10:30 AM", startMinutes: 600, endMinutes: 630 },
  { from: "10:30 AM", to: "11:00 AM", startMinutes: 630, endMinutes: 660 },
  { from: "11:00 AM", to: "11:30 AM", startMinutes: 660, endMinutes: 690 },
  { from: "11:30 AM", to: "12:00 PM", startMinutes: 690, endMinutes: 720 },
  { from: "12:00 PM", to: "12:30 PM", startMinutes: 720, endMinutes: 750 },
  { from: "12:30 PM", to: "01:00 PM", startMinutes: 750, endMinutes: 780 },
  { from: "01:00 PM", to: "01:30 PM", startMinutes: 780, endMinutes: 810 },
  { from: "01:30 PM", to: "02:00 PM", startMinutes: 810, endMinutes: 840 },
  { from: "02:00 PM", to: "02:30 PM", startMinutes: 840, endMinutes: 870 },
  { from: "02:30 PM", to: "03:00 PM", startMinutes: 870, endMinutes: 900 },
  { from: "03:00 PM", to: "03:30 PM", startMinutes: 900, endMinutes: 930 },
  { from: "03:30 PM", to: "04:00 PM", startMinutes: 930, endMinutes: 960 },
  { from: "04:00 PM", to: "04:30 PM", startMinutes: 960, endMinutes: 990 },
  { from: "04:30 PM", to: "05:00 PM", startMinutes: 990, endMinutes: 1020 },
];

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const bankCode = (searchParams.get("bankCode") || "").trim().toUpperCase();
    const category = (searchParams.get("category") || "").trim() as CounterCategory;
    const dateOption = searchParams.get("dateOption") || "today"; // "today" | "tomorrow"

    const now = new Date();
    const isToday = dateOption !== "tomorrow";

    const targetDate = new Date(now);
    if (!isToday) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();

    // 1. Fetch branch staffing to determine slot capacity
    let staffCount = 1;
    if (bankCode) {
      const branch = await BankBranch.findOne({ bankCode }).select("staffing").lean();
      if (branch?.staffing && category) {
        staffCount = Math.max(1, (branch.staffing as any)[category] || 1);
      }
    }

    // Capacity: 2 customers per active counter staff per 30-min window
    const slotCapacity = staffCount * 2;

    // 2. Query existing active bookings for that date & category
    const matchFilter: any = {
      createdAt: { $gte: targetDate, $lt: nextDay },
      status: { $in: ["waiting", "called", "in_service"] },
    };
    if (bankCode) matchFilter.bankCode = bankCode;
    if (category) matchFilter.assignedCategory = category;

    const bookedAggregation = await ServiceToken.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$timeSlot",
          count: { $sum: 1 },
        },
      },
    ]);

    const bookingMap: Record<string, number> = {};
    bookedAggregation.forEach((b) => {
      if (b._id) bookingMap[b._id] = b.count;
    });

    // 3. Format date label
    const dateFormatted = targetDate.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const slotDateLabel = isToday ? `Today (${dateFormatted})` : `Tomorrow (${dateFormatted})`;

    // 4. Generate all 16 slots with live availability status
    const slots: TimeSlotOption[] = DAILY_SLOT_TEMPLATES.map((tmpl) => {
      const slotString = `${tmpl.from} - ${tmpl.to}`;
      const bookedCount = bookingMap[slotString] || 0;

      let status: "available" | "full" | "past" = "available";
      let available = true;

      // Check if slot has already passed for today
      if (isToday && currentMinutesFromMidnight >= tmpl.startMinutes) {
        status = "past";
        available = false;
      }
      // Check if slot is fully booked
      else if (bookedCount >= slotCapacity) {
        status = "full";
        available = false;
      }

      return {
        slot: slotString,
        from: tmpl.from,
        to: tmpl.to,
        startMinutes: tmpl.startMinutes,
        endMinutes: tmpl.endMinutes,
        available,
        status,
        bookedCount,
        capacity: slotCapacity,
      };
    });

    // Find the first recommended available slot
    const recommendedSlot = slots.find((s) => s.available)?.slot || slots[0]?.slot;

    return NextResponse.json({
      success: true,
      data: {
        dateOption: isToday ? "today" : "tomorrow",
        slotDate: slotDateLabel,
        operatingHours: "09:00 AM - 05:00 PM",
        recommendedSlot,
        slots,
      },
    });
  } catch (error: unknown) {
    console.error("Failed to fetch available time slots:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load time slots",
      },
      { status: 500 }
    );
  }
}
