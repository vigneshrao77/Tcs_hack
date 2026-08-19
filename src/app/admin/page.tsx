"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SelectedLocation } from "@/components/LocationPicker";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MacWindowHeader from "@/components/MacWindowHeader";
import {
  BankIcon,
  LockIcon,
  SearchIcon,
} from "@/components/BankIcons";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-64 rounded-md bg-gray-50 border border-gray-200 flex flex-col items-center justify-center text-gray-500 font-mono text-xs">
      Loading geocoding engine...
    </div>
  ),
});

interface Staffing {
  managers: number;
  cashCounters: number;
  loanOfficers: number;
  customerService: number;
  accountAndKyc: number;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface BankBranch {
  _id: string;
  bankName: string;
  bankLocation: string;
  bankPhone: string;
  bankCode: string;
  coordinates?: Coordinates;
  staffing: Staffing;
  totalStaff?: number;
  status: "active" | "maintenance" | "closed";
  createdAt: string;
}

const ADMIN_SECRET_CODE = "123456789";

export default function AdminPage() {
  const { t } = useLanguage();

  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [secretInput, setSecretInput] = useState<string>("");
  const [secretError, setSecretError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  const [branches, setBranches] = useState<BankBranch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  const [bankName, setBankName] = useState<string>("");
  const [bankLocation, setBankLocation] = useState<string>("");
  const [coordinates, setCoordinates] = useState<Coordinates | undefined>(undefined);
  const [bankPhone, setBankPhone] = useState<string>("");
  const [bankCode, setBankCode] = useState<string>("");
  const [staffing, setStaffing] = useState<Staffing>({
    managers: 1,
    cashCounters: 2,
    loanOfficers: 2,
    customerService: 2,
    accountAndKyc: 2,
  });
  const [formStatus, setFormStatus] = useState<"active" | "maintenance" | "closed">("active");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_secret_auth");
    if (stored === ADMIN_SECRET_CODE) {
      setIsAdminUnlocked(true);
    }
    setIsCheckingAuth(false);
  }, []);

