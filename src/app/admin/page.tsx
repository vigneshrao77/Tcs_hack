"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SelectedLocation } from "@/components/LocationPicker";

// Dynamic import with SSR disabled to prevent Leaflet window reference errors during SSR
const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-64 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-400 space-y-2">
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs">Loading OpenStreetMap Component...</p>
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

export default function AdminPage() {
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
    fetchBranches();
  }, []);

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
    };

    try {
      const endpoint = editingBranchId ? `/api/banks/${editingBranchId}` : "/api/banks";
      const method = editingBranchId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAlertMessage({
          type: "success",
          text: editingBranchId
            ? `Branch "${bankName}" updated successfully!`
            : `Branch "${bankName}" (${bankCode.toUpperCase()}) registered successfully with OpenStreetMap coordinates!`,
        });
        resetForm();
        setShowForm(false);
        fetchBranches();
      } else {
        setAlertMessage({
          type: "error",
          text: data.error || "Failed to process request",
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
      const res = await fetch(`/api/banks/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchBranches(searchQuery);
      } else {
        alert(data.error || "Failed to delete branch");
      }
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete branch due to network error");
    }
  };

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <div>
              <span className="text-base font-bold text-white tracking-wide">
                Bank Admin Portal
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Network & Branch Setup
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950 transition"
            >
              ← System Overview
            </Link>
            <button
              onClick={() => {
                if (showForm && !editingBranchId) {
                  setShowForm(false);
                } else {
                  resetForm();
                  setShowForm(true);
                }
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
            >
              <span>{showForm ? "✕ Close Form" : "＋ Register Branch"}</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Global Alert Notification */}
        {alertMessage && (
          <div
            className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-lg ${
              alertMessage.type === "success"
                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                : "bg-rose-950/80 text-rose-300 border border-rose-500/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <span>{alertMessage.type === "success" ? "✅" : "⚠️"}</span>
              <span>{alertMessage.text}</span>
            </div>
            <button
              onClick={() => setAlertMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats Metrics Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Total Branches
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {totalBranchesCount}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <span>●</span> Registered in DB
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Total Staff Deployed
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {totalStaffCount}
            </div>
            <div className="text-[11px] text-indigo-400 mt-1">
              Across 5 specializations
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Cash Counters
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {totalCashCounters}
            </div>
            <div className="text-[11px] text-amber-400 mt-1">
              Active cash service desks
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Account & KYC Officers
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {totalKycStaff}
            </div>
            <div className="text-[11px] text-cyan-400 mt-1">
              Onboarding & compliance
            </div>
          </div>
        </div>

        {/* Branch Registration / Edit Form Drawer */}
        {showForm && (
          <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🏛️</span>
                  {editingBranchId
                    ? `Edit Branch: ${bankName}`
                    : "Register New Bank Branch"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure branch details, select precise location with OpenStreetMap, and assign category quotas.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                <span className="text-slate-400">Total Assigned Staff:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {formTotalStaff} Employees
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1: Basic Information */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  1. Branch Core Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Bank / Branch Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Downtown Central Branch"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Bank Code (Unique) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BNK-0102"
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-xs sm:text-sm uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Branch Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +1 (555) 234-5678"
                      value={bankPhone}
                      onChange={(e) => setBankPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: OpenStreetMap Location Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🗺️</span> 2. Location Selection (OpenStreetMap API & Interactive Map)
                  </h3>
                  <span className="text-[11px] text-emerald-400">
                    Search, Click Map or Use GPS
                  </span>
                </div>

                <LocationPicker
                  initialLocation={bankLocation}
                  initialCoordinates={coordinates}
                  onLocationChange={handleLocationPicked}
                />
              </div>

              {/* Section 3: Employees Divided by Categories */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    3. Employees by Department / Category
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Managers have a default minimum of 1
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Category 1: Manager */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl">👔</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Min 1
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-2">1) Managers</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Branch supervision & escalations
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4 bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("managers", -1)}
                        disabled={staffing.managers <= 1}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 text-sm font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-white text-sm font-mono">
                        {staffing.managers}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("managers", 1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category 2: Cash Counters */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl">💵</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Cash
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-2">2) Cash Counters</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Deposits, withdrawals & forex
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4 bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("cashCounters", -1)}
                        disabled={staffing.cashCounters <= 0}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 text-sm font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-white text-sm font-mono">
                        {staffing.cashCounters}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("cashCounters", 1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category 3: Loan Officers */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl">📑</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Credit
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-2">3) Loan Officers</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Mortgage, personal & SME loans
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4 bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("loanOfficers", -1)}
                        disabled={staffing.loanOfficers <= 0}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 text-sm font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-white text-sm font-mono">
                        {staffing.loanOfficers}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("loanOfficers", 1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category 4: Customer Service */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl">🎧</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Helpdesk
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-2">4) Customer Service</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Cards, disputes & general queries
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4 bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("customerService", -1)}
                        disabled={staffing.customerService <= 0}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 text-sm font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-white text-sm font-mono">
                        {staffing.customerService}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("customerService", 1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Category 5: Account & KYC */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl">🆔</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          Onboard
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-2">5) Account & KYC</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        New accounts & document verification
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4 bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleStaffChange("accountAndKyc", -1)}
                        disabled={staffing.accountAndKyc <= 0}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 text-sm font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-white text-sm font-mono">
                        {staffing.accountAndKyc}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStaffChange("accountAndKyc", 1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs transition shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting
                    ? "Saving to Database..."
                    : editingBranchId
                    ? "Update Branch Details"
                    : "Register Branch into Database"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search and Filter Section */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="flex-1 max-w-lg flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by Bank Name, Code (e.g. BNK-01), Location or Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
              />
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">
                🔍
              </span>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              Search
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  fetchBranches("");
                }}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs border border-slate-800 transition cursor-pointer"
              >
                Clear
              </button>
            )}
          </form>

          <div className="text-xs text-slate-400 self-center">
            Showing <span className="text-white font-bold">{branches.length}</span>{" "}
            branches
          </div>
        </div>

        {/* Branches Grid & Cards */}
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Loading registered branches from MongoDB...</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center bg-slate-900/40">
            <span className="text-4xl">🏛️</span>
            <h3 className="text-base font-bold text-white mt-3">
              No Bank Branches Registered Yet
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Get started by registering your first bank branch with location,
              phone, and staff allocation.
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="mt-5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
            >
              ＋ Register First Branch
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
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
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 shadow-sm transition space-y-4"
                >
                  {/* Top Bar: Name, Code, Location, Actions */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl shrink-0">
                        🏦
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white">
                            {branch.bankName}
                          </h3>
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-emerald-500/30">
                            {branch.bankCode}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {branch.status || "active"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            📍 {branch.bankLocation}
                          </span>
                          <span className="flex items-center gap-1">
                            📞 {branch.bankPhone}
                          </span>
                          {coords && (
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}#map=17/${coords.latitude}/${coords.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                            >
                              🗺️ OSM: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)} ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => openEditModal(branch)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition cursor-pointer"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() =>
                          handleDelete(branch._id, branch.bankName, branch.bankCode)
                        }
                        className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-lg text-xs font-medium border border-rose-800/40 transition cursor-pointer"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  {/* Staff Category Allocation Badges */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-slate-400 uppercase tracking-wider text-[11px]">
                        Staff Allocation Breakdown
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {branchTotal} Total Employees
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>👔</span>
                          <span className="text-slate-300">Manager:</span>
                        </div>
                        <span className="font-bold text-white font-mono">
                          {staff.managers ?? 1}
                        </span>
                      </div>

                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>💵</span>
                          <span className="text-slate-300">Cash Counters:</span>
                        </div>
                        <span className="font-bold text-emerald-400 font-mono">
                          {staff.cashCounters ?? 0}
                        </span>
                      </div>

                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>📑</span>
                          <span className="text-slate-300">Loan Officers:</span>
                        </div>
                        <span className="font-bold text-purple-400 font-mono">
                          {staff.loanOfficers ?? 0}
                        </span>
                      </div>

                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>🎧</span>
                          <span className="text-slate-300">Customer Svc:</span>
                        </div>
                        <span className="font-bold text-amber-400 font-mono">
                          {staff.customerService ?? 0}
                        </span>
                      </div>

                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>🆔</span>
                          <span className="text-slate-300">Account & KYC:</span>
                        </div>
                        <span className="font-bold text-cyan-400 font-mono">
                          {staff.accountAndKyc ?? 0}
                        </span>
                      </div>
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
