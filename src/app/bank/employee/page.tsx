"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MacWindowHeader from "@/components/MacWindowHeader";
import {
  BankIcon,
  UserIcon,
  ClockIcon,
  TicketIcon,
  CheckIcon,
  SpeakerIcon,
  SearchIcon,
} from "@/components/BankIcons";

interface EmployeeProfile {
  employeeId: string;
  bankCode: string;
  bankName: string;
  bankLocation: string;
  domainCode: "BM" | "CS" | "LD" | "HD" | "KYC";
  domainName: string;
  category: string;
  roleTitle: string;
  deskName: string;
  workerIndex: number;
  totalWorkersInDomain: number;
}

interface ServiceToken {
  _id: string;
  tokenNumber: string;
  accountNumber: string;
  customerName: string;
  phone: string;
  bankCode: string;
  bankName: string;
  serviceType: string;
  assignedCategory: string;
  categoryLabel: string;
  assignedEmployeeName: string;
  assignedEmployeeId: string;
  assignedDesk: string;
  status: "waiting" | "called" | "in_service" | "completed" | "cancelled";
  queuePosition: number;
  estimatedWaitMinutes: number;
  timeSlot?: string;
  timeSlotFrom?: string;
  timeSlotTo?: string;
  slotDate?: string;
  operatingHours?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface QueueStats {
  totalWaiting: number;
  totalServing: number;
  totalCompleted: number;
  totalAll: number;
}

interface BankBranchInfo {
  bankName: string;
  bankCode: string;
  staffing: {
    managers: number;
    cashCounters: number;
    loanOfficers: number;
    customerService: number;
    accountAndKyc: number;
  };
}

function EmployeeTerminal() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const isTelugu = language === "te";