  const handleUnlockAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (secretInput.trim() === ADMIN_SECRET_CODE) {
      sessionStorage.setItem("admin_secret_auth", ADMIN_SECRET_CODE);
      setIsAdminUnlocked(true);
      setSecretError(null);
      setSecretInput("");
    } else {
      setSecretError("Invalid Authorization Code. Access Denied.");
    }
  };

  const handleLockAdmin = () => {
    sessionStorage.removeItem("admin_secret_auth");
    setIsAdminUnlocked(false);
    setShowForm(false);
  };

  const fetchBranches = async (query = "") => {
    try {
      setIsLoading(true);
      const url = query ? `/api/banks?search=${encodeURIComponent(query)}` : "/api/banks";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setBranches(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch bank branches:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchBranches();
    }
  }, [isAdminUnlocked]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBranches(searchQuery);
  };

  const handleStaffChange = (category: keyof Staffing, delta: number) => {
    setStaffing((prev) => {
      const current = prev[category];
      const minVal = category === "managers" ? 1 : 0;
      const nextVal = Math.max(minVal, current + delta);
      return { ...prev, [category]: nextVal };
    });
  };

  const handleLocationPicked = (loc: SelectedLocation) => {
    setBankLocation(loc.address);
    setCoordinates({
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
  };

  const resetForm = () => {
    setBankName("");
    setBankLocation("");
    setCoordinates(undefined);
    setBankPhone("");
    setBankCode("");
    setStaffing({
      managers: 1,
      cashCounters: 2,
      loanOfficers: 2,
      customerService: 2,
      accountAndKyc: 2,
    });
    setFormStatus("active");
    setEditingBranchId(null);
    setAlertMessage(null);
  };

  const openEditModal = (branch: BankBranch) => {
    setEditingBranchId(branch._id);
    setBankName(branch.bankName);
    setBankLocation(branch.bankLocation);
    setCoordinates(branch.coordinates);
    setBankPhone(branch.bankPhone);
    setBankCode(branch.bankCode);
    setStaffing({
      managers: branch.staffing?.managers ?? 1,
      cashCounters: branch.staffing?.cashCounters ?? 0,
      loanOfficers: branch.staffing?.loanOfficers ?? 0,
      customerService: branch.staffing?.customerService ?? 0,
      accountAndKyc: branch.staffing?.accountAndKyc ?? 0,
    });
    setFormStatus(branch.status || "active");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAlertMessage(null);

    const payload = {
      bankName,
      bankLocation,
      coordinates,
      bankPhone,
      bankCode: bankCode.toUpperCase(),
      staffing,
      status: formStatus,
      secretCode: ADMIN_SECRET_CODE,
    };

    try {
      const endpoint = editingBranchId ? `/api/banks/${editingBranchId}` : "/api/banks";
      const method = editingBranchId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": ADMIN_SECRET_CODE,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAlertMessage({
          type: "success",
          text: editingBranchId
            ? `Branch "${bankName}" record updated successfully.`
            : `Branch "${bankName}" (${bankCode.toUpperCase()}) registered successfully.`,
        });
        resetForm();
        setShowForm(false);
        fetchBranches();
      } else {
        setAlertMessage({
          type: "error",
          text: data.error || "Failed to process branch record",
        });
      }
    } catch (err: unknown) {
      setAlertMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Network error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string, code: string) => {
    if (!confirm(`Are you sure you want to delete branch "${name}" (${code})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/banks/${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-secret": ADMIN_SECRET_CODE,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchBranches(searchQuery);
      } else {
        alert(data.error || "Failed to delete branch");
      }
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete branch due to network communication error");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-gray-500 font-mono text-xs">
        Authenticating administrative session...
      </div>
    );
  }

  // Passcode authorization screen
  if (!isAdminUnlocked) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] text-[#111827] font-sans flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
          <LanguageSwitcher />
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden">
            <MacWindowHeader
              title={t("security_auth")}
              subtitle={t("admin_portal")}
            />

            <div className="p-6 sm:p-7 space-y-5">
              <div>
                <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
                  {t("restricted_ops_console")}
                </h1>
                <p className="text-xs text-gray-500 mt-1">
                  {t("admin_passcode_req")}
                </p>
              </div>

              {secretError && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between">
                  <span>{secretError}</span>
                  <button
                    type="button"
                    onClick={() => setSecretError(null)}
                    className="text-red-600 hover:text-red-900 font-bold ml-2 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={handleUnlockAdmin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t("security_passcode")}
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"}
                      required
                      autoFocus
                      placeholder={t("enter_passcode")}
                      value={secretInput}
                      onChange={(e) => setSecretInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 font-mono text-xs tracking-widest placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-2 text-xs text-gray-500 hover:text-gray-900 cursor-pointer font-medium"
                    >
                      {showSecret ? t("hide") : t("show")}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-md bg-gray-900 hover:bg-black text-white font-medium text-xs shadow-xs transition-colors duration-100 cursor-pointer"
                >
                  {t("authenticate_console")}
                </button>
              </form>

              <div className="pt-3 border-t border-gray-100 text-center">
                <Link
                  href="/dashboard"
                  className="text-xs text-gray-500 hover:text-gray-900 transition-colors text-[11px]"
                >
                  {t("return_to_customer")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Metrics
  const totalBranchesCount = branches.length;
  const totalStaffCount = branches.reduce((acc, b) => {
    const s = b.staffing;
    return (
      acc +
      (s?.managers || 0) +
      (s?.cashCounters || 0) +
      (s?.loanOfficers || 0) +
      (s?.customerService || 0) +
      (s?.accountAndKyc || 0)
    );
  }, 0);

  const totalCashCounters = branches.reduce(
    (acc, b) => acc + (b.staffing?.cashCounters || 0),
    0
  );
  const totalKycStaff = branches.reduce(
    (acc, b) => acc + (b.staffing?.accountAndKyc || 0),
    0
  );

  const formTotalStaff =
    (staffing.managers || 0) +
    (staffing.cashCounters || 0) +
    (staffing.loanOfficers || 0) +
    (staffing.customerService || 0) +
    (staffing.accountAndKyc || 0);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] font-sans pb-16">
      {/* Top App Bar */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-900 text-sm tracking-tight">
              {t("admin_portal")}
            </span>
            <span className="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-mono">
              Branch Management Console
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />

            <button
              type="button"
              onClick={() => {
                if (showForm && !editingBranchId) {
                  setShowForm(false);
                } else {
                  resetForm();
                  setShowForm(true);
                }
              }}
              className="px-3 py-1.5 rounded-md bg-gray-900 hover:bg-black text-white font-medium text-xs transition-colors duration-100 shadow-xs cursor-pointer"
            >
              {showForm ? t("close_form_btn") : t("register_branch_btn")}
            </button>

            <button
              type="button"
              onClick={handleLockAdmin}
              className="px-2.5 py-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 font-medium text-xs border border-gray-300 transition-colors cursor-pointer"
            >
              {t("lock_console")}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Notice Banner */}
        {alertMessage && (
          <div
            className={`p-3.5 rounded-md text-xs font-medium flex items-center justify-between border ${
              alertMessage.type === "success"
                ? "bg-green-50 text-green-900 border-green-200"
                : "bg-red-50 text-red-900 border-red-200"
            }`}
          >
            <span>{alertMessage.text}</span>
            <button
              type="button"
              onClick={() => setAlertMessage(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Operational Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-xs">
            <div className="text-gray-500 text-[11px] font-medium">{t("total_branches_stat")}</div>
            <div className="text-2xl font-bold font-mono text-gray-900 mt-1">{totalBranchesCount}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{t("active_branches_label")}</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-xs">
            <div className="text-gray-500 text-[11px] font-medium">{t("staff_on_duty_stat")}</div>
            <div className="text-2xl font-bold font-mono text-gray-900 mt-1">{totalStaffCount}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{t("staff_breakdown")}</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-xs">
            <div className="text-gray-500 text-[11px] font-medium">{t("cash_counters_stat")}</div>
            <div className="text-2xl font-bold font-mono text-gray-900 mt-1">{totalCashCounters}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{t("cash_label")}</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-xs">
            <div className="text-gray-500 text-[11px] font-medium">{t("kyc_officers_stat")}</div>
            <div className="text-2xl font-bold font-mono text-gray-900 mt-1">{totalKycStaff}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{t("kyc_label")}</div>
          </div>
        </div>

        {/* Branch Registration / Edit Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {editingBranchId
                    ? `${t("edit_branch_title")}: ${bankName}`
                    : t("reg_branch_title")}
                </h2>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 px-2.5 py-1 rounded border border-gray-200 text-xs">
                <span className="text-gray-500 text-[11px]">{t("assigned_staff")}</span>
                <span className="font-semibold text-gray-900 font-mono text-xs">
                  {formTotalStaff} {t("employees_count")}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Section 1: Basic Information */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                  1. {t("branch_name")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t("branch_name")} <span className="text-gray-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Downtown Central Branch"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t("bank_code_unique")} <span className="text-gray-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SBI-0102"
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 font-mono text-xs uppercase placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t("branch_phone")} <span className="text-gray-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={bankPhone}
                      onChange={(e) => setBankPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Location & Coordinates */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                  2. {t("location_selection")}
                </h3>
                <LocationPicker
                  initialLocation={bankLocation}
                  initialCoordinates={coordinates}
                  onLocationChange={handleLocationPicked}
                />
              </div>

              {/* Section 3: Staff Category Allocation */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                  3. {t("emp_by_dept")}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {/* Category: Managers */}
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>Manager</span>
                        <span className="font-mono">Min 1</span>
                      </div>
                      <h4 className="text-xs font-semibold text-gray-900 mt-1">{t("mgr_label")}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2 bg-white rounded p-1 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("managers", -1)}
                        disabled={staffing.managers <= 1}
                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-gray-900 text-xs font-mono">
                        {staffing.managers}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("managers", 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category: Cash Counters */}
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] text-gray-500">Cash</div>
                      <h4 className="text-xs font-semibold text-gray-900 mt-1">{t("cash_label")}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2 bg-white rounded p-1 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("cashCounters", -1)}
                        disabled={staffing.cashCounters <= 0}
                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-gray-900 text-xs font-mono">
                        {staffing.cashCounters}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("cashCounters", 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category: Loan Officers */}
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] text-gray-500">Loans</div>
                      <h4 className="text-xs font-semibold text-gray-900 mt-1">{t("loan_label")}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2 bg-white rounded p-1 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("loanOfficers", -1)}
                        disabled={staffing.loanOfficers <= 0}
                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-gray-900 text-xs font-mono">
                        {staffing.loanOfficers}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("loanOfficers", 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category: Customer Service */}
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] text-gray-500">Service</div>
                      <h4 className="text-xs font-semibold text-gray-900 mt-1">{t("service_label")}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2 bg-white rounded p-1 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("customerService", -1)}
                        disabled={staffing.customerService <= 0}
                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-gray-900 text-xs font-mono">
                        {staffing.customerService}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("customerService", 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category: Account & KYC */}
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] text-gray-500">KYC & Accts</div>
                      <h4 className="text-xs font-semibold text-gray-900 mt-1">{t("kyc_label")}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2 bg-white rounded p-1 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("accountAndKyc", -1)}
                        disabled={staffing.accountAndKyc <= 0}
                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-gray-900 text-xs font-mono">
                        {staffing.accountAndKyc}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("accountAndKyc", 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & Submit */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-700">Status:</label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as "active" | "maintenance" | "closed")
                    }
                    className="px-2.5 py-1 rounded bg-white border border-gray-300 text-xs text-gray-900 cursor-pointer"
                  >
                    <option value="active">Active Operational</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setShowForm(false);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded text-xs font-medium cursor-pointer"
                  >
                    {t("cancel")}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white rounded text-xs font-medium shadow-xs transition-colors duration-100 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting
                      ? t("loading")
                      : editingBranchId
                      ? t("save_changes_btn")
                      : t("create_branch_btn")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Registered Branches List */}
        <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {t("registered_branches_title")}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {t("registered_branches_desc")}
              </p>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder={t("search_placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 rounded-md bg-white border border-gray-300 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 w-48 sm:w-60"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-medium rounded-md cursor-pointer transition-colors shadow-xs"
              >
                {t("search_btn")}
              </button>
            </form>
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-xs text-gray-500 font-mono">
              Loading active branch records...
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-500 font-mono">
              No branch records found. Register a branch to begin operations.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {branches.map((branch) => {
                const s = branch.staffing || {
                  managers: 1,
                  cashCounters: 0,
                  loanOfficers: 0,
                  customerService: 0,
                  accountAndKyc: 0,
                };
                const total =
                  (s.managers || 0) +
                  (s.cashCounters || 0) +
                  (s.loanOfficers || 0) +
                  (s.customerService || 0) +
                  (s.accountAndKyc || 0);

                return (
                  <div
                    key={branch._id}
                    className="border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-400 transition-colors duration-100 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-gray-900">{branch.bankName}</h3>
                          <span className="font-mono text-xs px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 border border-gray-200">
                            {branch.bankCode}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded ${
                            branch.status === "active"
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {branch.status}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{branch.bankLocation}</p>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">Phone: {branch.bankPhone}</div>
                    </div>

                    {/* Active Employee Counter Roster */}
                    <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        <span>Active Counter Roster</span>
                        <span className="font-mono text-gray-900 font-semibold">{total} Officers</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px] font-mono">
                        <div className="bg-white p-1 rounded border border-gray-200 text-center">
                          <div className="text-gray-400 text-[9px]">MGR</div>
                          <div className="font-semibold text-gray-900">{s.managers || 0}</div>
                        </div>
                        <div className="bg-white p-1 rounded border border-gray-200 text-center">
                          <div className="text-gray-400 text-[9px]">CSH</div>
                          <div className="font-semibold text-gray-900">{s.cashCounters || 0}</div>
                        </div>
                        <div className="bg-white p-1 rounded border border-gray-200 text-center">
                          <div className="text-gray-400 text-[9px]">LNO</div>
                          <div className="font-semibold text-gray-900">{s.loanOfficers || 0}</div>
                        </div>
                        <div className="bg-white p-1 rounded border border-gray-200 text-center">
                          <div className="text-gray-400 text-[9px]">CSR</div>
                          <div className="font-semibold text-gray-900">{s.customerService || 0}</div>
                        </div>
                        <div className="bg-white p-1 rounded border border-gray-200 text-center">
                          <div className="text-gray-400 text-[9px]">KYC</div>
                          <div className="font-semibold text-gray-900">{s.accountAndKyc || 0}</div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openEditModal(branch)}
                        className="px-2.5 py-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded text-xs font-medium transition-colors cursor-pointer"
                      >
                        {t("edit_btn")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(branch._id, branch.bankName, branch.bankCode)}
                        className="px-2.5 py-1 bg-white hover:bg-red-50 hover:text-red-700 text-gray-700 border border-gray-300 hover:border-red-200 rounded text-xs font-medium transition-colors cursor-pointer"
                      >
                        {t("delete_btn")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
