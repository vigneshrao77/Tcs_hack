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

    // Find latest active token for this user
    const activeToken = await ServiceToken.findOne({
      accountNumber: cleanAccNumber,
      status: { $in: ["waiting", "called", "in_service"] },
    }).sort({ createdAt: -1 });

    // Calculate queue statistics for branch
    let queueStats = {
      totalWaiting: 0,
      byCategory: {} as Record<string, number>,
      byEmployee: {} as Record<string, number>,
    };

    if (bankCode) {
      const waitingTokens = await ServiceToken.find({
        bankCode: bankCode.trim().toUpperCase(),
        status: "waiting",
      });

      queueStats.totalWaiting = waitingTokens.length;
      waitingTokens.forEach((t) => {
        queueStats.byCategory[t.assignedCategory] =
          (queueStats.byCategory[t.assignedCategory] || 0) + 1;
        if (t.assignedEmployeeId) {
          queueStats.byEmployee[t.assignedEmployeeId] =
            (queueStats.byEmployee[t.assignedEmployeeId] || 0) + 1;
        }
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

    // Verify user exists
    const user = await User.findOne({ accountNumber: cleanAccNumber });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User account not found" },
        { status: 404 }
      );
    }

    // Check if user already has an active token
    const existingActive = await ServiceToken.findOne({
      accountNumber: cleanAccNumber,
      status: { $in: ["waiting", "called", "in_service"] },
    });

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

    const meta = SERVICE_CATEGORY_MAP[serviceType as BankingServiceType];
    if (!meta) {
      return NextResponse.json(
        { success: false, error: `Invalid service type "${serviceType}"` },
        { status: 400 }
      );
    }

    // Count today's tokens for this service category to create sequential token ID
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const countToday = await ServiceToken.countDocuments({
      bankCode: user.bankCode,
      assignedCategory: meta.category,
      createdAt: { $gte: today },
    });

    const tokenNumber = `${meta.prefix}-${(countToday + 1)
      .toString()
      .padStart(3, "0")}`;

    // Calculate queue position & wait time
    const waitingAhead = await ServiceToken.countDocuments({
      bankCode: user.bankCode,
      assignedCategory: meta.category,
      status: "waiting",
    });

    // Check branch staff created by admin for this bank branch
    let staffCount = 1;
    let employeePrefix = "EMP";
    let roleTitle = "Officer";
    let deskTitle = "Desk";

    const branch = await BankBranch.findOne({ bankCode: user.bankCode });
    if (branch && branch.staffing) {
      const s = branch.staffing;
      switch (meta.category) {
        case "cashCounters":
          staffCount = Math.max(1, s.cashCounters || 1);
          employeePrefix = "CSH";
          roleTitle = "Cashier";
          deskTitle = "Cash Counter";
          break;
        case "loanOfficers":
          staffCount = Math.max(1, s.loanOfficers || 1);
          employeePrefix = "LNO";
          roleTitle = "Loan & Credit Officer";
          deskTitle = "Loan Desk";
          break;
        case "accountAndKyc":
          staffCount = Math.max(1, s.accountAndKyc || 1);
          employeePrefix = "KYC";
          roleTitle = "KYC & Account Specialist";
          deskTitle = "KYC Desk";
          break;
        case "customerService":
          staffCount = Math.max(1, s.customerService || 1);
          employeePrefix = "CSR";
          roleTitle = "Customer Support Executive";
          deskTitle = "Service Desk";
          break;
        case "managers":
          staffCount = Math.max(1, s.managers || 1);
          employeePrefix = "MGR";
          roleTitle = "Branch Manager";
          deskTitle = "Manager Chamber";
          break;
      }
    }

    // Map query to specific employee created by admin using load-balanced round-robin
    const employeeIndex = (countToday % Math.max(1, staffCount)) + 1;
    const assignedEmployeeId = `${employeePrefix}-${employeeIndex
      .toString()
      .padStart(2, "0")}`;
    const assignedEmployeeName = `${roleTitle} #${employeeIndex}`;
    const assignedDesk = `${deskTitle} #${employeeIndex}`;

    const estimatedWaitMinutes = Math.max(
      meta.avgMinutes,
      Math.ceil(((waitingAhead + 1) * meta.avgMinutes) / staffCount)
    );

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
      notes: notes?.trim() || "",
    });

    return NextResponse.json(
      {
        success: true,
        message: `Token ${tokenNumber} mapped to ${assignedEmployeeName} (${assignedEmployeeId}) at ${assignedDesk}`,
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
