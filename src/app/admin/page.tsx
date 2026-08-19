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

// Dynamic import with SSR disabled to prevent Leaflet window reference errors during SSR
const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-64 rounded-xl bg-slate-100 border border-slate-300 flex flex-col items-center justify-center text-slate-500 space-y-2">
      <div className="w-5 h-5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs">Loading OpenStreetMap Geocoding...</p>
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

  // Admin Passcode Authorization State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [secretInput, setSecretInput] = useState<string>("");
  const [secretError, setSecretError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Bank Management State
  const [branches, setBranches] = useState<BankBranch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  // Form State
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

  // Verify sessionStorage on mount
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

  // Initial Auth Check Spinner
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center text-slate-500 font-sans">
        <div className="w-7 h-7 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If Admin is NOT Unlocked, show sleek macOS passcode lock screen
  if (!isAdminUnlocked) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
          <LanguageSwitcher />
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-6">
          <div className="bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden">
            <MacWindowHeader
              title="Security Authorization"
              subtitle="Operations Console"
            />

            <div className="p-6 sm:p-7 space-y-5">
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-md mb-1">
                  <LockIcon size={22} />
                </div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Restricted Operations Console
                </h1>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Administrative passcode required to configure bank branches and staff deployments.
                </p>
              </div>

              {secretError && (
                <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between shadow-2xs">
                  <span>{secretError}</span>
                  <button
                    type="button"
                    onClick={() => setSecretError(null)}
                    className="opacity-70 hover:opacity-100 cursor-pointer font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={handleUnlockAdmin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Security Passcode *
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"}
                      required
                      autoFocus
                      placeholder="Enter Passcode"
                      value={secretInput}
                      onChange={(e) => setSecretInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 font-mono text-xs tracking-widest placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer font-medium"
                    >
                      {showSecret ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-b from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 active:from-black text-white font-medium text-xs transition shadow-sm cursor-pointer border border-slate-900/50"
                >
                  Authenticate Console
                </button>
              </form>

              <div className="pt-3 border-t border-slate-200/80 text-center">
                <Link
                  href="/dashboard"
                  className="text-xs text-slate-500 hover:text-slate-800 transition text-[11px]"
                >
                  ← Return to Customer Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Metrics calculations
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

  // Render Unlocked Admin Portal
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans pb-16">
      {/* macOS Top App Bar */}
      <nav className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/50 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/50 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/50 inline-block"></span>
            </div>

            <div className="h-4 w-[1px] bg-slate-300/80 mx-1"></div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-xs sm:text-sm tracking-tight">
                {t("admin_portal")}
              </span>
              <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                {t("network_setup")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />

            <button
              onClick={() => {
                if (showForm && !editingBranchId) {
                  setShowForm(false);
                } else {
                  resetForm();
                  setShowForm(true);
                }
              }}
              className="px-3 py-1 rounded-lg bg-gradient-to-b from-slate-900 to-slate-800 hover:from-slate-800 text-white font-medium text-xs transition shadow-2xs cursor-pointer border border-slate-900/50"
            >
              {showForm ? t("close_form_btn") : t("register_branch_btn")}
            </button>

            <button
              onClick={handleLockAdmin}
              className="px-2.5 py-1 rounded-lg bg-slate-100/90 text-slate-700 border border-slate-300/80 hover:bg-slate-200/90 transition text-xs font-medium cursor-pointer"
            >
              Lock
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Global Alert Notification */}
        {alertMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-2xs backdrop-blur-md ${
              alertMessage.type === "success"
                ? "bg-emerald-50/90 text-emerald-900 border border-emerald-200"
                : "bg-rose-50/90 text-rose-900 border border-rose-200"
            }`}
          >
            <div>{alertMessage.text}</div>
            <button
              onClick={() => setAlertMessage(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats Metrics Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-xl p-3.5 shadow-2xs">
            <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
              {t("total_branches")}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {totalBranchesCount}
            </div>
            <div className="text-[10px] text-emerald-800 mt-0.5 font-medium">
              Registered Branches
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-xl p-3.5 shadow-2xs">
            <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
              {t("total_staff")}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {totalStaffCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {t("staff_breakdown")}
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-xl p-3.5 shadow-2xs">
            <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
              {t("cash_counters_stat")}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {totalCashCounters}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {t("cash_label")}
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-xl p-3.5 shadow-2xs">
            <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
              {t("kyc_officers_stat")}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {totalKycStaff}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {t("kyc_label")}
            </div>
          </div>
        </div>

        {/* Branch Registration Form Window */}
        {showForm && (
          <div className="bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-2xl p-5 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingBranchId
                    ? `${t("edit_branch_title")}: ${bankName}`
                    : t("reg_branch_title")}
                </h2>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500 text-[11px]">{t("assigned_staff")}</span>
                <span className="font-bold text-slate-900 font-mono text-xs">
                  {formTotalStaff} {t("employees_count")}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Section 1: Basic Information */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                  1. {t("branch_name")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {t("branch_name")}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Downtown Central Branch"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-xs shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {t("bank_code_unique")}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BNK-0102"
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono text-xs uppercase shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {t("branch_phone")}
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={bankPhone}
                      onChange={(e) => setBankPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-xs shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Location Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    2. {t("location_selection")}
                  </h3>
                </div>

                <LocationPicker
                  initialLocation={bankLocation}
                  initialCoordinates={coordinates}
                  onLocationChange={handleLocationPicked}
                />
              </div>

              {/* Section 3: Staff Category Allocation */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    3. {t("emp_by_dept")}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {/* Category 1: Manager */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium text-slate-500 uppercase">
                          Manager
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                          Min 1
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1">{t("mgr_label")}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 bg-white rounded-lg p-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("managers", -1)}
                        disabled={staffing.managers <= 1}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 text-xs font-mono">
                        {staffing.managers}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("managers", 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category 2: Cash Counters */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium text-slate-500 uppercase">
                          Cash
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1">{t("cash_label")}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 bg-white rounded-lg p-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("cashCounters", -1)}
                        disabled={staffing.cashCounters <= 0}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 text-xs font-mono">
                        {staffing.cashCounters}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("cashCounters", 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category 3: Loan Officers */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium text-slate-500 uppercase">
                          Credit
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1">{t("loan_label")}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 bg-white rounded-lg p-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("loanOfficers", -1)}
                        disabled={staffing.loanOfficers <= 0}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 text-xs font-mono">
                        {staffing.loanOfficers}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("loanOfficers", 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category 4: Customer Service */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium text-slate-500 uppercase">
                          Support
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1">{t("cust_svc_label")}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 bg-white rounded-lg p-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("customerService", -1)}
                        disabled={staffing.customerService <= 0}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 text-xs font-mono">
                        {staffing.customerService}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("customerService", 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category 5: Account & KYC */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium text-slate-500 uppercase">
                          KYC
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1">{t("kyc_label")}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 bg-white rounded-lg p-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("accountAndKyc", -1)}
                        disabled={staffing.accountAndKyc <= 0}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 text-xs font-mono">
                        {staffing.accountAndKyc}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("accountAndKyc", 1)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer border border-slate-300 shadow-2xs"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-b from-slate-900 to-slate-800 hover:from-slate-800 text-white font-medium text-xs transition shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer border border-slate-900/50"
                >
                  {isSubmitting
                    ? t("loading")
                    : editingBranchId
                    ? t("update_branch_btn")
                    : t("save_branch_btn")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search and Filter Section */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="flex-1 max-w-md flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={t("search_placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/90 border border-slate-300/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-xs shadow-inner"
              />
              <span className="absolute left-2.5 top-2 text-slate-400">
                <SearchIcon size={13} />
              </span>
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 text-xs font-medium border border-slate-300/80 transition cursor-pointer shadow-2xs"
            >
              {t("search")}
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  fetchBranches("");
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 text-xs border border-slate-300 transition cursor-pointer"
              >
                {t("clear")}
              </button>
            )}
          </form>

          <div className="text-[11px] text-slate-400 self-center">
            {t("total_branches")}: <span className="text-slate-900 font-bold font-mono">{branches.length}</span>
          </div>
        </div>

        {/* Branches Grid */}
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-3">
            <div className="w-7 h-7 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">{t("loading")}</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="border border-slate-300/80 rounded-2xl p-10 text-center bg-white/80 backdrop-blur-md shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">
              No Registered Bank Branches
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Get started by registering the first branch location and counter staff allocation.
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="mt-3.5 px-3.5 py-1.5 bg-gradient-to-b from-slate-900 to-slate-800 hover:from-slate-800 text-white rounded-xl text-xs font-medium shadow-xs transition cursor-pointer"
            >
              {t("register_branch_btn")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {branches.map((branch) => {
              const staff = branch.staffing || {
                managers: 1,
                cashCounters: 0,
                loanOfficers: 0,
                customerService: 0,
                accountAndKyc: 0,
              };
              const branchTotal =
                (staff.managers || 0) +
                (staff.cashCounters || 0) +
                (staff.loanOfficers || 0) +
                (staff.customerService || 0) +
                (staff.accountAndKyc || 0);

              const coords = branch.coordinates;

              return (
                <div
                  key={branch._id}
                  className="bg-white/90 backdrop-blur-xl border border-slate-200/80 hover:border-slate-300 rounded-xl p-3.5 shadow-2xs transition space-y-2.5"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        <BankIcon size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs font-bold text-slate-900">
                            {branch.bankName}
                          </h3>
                          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                            {branch.bankCode}
                          </span>
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                            {branch.status || "active"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                          <span>
                            Location: {branch.bankLocation}
                          </span>
                          <span>
                            Contact: {branch.bankPhone}
                          </span>
                          {coords && (
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}#map=17/${coords.latitude}/${coords.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-600 hover:underline font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200"
                            >
                              OSM: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)} ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => openEditModal(branch)}
                        className="px-2.5 py-1 bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 rounded-lg text-xs font-medium border border-slate-300/80 transition cursor-pointer"
                      >
                        {t("edit")}
                      </button>
                      <button
                        onClick={() =>
                          handleDelete(branch._id, branch.bankName, branch.bankCode)
                        }
                        className="px-2.5 py-1 bg-slate-100/90 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-lg text-xs font-medium border border-slate-300/80 hover:border-rose-200 transition cursor-pointer"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </div>

                  {/* Staff Allocations */}
                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <span className="font-medium text-slate-400 uppercase tracking-wider text-[9px]">
                      {t("staff_breakdown")}:
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
                      <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                        Mgr: <strong>{staff.managers ?? 1}</strong>
                      </span>
                      <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                        Cash: <strong>{staff.cashCounters ?? 0}</strong>
                      </span>
                      <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                        Loans: <strong>{staff.loanOfficers ?? 0}</strong>
                      </span>
                      <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                        Support: <strong>{staff.customerService ?? 0}</strong>
                      </span>
                      <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                        KYC: <strong>{staff.accountAndKyc ?? 0}</strong>
                      </span>
                      <span className="bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-900 font-bold">
                        Total: {branchTotal}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
