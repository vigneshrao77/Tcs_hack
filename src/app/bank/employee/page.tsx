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
  slotDate?: string;
  notes?: string;
  createdAt: string;
}

interface QueueStats {
  totalWaiting: number;
  totalServing: number;
  totalCompleted: number;
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
  const [queueStats, setQueueStats] = useState<QueueStats>({
    totalWaiting: 0,
    totalServing: 0,
    totalCompleted: 0,
  });
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"serving" | "waiting" | "completed">("serving");

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
        setQueueStats(
          data.data.stats || { totalWaiting: 0, totalServing: 0, totalCompleted: 0 }
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
  };

  // Update Token Status (Called, In Service, Completed, Cancelled)
  const handleUpdateTokenStatus = async (
    tokenId: string,
    newStatus: "called" | "in_service" | "completed" | "cancelled"
  ) => {
    if (!employee) return;
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
        setActionAlert({
          type: "success",
          text: `Token updated to status: ${newStatus.toUpperCase()}`,
        });
        setTimeout(() => setActionAlert(null), 3000);
        fetchEmployeeQueue();
      } else {
        alert(data.error || "Failed to update token");
      }
    } catch (err) {
      console.error("Token update error:", err);
      alert("Network error updating token status");
    }
  };

  // Call Next Waiting Customer
  const handleCallNextCustomer = async () => {
    if (waitingQueue.length === 0) {
      alert("No customers currently waiting in this department queue.");
      return;
    }
    const nextToken = waitingQueue[0];
    await handleUpdateTokenStatus(nextToken._id, "called");
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
              className="text-xs px-2 py-1 rounded bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 cursor-pointer"
            >
              🔄 Refresh
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
              <CheckIcon size={14} className="shrink-0" />
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

        {/* Counter Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs">
            <span className="text-[11px] text-gray-500 uppercase font-medium">Terminal Status</span>
            <div className="text-sm font-semibold text-gray-900 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{currentServing ? "Serving Customer" : "Counter Open & Ready"}</span>
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{employee.deskName}</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs">
            <span className="text-[11px] text-gray-500 uppercase font-medium">Waiting Customers</span>
            <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
              {queueStats.totalWaiting}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">In {employee.domainName} queue</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs">
            <span className="text-[11px] text-gray-500 uppercase font-medium">Served Today</span>
            <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
              {queueStats.totalCompleted}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">Completed tickets</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs">
            <span className="text-[11px] text-gray-500 uppercase font-medium">Bank Operating Hours</span>
            <div className="text-sm font-semibold font-mono text-gray-900 mt-1">
              09:00 AM – 05:00 PM
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Standard daily service window</div>
          </div>
        </div>

        {/* Main Workstation Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Serving Window (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-gray-900 text-white flex items-center justify-center">
                    <UserIcon size={14} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      {isTelugu ? "ప్రస్తుత సర్వీస్ కస్టమర్" : "Current Customer at Counter"}
                    </h2>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {employee.roleTitle} • {employee.deskName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentServing ? (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        currentServing.status === "in_service"
                          ? "bg-green-50 text-green-800 border border-green-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200 animate-pulse"
                      }`}
                    >
                      {currentServing.status === "in_service" ? "● IN SERVICE" : "📢 CALLED"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                      DESK IDLE
                    </span>
                  )}
                </div>
              </div>

              {/* Active Serving Card */}
              {currentServing ? (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
                    <div>
                      <div className="text-[10px] uppercase font-mono font-semibold text-gray-500">
                        Token Ticket Number
                      </div>
                      <div className="text-2xl font-black font-mono text-gray-900 tracking-tight mt-0.5">
                        {currentServing.tokenNumber}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ClockIcon size={14} className="text-gray-600" />
                      <div className="text-xs">
                        <span className="text-gray-500 text-[10px] block">Scheduled Slot:</span>
                        <strong className="font-mono text-gray-900">
                          {currentServing.timeSlot || "09:00 AM - 09:30 AM"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium">Customer Name</span>
                      <div className="font-semibold text-gray-900 mt-0.5">{currentServing.customerName}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium">Account Number</span>
                      <div className="font-mono text-gray-900 font-semibold mt-0.5">{currentServing.accountNumber}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium">Contact Phone</span>
                      <div className="font-mono text-gray-900 mt-0.5">{currentServing.phone || "N/A"}</div>
                    </div>
                  </div>

                  {currentServing.notes && (
                    <div className="p-3 bg-white border border-gray-200 rounded text-xs">
                      <span className="text-[10px] text-gray-400 uppercase font-medium block">
                        Customer Notes / Inquiry Details:
                      </span>
                      <p className="text-gray-800 mt-0.5 italic">"{currentServing.notes}"</p>
                    </div>
                  )}

                  {/* Actions for active ticket */}
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    {currentServing.status === "called" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateTokenStatus(currentServing._id, "in_service")}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckIcon size={13} />
                        <span>▶️ Start Service</span>
                      </button>
                    )}

                    {currentServing.status === "in_service" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateTokenStatus(currentServing._id, "completed")}
                        className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckIcon size={13} />
                        <span>✓ Complete Service & Mark Done</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleUpdateTokenStatus(currentServing._id, "called")}
                      className="px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <SpeakerIcon size={13} />
                      <span>📢 Re-announce Token</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Skip or cancel this token?")) {
                          handleUpdateTokenStatus(currentServing._id, "cancelled");
                        }
                      }}
                      className="px-3 py-2 bg-white hover:bg-red-50 text-red-700 border border-gray-300 hover:border-red-200 rounded text-xs font-medium transition-colors cursor-pointer"
                    >
                      ✕ Skip / Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center mx-auto">
                    <TicketIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      No Customer Currently at Counter
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {waitingQueue.length > 0
                        ? `${waitingQueue.length} customers are waiting in queue.`
                        : "The queue is currently clear for your counter."}
                    </p>
                  </div>

                  {waitingQueue.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCallNextCustomer}
                      className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                    >
                      <SpeakerIcon size={14} />
                      <span>📢 Call Next Customer (#{waitingQueue[0].tokenNumber})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Queue & History */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs space-y-3">
              {/* Tab Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("waiting")}
                    className={`text-xs font-semibold px-2 py-1 rounded cursor-pointer ${
                      activeTab === "waiting" || activeTab === "serving"
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Waiting ({waitingQueue.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("completed")}
                    className={`text-xs font-semibold px-2 py-1 rounded cursor-pointer ${
                      activeTab === "completed"
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Served Today ({completedToday.length})
                  </button>
                </div>
              </div>

              {/* Waiting List */}
              {(activeTab === "waiting" || activeTab === "serving") && (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {waitingQueue.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400 font-mono">
                      No waiting customers in queue.
                    </div>
                  ) : (
                    waitingQueue.map((item, idx) => (
                      <div
                        key={item._id}
                        className="p-3 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-md transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-gray-400">#{idx + 1}</span>
                            <span className="text-xs font-bold font-mono text-gray-900">
                              {item.tokenNumber}
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-gray-800">
                            {item.customerName}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {item.timeSlot || "09:00 AM - 09:30 AM"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUpdateTokenStatus(item._id, "called")}
                          className="px-2.5 py-1 bg-white hover:bg-gray-900 hover:text-white text-gray-800 border border-gray-300 rounded text-[11px] font-medium transition-colors cursor-pointer shrink-0"
                        >
                          Call Now
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Completed List */}
              {activeTab === "completed" && (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {completedToday.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400 font-mono">
                      No tickets completed yet today.
                    </div>
                  ) : (
                    completedToday.map((item) => (
                      <div
                        key={item._id}
                        className="p-2.5 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold font-mono text-gray-900">{item.tokenNumber}</div>
                          <div className="text-[11px] text-gray-600">{item.customerName}</div>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-green-50 text-green-700 border border-green-200">
                          ✓ Done
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
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
