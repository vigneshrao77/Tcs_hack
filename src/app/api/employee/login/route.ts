import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import BankBranch from "@/models/BankBranch";
import { CounterCategory } from "@/models/ServiceToken";

// Domain code mappings
export const DOMAIN_MAP: Record<
  string,
  {
    category: CounterCategory;
    domainName: string;
    roleTitle: string;
    deskPrefix: string;
    staffField: keyof typeof STAFF_FIELD_MAP;
  }
> = {
  BM: {
    category: "managers",
    domainName: "Branch Management",
    roleTitle: "Branch Manager",
    deskPrefix: "Manager Chamber",
    staffField: "managers",
  },
  CS: {
    category: "cashCounters",
    domainName: "Cash Service",
    roleTitle: "Cash Officer",
    deskPrefix: "Cash Counter",
    staffField: "cashCounters",
  },
  LD: {
    category: "loanOfficers",
    domainName: "Loan Desk",
    roleTitle: "Loan Officer",
    deskPrefix: "Loan Desk",
    staffField: "loanOfficers",
  },
  HD: {
    category: "customerService",
    domainName: "Help Desk",
    roleTitle: "Customer Help Officer",
    deskPrefix: "Help Desk",
    staffField: "customerService",
  },
  KYC: {
    category: "accountAndKyc",
    domainName: "Account & KYC",
    roleTitle: "KYC & Accounts Officer",
    deskPrefix: "Account & KYC Desk",
    staffField: "accountAndKyc",
  },
};

const STAFF_FIELD_MAP = {
  managers: "managers",
  cashCounters: "cashCounters",
  loanOfficers: "loanOfficers",
  customerService: "customerService",
  accountAndKyc: "accountAndKyc",
};

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { loginId, passcode } = body;

    if (!loginId || typeof loginId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Employee Login ID is required. Format: BANKCODE+BM/CS/LD/HD/KYC_1 to N (e.g. SBICS_1)",
        },
        { status: 400 }
      );
    }

    const cleanInput = loginId.trim().toUpperCase().replace(/\s+/g, "");

    // Regex pattern supporting:
    // 1. BANKCODE+DOMAIN_INDEX (e.g. SBICS_1, SBI_KYC_2, SBI-LD-1)
    // 2. BANKCODE+DOMAIN+INDEX (e.g. SBICS1, SBIKYC2)
    const match = cleanInput.match(/^([A-Z0-9]+?)[-_]?(BM|CS|LD|HD|KYC)[-_]?(\d+)$/i);

    if (!match) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid Login ID format "${cleanInput}". Format must be BANKCODE + DOMAIN + _ + INDEX (e.g. SBICS_1, SBIKYC_1, SBILD_1, SBIHD_1, SBIBM_1). Valid domains: BM (Manager), CS (Cash), LD (Loan), HD (Help Desk), KYC (Account & KYC).`,
        },
        { status: 400 }
      );
    }

    const parsedBankCode = match[1].toUpperCase();
    const parsedDomain = match[2].toUpperCase();
    const parsedWorkerIndex = parseInt(match[3], 10);

    if (parsedWorkerIndex < 1) {
      return NextResponse.json(
        { success: false, error: "Worker index must be 1 or greater (e.g. _1, _2)." },
        { status: 400 }
      );
    }

    // 1. Find Bank Branch by bankCode (case-insensitive)
    const branch = await BankBranch.findOne({
      bankCode: { $regex: new RegExp(`^${parsedBankCode}$`, "i") },
    }).lean();

    if (!branch) {
      return NextResponse.json(
        {
          success: false,
          error: `Bank Branch with code "${parsedBankCode}" not found in system. Please verify branch code.`,
        },
        { status: 404 }
      );
    }

    const domainConfig = DOMAIN_MAP[parsedDomain];
    if (!domainConfig) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown domain code "${parsedDomain}". Use BM, CS, LD, HD, or KYC.`,
        },
        { status: 400 }
      );
    }

    // 2. Validate Worker Index against total deployed staff (1 to N)
    const staffCount = branch.staffing
      ? (branch.staffing as any)[domainConfig.staffField] || 0
      : 0;

    if (staffCount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Branch "${branch.bankName}" (${branch.bankCode}) has 0 staff assigned to ${domainConfig.domainName}. Please contact branch administrator.`,
        },
        { status: 400 }
      );
    }

    if (parsedWorkerIndex > staffCount) {
      return NextResponse.json(
        {
          success: false,
          error: `Worker index _${parsedWorkerIndex} exceeds total staff limit (N = ${staffCount}) for ${domainConfig.domainName} at branch "${branch.bankCode}". Valid IDs: ${branch.bankCode}${parsedDomain}_1 to ${branch.bankCode}${parsedDomain}_${staffCount}.`,
        },
        { status: 400 }
      );
    }

    // Standardized Employee ID
    const standardEmployeeId = `${branch.bankCode}${parsedDomain}_${parsedWorkerIndex}`;
    const deskName = `${domainConfig.deskPrefix} #${parsedWorkerIndex}`;
    const roleTitle = `${domainConfig.roleTitle} #${parsedWorkerIndex}`;

    return NextResponse.json({
      success: true,
      message: `Welcome ${roleTitle}! Logged into ${branch.bankName} ${deskName}.`,
      data: {
        employeeId: standardEmployeeId,
        bankCode: branch.bankCode,
        bankName: branch.bankName,
        bankLocation: branch.bankLocation,
        domainCode: parsedDomain,
        domainName: domainConfig.domainName,
        category: domainConfig.category,
        roleTitle,
        deskName,
        workerIndex: parsedWorkerIndex,
        totalWorkersInDomain: staffCount,
      },
    });
  } catch (error: unknown) {
    console.error("Employee login error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process employee login",
      },
      { status: 500 }
    );
  }
}
