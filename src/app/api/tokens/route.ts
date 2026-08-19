import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import ServiceToken, {
  BankingServiceType,
  SERVICE_CATEGORY_MAP,
} from "@/models/ServiceToken";
import User from "@/models/User";
import BankBranch from "@/models/BankBranch";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const accountNumber = searchParams.get("accountNumber");
    const bankCode = searchParams.get("bankCode");

    if (!accountNumber) {
      return NextResponse.json(
        { success: false, error: "Account number is required" },
        { status: 400 }
      );
    }

    const cleanAccNumber = accountNumber.trim().toUpperCase();
    const cleanBankCode = bankCode ? bankCode.trim().toUpperCase() : null;

    // Parallel execution for user token & queue statistics
    const [activeToken, queueAggregate] = await Promise.all([
      // 1. Find latest active token with .lean() for minimal memory overhead
      ServiceToken.findOne({
        accountNumber: cleanAccNumber,
        status: { $in: ["waiting", "called", "in_service"] },
      })
        .sort({ createdAt: -1 })
        .lean(),

      // 2. High-performance MongoDB Aggregation pipeline for branch queue stats
      cleanBankCode
        ? ServiceToken.aggregate([
            {
              $match: {
                bankCode: cleanBankCode,
                status: "waiting",
              },
            },
            {
              $group: {
                _id: {
                  category: "$assignedCategory",
                  employeeId: "$assignedEmployeeId",
                },
                count: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    // Build structured stats from indexed aggregation
    const queueStats = {
      totalWaiting: 0,
      byCategory: {} as Record<string, number>,
      byEmployee: {} as Record<string, number>,
    };

    if (queueAggregate && queueAggregate.length > 0) {
      queueAggregate.forEach((item) => {
        const cat = item._id?.category;
        const emp = item._id?.employeeId;
        const count = item.count || 0;

        queueStats.totalWaiting += count;
        if (cat) queueStats.byCategory[cat] = (queueStats.byCategory[cat] || 0) + count;
        if (emp) queueStats.byEmployee[emp] = (queueStats.byEmployee[emp] || 0) + count;
      });
    }

    return NextResponse.json({
      success: true,
      data: activeToken,
      queueStats,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch active token";
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
    const { accountNumber, serviceType, notes } = body;

    if (!accountNumber || !serviceType) {
      return NextResponse.json(
        {
          success: false,
          error: "Account number and service type are required",
        },
        { status: 400 }
      );
    }

    const cleanAccNumber = accountNumber.trim().toUpperCase();

    // 1. Fetch user profile with field selection
    const user = await User.findOne({ accountNumber: cleanAccNumber })
      .select("accountNumber fullName phone bankId bankCode bankName")
      .lean();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User account not found" },
        { status: 404 }
      );
    }

    const meta = SERVICE_CATEGORY_MAP[serviceType as BankingServiceType];
    if (!meta) {
      return NextResponse.json(
        { success: false, error: `Invalid service type "${serviceType}"` },
        { status: 400 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. Scalability: Parallelize all prerequisite DB queries into a single round-trip
    const [existingActive, countToday, waitingAhead, branch] = await Promise.all([
      ServiceToken.findOne({
        accountNumber: cleanAccNumber,
        status: { $in: ["waiting", "called", "in_service"] },
      }).lean(),

      ServiceToken.countDocuments({
        bankCode: user.bankCode,
        assignedCategory: meta.category,
        createdAt: { $gte: today },
      }),

      ServiceToken.countDocuments({
        bankCode: user.bankCode,
        assignedCategory: meta.category,
        status: "waiting",
      }),

      BankBranch.findOne({ bankCode: user.bankCode })
        .select("staffing")
        .lean(),
    ]);

    if (existingActive) {
      return NextResponse.json(
        {
          success: false,
          error: `You already have an active ticket (${existingActive.tokenNumber}) for ${existingActive.serviceType}. Please wait or cancel your current ticket before requesting a new one.`,
          data: existingActive,
        },
        { status: 409 }
      );
    }

    const tokenNumber = `${meta.prefix}-${(countToday + 1)
      .toString()
      .padStart(3, "0")}`;

    // Determine staffing parameters
    let staffCount = 1;
    let domainCode = "CS";
    let roleTitle = "Cash Officer";
    let deskTitle = "Cash Counter";

    if (branch && branch.staffing) {
      const s = branch.staffing;
      switch (meta.category) {
        case "cashCounters":
          staffCount = Math.max(1, s.cashCounters || 1);
          domainCode = "CS";
          roleTitle = "Cash Officer";
          deskTitle = "Cash Counter";
          break;
        case "loanOfficers":
          staffCount = Math.max(1, s.loanOfficers || 1);
          domainCode = "LD";
          roleTitle = "Loan Officer";
          deskTitle = "Loan Desk";
          break;
        case "accountAndKyc":
          staffCount = Math.max(1, s.accountAndKyc || 1);
          domainCode = "KYC";
          roleTitle = "KYC & Account Officer";
          deskTitle = "Account & KYC Desk";
          break;
        case "customerService":
          staffCount = Math.max(1, s.customerService || 1);
          domainCode = "HD";
          roleTitle = "Help Desk Officer";
          deskTitle = "Customer Help Desk";
          break;
        case "managers":
          staffCount = Math.max(1, s.managers || 1);
          domainCode = "BM";
          roleTitle = "Branch Manager";
          deskTitle = "Manager Chamber";
          break;
      }
    }

    // Load-balanced round-robin employee assignment
    const employeeIndex = (countToday % Math.max(1, staffCount)) + 1;
    const assignedEmployeeId = `${user.bankCode}${domainCode}_${employeeIndex}`;
    const assignedEmployeeName = `${roleTitle} #${employeeIndex}`;
    const assignedDesk = `${deskTitle} #${employeeIndex}`;

    const estimatedWaitMinutes = Math.max(
      meta.avgMinutes,
      Math.ceil(((waitingAhead + 1) * meta.avgMinutes) / staffCount)
    );

    // Accommodate user-selected time slot or calculate automatic slot within 09:00 AM - 05:00 PM
    const now = new Date();
    const BANK_START_HOUR = 9;  // 09:00 AM
    const BANK_END_HOUR = 17;   // 05:00 PM (17:00)

    let targetDate = new Date(now);
    let startMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();

    let timeSlotFrom = "";
    let timeSlotTo = "";
    let timeSlot = "";
    let slotDate = "";

    if (body.selectedSlot && typeof body.selectedSlot === "object" && body.selectedSlot.slot) {
      timeSlot = body.selectedSlot.slot.trim();
      timeSlotFrom = body.selectedSlot.from || timeSlot.split(" - ")[0] || "09:00 AM";
      timeSlotTo = body.selectedSlot.to || timeSlot.split(" - ")[1] || "09:30 AM";
      slotDate = body.selectedSlot.slotDate || (body.dateOption === "tomorrow" ? "Tomorrow" : "Today");
    } else {
      if (startMinutesFromMidnight < BANK_START_HOUR * 60) {
        startMinutesFromMidnight = BANK_START_HOUR * 60;
      } else if (startMinutesFromMidnight >= BANK_END_HOUR * 60 - 15) {
        targetDate.setDate(targetDate.getDate() + 1);
        startMinutesFromMidnight = BANK_START_HOUR * 60;
      } else {
        startMinutesFromMidnight += Math.max(5, estimatedWaitMinutes);
        startMinutesFromMidnight = Math.ceil(startMinutesFromMidnight / 5) * 5;
        const slotDuration = Math.max(20, meta.avgMinutes || 20);
        if (startMinutesFromMidnight + slotDuration > BANK_END_HOUR * 60) {
          targetDate.setDate(targetDate.getDate() + 1);
          startMinutesFromMidnight = BANK_START_HOUR * 60;
        }
      }

      const slotDuration = Math.max(20, meta.avgMinutes || 20);
      const endMinutesFromMidnight = Math.min(
        BANK_END_HOUR * 60,
        startMinutesFromMidnight + slotDuration
      );

      const formatSlotTime = (minutes: number): string => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const period = h >= 12 ? "PM" : "AM";
        const displayH = h % 12 === 0 ? 12 : h % 12;
        const displayM = m.toString().padStart(2, "0");
        return `${displayH}:${displayM} ${period}`;
      };

      timeSlotFrom = formatSlotTime(startMinutesFromMidnight);
      timeSlotTo = formatSlotTime(endMinutesFromMidnight);
      timeSlot = `${timeSlotFrom} - ${timeSlotTo}`;

      const isToday = targetDate.toDateString() === now.toDateString();
      const dateFormatted = targetDate.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      slotDate = isToday ? `Today (${dateFormatted})` : `Next Day (${dateFormatted})`;
    }

    const isMandatoryVisit = body.isMandatoryVisit !== undefined ? !!body.isMandatoryVisit : true;

    const newToken = await ServiceToken.create({
      tokenNumber,
      userId: user._id,
      accountNumber: user.accountNumber,
      customerName: user.fullName,
      phone: user.phone,
      bankId: user.bankId,
      bankCode: user.bankCode,
      bankName: user.bankName,
      serviceType: serviceType as BankingServiceType,
      assignedCategory: meta.category,
      categoryLabel: meta.label,
      assignedEmployeeName,
      assignedEmployeeId,
      assignedDesk,
      status: "waiting",
      queuePosition: waitingAhead + 1,
      estimatedWaitMinutes,
      isMandatoryVisit,
      timeSlotFrom,
      timeSlotTo,
      timeSlot,
      slotDate,
      operatingHours: "09:00 AM - 05:00 PM",
      notes: notes?.trim() || "",
    });

    return NextResponse.json(
      {
        success: true,
        message: `Token ${tokenNumber} mapped to ${assignedEmployeeName} (${assignedEmployeeId}) at ${assignedDesk}. Assigned Time Slot: ${timeSlot} (${slotDate}).`,
        data: newToken,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create token";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