  // Auth State
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loginId, setLoginId] = useState<string>("");
  const [passcode, setPasscode] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Available Branches for Helper Chips
  const [branches, setBranches] = useState<BankBranchInfo[]>([]);

  // Queue State
  const [currentServing, setCurrentServing] = useState<ServiceToken | null>(null);
  const [waitingQueue, setWaitingQueue] = useState<ServiceToken[]>([]);
  const [completedToday, setCompletedToday] = useState<ServiceToken[]>([]);
  const [allBookings, setAllBookings] = useState<ServiceToken[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats>({
    totalWaiting: 0,
    totalServing: 0,
    totalCompleted: 0,
    totalAll: 0,
  });
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "waiting" | "serving" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [updatingTokenId, setUpdatingTokenId] = useState<string | null>(null);
  const [aiOptimizationResult, setAiOptimizationResult] = useState<{
    lagDetected: boolean;
    delayMinutes: number;
    decisionType: string;
    summary: string;
    reassignedCount: number;
    reassignedTokens: Array<{
      tokenNumber: string;
      customerName: string;
      action: string;
      targetDesk?: string;
      targetBranch?: string;
      distanceKm?: number;
      reason: string;
    }>;
  } | null>(null);

  // Load stored employee session on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("bank_employee_session");
      if (stored) {
        setEmployee(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Fetch branches for login ID helper chips
  useEffect(() => {
    fetch("/api/banks")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setBranches(data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Queue for Logged-In Employee
  const fetchEmployeeQueue = async () => {
    if (!employee) return;
    try {
      setIsLoadingQueue(true);
      const res = await fetch(
        `/api/employee/queue?bankCode=${encodeURIComponent(employee.bankCode)}&category=${encodeURIComponent(
          employee.category
        )}&employeeId=${encodeURIComponent(employee.employeeId)}`
      );
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setCurrentServing(data.data.currentServing);
        setWaitingQueue(data.data.waitingQueue || []);
        setCompletedToday(data.data.completedToday || []);
        setAllBookings(data.data.allBookings || []);
        setQueueStats(
          data.data.stats || {
            totalWaiting: 0,
            totalServing: 0,
            totalCompleted: 0,
            totalAll: 0,
          }
        );
      }
    } catch (err) {
      console.error("Failed to load queue:", err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    if (employee) {
      fetchEmployeeQueue();
      const interval = setInterval(fetchEmployeeQueue, 4000);
      return () => clearInterval(interval);
    }
  }, [employee]);

  // Handle Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim()) return;

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/employee/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: loginId.trim(),
          passcode: passcode.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.data) {
        setEmployee(data.data);
        sessionStorage.setItem("bank_employee_session", JSON.stringify(data.data));
      } else {
        setLoginError(data.error || "Invalid employee login ID.");
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Failed to sign in.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    sessionStorage.removeItem("bank_employee_session");
    setEmployee(null);
    setCurrentServing(null);
    setWaitingQueue([]);
    setCompletedToday([]);
    setAllBookings([]);
  };

  // Direct One-Click Transition: Update Token Status (Waiting -> Completed, or Called, In Service)
  const handleUpdateTokenStatus = async (
    tokenId: string,
    newStatus: "called" | "in_service" | "completed" | "cancelled" | "waiting",
    tokenNumber?: string
  ) => {
    if (!employee) return;
    setUpdatingTokenId(tokenId);
    try {
      const res = await fetch(`/api/tokens/${tokenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          assignedEmployeeId: employee.employeeId,
          assignedEmployeeName: employee.roleTitle,
          assignedDesk: employee.deskName,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const tokenLabel = tokenNumber || "Token";
        const statusText =
          newStatus === "completed"
            ? "MARKED AS COMPLETED ✓"
            : newStatus === "in_service"
            ? "STARTED SERVICE ▶️"
            : newStatus === "called"
            ? "CALLED TO DESK 📢"
            : newStatus.toUpperCase();

        if (data.aiOptimization) {
          setAiOptimizationResult(data.aiOptimization);
        }

        setActionAlert({
          type: "success",
          text: `${tokenLabel}: Status changed to ${statusText}`,
        });
        setTimeout(() => setActionAlert(null), 4000);
        await fetchEmployeeQueue();
      } else {
        alert(data.error || "Failed to update token");
      }
    } catch (err) {
      console.error("Token update error:", err);
      alert("Network error updating token status");
    } finally {
      setUpdatingTokenId(null);
    }
  };

  // Filtered Bookings based on Search Query and Tab
  const getFilteredBookings = () => {
    let list: ServiceToken[] = [];
    if (activeTab === "all") list = allBookings;
    else if (activeTab === "waiting") list = waitingQueue;
    else if (activeTab === "serving") list = currentServing ? [currentServing] : [];
    else if (activeTab === "completed") list = completedToday;

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.tokenNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.accountNumber.toLowerCase().includes(q) ||
        (item.phone && item.phone.includes(q)) ||
        item.serviceType.toLowerCase().includes(q)
    );
  };

  // Render Login Screen if not authenticated
  if (!employee) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
        {/* Top Header */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-8 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-300 bg-white px-3 py-1.5 rounded-md"
          >
            ← Customer Banking
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-lg">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden">
            <MacWindowHeader
              title={isTelugu ? "బ్యాంక్ ఉద్యోగి లాగిన్" : "Bank Staff Terminal"}
              subtitle="Core Banking Employee Dispatch"
            />

            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
                    {isTelugu ? "బ్యాంక్ ఉద్యోగి కౌంటర్ లాగిన్" : "Bank Staff Counter Sign In"}
                  </h1>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {isTelugu
                    ? "మీ బ్రాంచ్ కోడ్ మరియు డొమైన్ వర్కర్ ఐడీతో లాగిన్ అవ్వండి (ఉదా: SBICS_1, SBIKYC_1)."
                    : "Enter your Employee Login ID in the format: BANKCODE+DOMAIN_INDEX (e.g. SBICS_1, SBIKYC_1)."}
                </p>
              </div>

              {/* Login Format Legend */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs space-y-1.5">
                <div className="text-[11px] font-semibold text-gray-800 uppercase font-mono">
                  Login ID Structure: BANKCODE + DOMAIN + _ + (1 to N)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px] text-gray-600 font-mono">
                  <div><strong className="text-gray-900">BM</strong>: Branch Manager</div>
                  <div><strong className="text-gray-900">CS</strong>: Cash Counter</div>
                  <div><strong className="text-gray-900">LD</strong>: Loan Desk</div>
                  <div><strong className="text-gray-900">HD</strong>: Customer Help Desk</div>
                  <div><strong className="text-gray-900">KYC</strong>: Account & KYC</div>
                </div>
              </div>

              {/* Error Message */}
              {loginError && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between">
                  <span>{loginError}</span>
                  <button
                    type="button"
                    onClick={() => setLoginError(null)}
                    className="text-red-600 font-bold ml-2 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Employee Login ID <span className="text-gray-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SBICS_1, SBIKYC_1, SBILD_1, SBIHD_1"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 rounded-md bg-white border border-gray-300 text-gray-900 font-mono text-xs uppercase placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Format: [BANKCODE][BM/CS/LD/HD/KYC]_[1 to N]
                  </p>
                </div>

                {/* Quick Helper Chips from Branches */}
                {branches.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-gray-500 uppercase font-mono font-medium block">
                      Quick Click to Fill Demo IDs:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {branches.map((b) => {
                        const code = b.bankCode;
                        const samples = [
                          `${code}CS_1`,
                          `${code}KYC_1`,
                          `${code}LD_1`,
                          `${code}HD_1`,
                          `${code}BM_1`,
                        ];
                        return samples.map((sid) => (
                          <button
                            key={sid}
                            type="button"
                            onClick={() => setLoginId(sid)}
                            className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-mono text-[10px] border border-gray-300 cursor-pointer"
                          >
                            {sid}
                          </button>
                        ));
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Passcode / PIN (Optional for Demo)
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-md bg-white border border-gray-300 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-2.5 px-4 rounded-md bg-gray-900 hover:bg-black text-white font-medium text-xs shadow-xs transition-colors duration-100 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoggingIn
                    ? "Authenticating Staff..."
                    : isTelugu
                    ? "కౌంటర్ టెర్మినల్‌లోకి ప్రవేశించండి"
                    : "Sign In to Counter Terminal"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredBookings = getFilteredBookings();

  // Logged-In Active Counter Terminal
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] font-sans pb-16">
      {/* Top Staff Navigation Bar */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-gray-900 text-white flex items-center justify-center font-bold text-xs">
              <BankIcon size={14} />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">
                {employee.bankName}
              </span>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                {employee.bankCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Officer Badge */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-gray-100 border border-gray-200 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-mono font-bold text-gray-900">{employee.employeeId}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-700 font-medium">{employee.roleTitle}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500 font-mono">{employee.deskName}</span>
            </div>

            <button
              type="button"
              onClick={fetchEmployeeQueue}
              className="text-xs px-2.5 py-1 rounded bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 cursor-pointer flex items-center gap-1"
            >
              <span>🔄</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <LanguageSwitcher />

            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-medium px-2.5 py-1 rounded bg-white text-gray-700 border border-gray-300 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer"
            >
              {t("sign_out")}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Notice Alert */}
        {actionAlert && (
          <div
            className={`p-3.5 rounded-md text-xs font-medium flex items-center justify-between border ${
              actionAlert.type === "success"
                ? "bg-green-50 text-green-900 border-green-200"
                : "bg-red-50 text-red-900 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckIcon size={14} className="shrink-0 text-green-700" />
              <span>{actionAlert.text}</span>
            </div>
            <button
              onClick={() => setActionAlert(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* AI Smart Queue Lag Optimizer Real-Time Report Banner */}
        {aiOptimizationResult && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-950 space-y-2 shadow-xs">
            <div className="flex items-center justify-between border-b border-blue-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🤖</span>
                <strong className="font-semibold text-blue-900 text-xs">
                  AI Smart Load Balancer & Lag Dispatch Engine
                </strong>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                    aiOptimizationResult.lagDetected
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : "bg-green-100 text-green-900 border border-green-300"
                  }`}
                >
                  {aiOptimizationResult.lagDetected
                    ? `⚠️ Lag Detected (${aiOptimizationResult.delayMinutes}m delay)`
                    : "✓ On Schedule"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setAiOptimizationResult(null)}
                className="text-blue-600 hover:text-blue-900 font-bold cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-blue-900 leading-relaxed font-medium">
              {aiOptimizationResult.summary}
            </p>

            {aiOptimizationResult.reassignedTokens && aiOptimizationResult.reassignedTokens.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] uppercase font-mono font-semibold text-blue-700 block">
                  AI Action Breakdown ({aiOptimizationResult.reassignedTokens.length} tokens):
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {aiOptimizationResult.reassignedTokens.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white rounded border border-blue-200 text-[11px] space-y-0.5"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <strong className="text-gray-900">{item.tokenNumber}</strong>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 text-blue-800 font-bold uppercase">
                          {item.action === "reassign_desk"
                            ? `➡️ Reassigned: ${item.targetDesk}`
                            : item.action === "reroute_branch"
                            ? `📍 Reroute: ${item.targetBranch} (${item.distanceKm} km)`
                            : "⏱️ Rescheduled"}
                        </span>
                      </div>
                      <div className="text-gray-700 text-[10px]">{item.customerName}</div>
                      <div className="text-[10px] text-gray-500 italic">{item.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Counter Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs">
            <span className="text-[11px] text-gray-500 uppercase font-medium">Counter Desk</span>
            <div className="text-sm font-semibold text-gray-900 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{employee.deskName}</span>
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{employee.domainName}</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs">
            <span className="text-[11px] text-gray-500 uppercase font-medium">Waiting to be Served</span>
            <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
              {queueStats.totalWaiting}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">Customers in line</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs">
            <span className="text-[11px] text-gray-500 uppercase font-medium">Completed Today</span>
            <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
              {queueStats.totalCompleted}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">Finished services</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs">
            <span className="text-[11px] text-gray-500 uppercase font-medium">Total Online Bookings</span>
            <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
              {queueStats.totalAll}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">All tickets in this category</div>
          </div>
        </div>

        {/* Main Booked Customers Table & Status Transition Center */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900 tracking-tight">
                  {isTelugu ? "ఆన్‌లైన్ టోకెన్ బుకింగ్స్ & కస్టమర్ల జాబితా" : "Online Token Bookings & Assigned Customers"}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-700 border border-gray-200 font-medium">
                  {employee.domainName}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isTelugu
                  ? "మీ కౌంటర్‌కు కేటాయించిన కస్టమర్ల వివరాలను చూడండి మరియు స్టేటస్‌ను Waiting నుండి Completed గా మార్చండి."
                  : "View customers who booked online tokens for your desk and manage their queue status directly."}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search name, account, token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900 transition-colors"
              />
              <div className="absolute left-2.5 top-2 text-gray-400">
                <SearchIcon size={13} />
              </div>
            </div>
          </div>

          {/* Tab Filter Controls */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-gray-100">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === "all"
                  ? "bg-gray-900 text-white shadow-2xs font-semibold"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200"
              }`}
            >
              All Bookings ({queueStats.totalAll})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("waiting")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === "waiting"
                  ? "bg-gray-900 text-white shadow-2xs font-semibold"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200"
              }`}
            >
              Waiting Customers ({queueStats.totalWaiting})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("serving")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === "serving"
                  ? "bg-gray-900 text-white shadow-2xs font-semibold"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200"
              }`}
            >
              Currently Serving ({queueStats.totalServing})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === "completed"
                  ? "bg-gray-900 text-white shadow-2xs font-semibold"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200"
              }`}
            >
              Completed Today ({queueStats.totalCompleted})
            </button>
          </div>

          {/* List of Booked Tokens with Direct Status Actions */}
          {filteredBookings.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 font-mono bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
              No online booked customers found in this view.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((token, idx) => {
                const isUpdating = updatingTokenId === token._id;
                const isWaiting = token.status === "waiting";
                const isCalled = token.status === "called";
                const isInService = token.status === "in_service";
                const isCompleted = token.status === "completed";

                return (
                  <div
                    key={token._id}
                    className={`p-4 rounded-lg border transition-all ${
                      isInService
                        ? "bg-green-50/70 border-green-300 ring-1 ring-green-300"
                        : isCalled
                        ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-300"
                        : isCompleted
                        ? "bg-gray-50 border-gray-200 opacity-80"
                        : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      {/* Left: Customer & Token Information */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black font-mono px-2 py-0.5 rounded bg-gray-900 text-white">
                            {token.tokenNumber}
                          </span>

                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                              isCompleted
                                ? "bg-gray-200 text-gray-700 border border-gray-300"
                                : isInService
                                ? "bg-green-600 text-white animate-pulse"
                                : isCalled
                                ? "bg-amber-500 text-white animate-bounce"
                                : "bg-blue-50 text-blue-800 border border-blue-200"
                            }`}
                          >
                            {token.status}
                          </span>

                          <span className="text-xs font-semibold text-gray-900">
                            {token.customerName}
                          </span>

                          <span className="text-xs font-mono text-gray-500">
                            ({token.accountNumber})
                          </span>

                          {token.phone && (
                            <span className="text-[11px] font-mono text-gray-600 bg-gray-100 px-1.5 py-0.2 rounded border border-gray-200">
                              📞 {token.phone}
                            </span>
                          )}
                        </div>

                        {/* Service & Time Slot Details */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                          <div>
                            <span className="text-gray-400">Service:</span>{" "}
                            <strong className="text-gray-900 font-medium">{token.serviceType}</strong>
                          </div>

                          <div className="flex items-center gap-1 font-mono">
                            <ClockIcon size={12} className="text-gray-500" />
                            <span>
                              Slot: <strong className="text-gray-900">{token.timeSlot || "09:00 AM - 09:30 AM"}</strong> ({token.slotDate || "Today"})
                            </span>
                          </div>

                          {token.assignedDesk && (
                            <div className="text-[11px] font-mono text-gray-500">
                              Desk: {token.assignedDesk}
                            </div>
                          )}
                        </div>

                        {/* Customer Notes */}
                        {token.notes && (
                          <div className="text-[11px] text-gray-700 bg-white/80 border border-gray-200 rounded p-2 italic">
                            "{token.notes}"
                          </div>
                        )}
                      </div>

                      {/* Right: Direct Action Buttons (Waiting to Completed) */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0">
                        {/* Direct One-Click Button: Mark as Completed */}
                        {!isCompleted && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleUpdateTokenStatus(token._id, "completed", token.tokenNumber)
                            }
                            className="px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <CheckIcon size={13} />
                            <span>
                              {isUpdating
                                ? "Updating..."
                                : isTelugu
                                ? "✓ సేవ పూర్తయింది (Complete)"
                                : "✓ Complete Service"}
                            </span>
                          </button>
                        )}

                        {/* Stage Action: Call Customer */}
                        {isWaiting && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleUpdateTokenStatus(token._id, "called", token.tokenNumber)
                            }
                            className="px-3 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            <SpeakerIcon size={12} />
                            <span>📢 Call Customer</span>
                          </button>
                        )}

                        {/* Stage Action: Start Service */}
                        {(isWaiting || isCalled) && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleUpdateTokenStatus(token._id, "in_service", token.tokenNumber)
                            }
                            className="px-3 py-2 rounded-md bg-gray-900 hover:bg-black text-white font-medium text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            <span>▶️ Start Service</span>
                          </button>
                        )}

                        {/* Completed Reopen */}
                        {isCompleted && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                              ✓ Completed
                            </span>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                handleUpdateTokenStatus(token._id, "waiting", token.tokenNumber)
                              }
                              className="text-[10px] text-gray-500 hover:text-gray-900 underline cursor-pointer"
                            >
                              Reopen
                            </button>
                          </div>
                        )}

                        {/* Cancel / Skip */}
                        {!isCompleted && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => {
                              if (confirm(`Cancel token ${token.tokenNumber}?`)) {
                                handleUpdateTokenStatus(token._id, "cancelled", token.tokenNumber);
                              }
                            }}
                            className="px-2.5 py-2 rounded-md bg-white hover:bg-red-50 text-gray-600 hover:text-red-700 border border-gray-300 hover:border-red-200 text-xs font-medium transition-colors cursor-pointer"
                          >
                            ✕ Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function EmployeePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-gray-500 text-xs font-mono">
          Loading bank staff terminal...
        </div>
      }
    >
      <EmployeeTerminal />
    </Suspense>
  );
}
