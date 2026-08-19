"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BankingServiceType,
  SERVICE_CATEGORY_MAP,
} from "@/types/serviceTypes";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface CustomerUser {
  id: string;
  fullName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  phone: string;
  permanentAddress: string;
  role: string;
  createdAt: string;
}

interface ActiveToken {
  _id: string;
  tokenNumber: string;
  serviceType: BankingServiceType;
  assignedCategory: string;
  categoryLabel: string;
  status: "waiting" | "called" | "in_service" | "completed" | "cancelled";
  queuePosition: number;
  estimatedWaitMinutes: number;
  notes?: string;
  createdAt: string;
}

const SERVICE_KEYS: Record<BankingServiceType, { nameKey: string; descKey: string }> = {
  "Cash withdrawal or deposit": { nameKey: "srv_cash", descKey: "srv_cash_desc" },
  "Account opening and closing": { nameKey: "srv_acc", descKey: "srv_acc_desc" },
  "Loan enquiry": { nameKey: "srv_loan_enq", descKey: "srv_loan_enq_desc" },
  "Loan application": { nameKey: "srv_loan_app", descKey: "srv_loan_app_desc" },
  "KYC update": { nameKey: "srv_kyc", descKey: "srv_kyc_desc" },
  "Cheque services": { nameKey: "srv_cheque", descKey: "srv_cheque_desc" },
  "Address change": { nameKey: "srv_address", descKey: "srv_address_desc" },
  "Card services": { nameKey: "srv_card", descKey: "srv_card_desc" },
};

const SERVICE_OPTIONS: BankingServiceType[] = [
  "Cash withdrawal or deposit",
  "Account opening and closing",
  "Loan enquiry",
  "Loan application",
  "KYC update",
  "Cheque services",
  "Address change",
  "Card services",
];

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [user, setUser] = useState<CustomerUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [activeToken, setActiveToken] = useState<ActiveToken | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<BankingServiceType | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [isSubmittingToken, setIsSubmittingToken] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [alertNotice, setAlertNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load User from LocalStorage
  useEffect(() => {
    const raw = localStorage.getItem("bank_user");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser(parsed);
      } catch {
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setIsCheckingAuth(false);
  }, []);

  // Fetch Active Token when user is loaded
  const fetchActiveToken = async (accountNumber: string, bankCode: string) => {
    try {
      setIsLoadingToken(true);
      const res = await fetch(
        `/api/tokens?accountNumber=${encodeURIComponent(
          accountNumber
        )}&bankCode=${encodeURIComponent(bankCode)}`
      );
      const data = await res.json();
      if (data.success) {
        setActiveToken(data.data || null);
      }
    } catch (err) {
      console.error("Failed to fetch active token:", err);
    } finally {
      setIsLoadingToken(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchActiveToken(user.accountNumber, user.bankCode);
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem("bank_user");
    setUser(null);
    setActiveToken(null);
  };

  const handleCopyAccount = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedService) return;

    setIsSubmittingToken(true);
    setAlertNotice(null);

    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: user.accountNumber,
          serviceType: selectedService,
          notes,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setActiveToken(data.data);
        setSelectedService(null);
        setNotes("");
        setAlertNotice({
          type: "success",
          text: `Token ${data.data.tokenNumber} generated! You are #${data.data.queuePosition} in line.`,
        });
      } else {
        setAlertNotice({
          type: "error",
          text: data.error || "Failed to generate token",
        });
      }
    } catch (err: unknown) {
      setAlertNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Network error generating token",
      });
    } finally {
      setIsSubmittingToken(false);
    }
  };

  const handleCancelToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to cancel your queue ticket?")) return;

    try {
      const res = await fetch(`/api/tokens/${tokenId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveToken(null);
        setAlertNotice({
          type: "success",
          text: "Queue token has been cancelled.",
        });
      } else {
        alert(data.error || "Failed to cancel token");
      }
    } catch (err) {
      console.error("Cancel failed:", err);
      alert("Failed to cancel token due to network error");
    }
  };

  // Initial Auth Check Spinner
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs">{t("loading")}</p>
        </div>
      </div>
    );
  }

  // If user is NOT logged in, show the Landing Gateway asking to Sign In or Create Account
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between">
        {/* Top Navbar */}
        <nav className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏦</span>
              <span className="font-bold text-white text-sm sm:text-base">
                {t("app_title")}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />
            </div>
          </div>
        </nav>

        {/* Hero Auth Gateway */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 flex flex-col items-center justify-center text-center space-y-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span>🎟️</span>
              Smart Queue & Counter Routing System
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              {t("auth_gate_title")}
            </h1>

            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              {t("auth_gate_subtitle")}
            </p>
          </div>

          {/* Primary Action Buttons: Sign In / Create Account */}
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4">
            <Link
              href="/login"
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t("gate_signin_btn")}</span>
            </Link>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-800 w-full"></div>
              <span className="bg-slate-900 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                {t("gate_or")}
              </span>
              <div className="border-t border-slate-800 w-full"></div>
            </div>

            <Link
              href="/register"
              className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t("gate_register_btn")}</span>
            </Link>
          </div>

          {/* 8 Services Preview Banner */}
          <div className="w-full pt-8 border-t border-slate-900 space-y-4 text-left">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
              Available Banking Services
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SERVICE_OPTIONS.map((srv) => {
                const meta = SERVICE_CATEGORY_MAP[srv];
                const keys = SERVICE_KEYS[srv];
                return (
                  <div
                    key={srv}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs flex items-center gap-2.5"
                  >
                    <span className="text-xl">{meta.icon}</span>
                    <div>
                      <div className="font-semibold text-white truncate">
                        {t(keys.nameKey)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {meta.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
          Branch Queue & Customer Management Suite • Powered by Next.js & MongoDB
        </footer>
      </div>
    );
  }

  // If user IS logged in, render active dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Navbar with Language Switcher */}
      <nav className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <div>
              <span className="font-bold text-white text-sm sm:text-base">
                {user.bankName}
              </span>
              <span className="ml-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {user.bankCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher Widget */}
            <LanguageSwitcher />

            <button
              onClick={handleLogout}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-900/60 transition cursor-pointer"
            >
              {t("sign_out")}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Global Notice Alert */}
        {alertNotice && (
          <div
            className={`p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between shadow-lg ${
              alertNotice.type === "success"
                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                : "bg-rose-950/80 text-rose-300 border border-rose-500/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{alertNotice.type === "success" ? "✅" : "⚠️"}</span>
              <span>{alertNotice.text}</span>
            </div>
            <button
              onClick={() => setAlertNotice(null)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Customer Header & Digital Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Welcome & Profile */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {t("verified_account")}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {t("welcome_back")}, {user.fullName}!
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
              {t("dashboard_subtitle")}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  {t("phone_status")}
                </div>
                <div className="text-xs sm:text-sm font-bold text-emerald-400 mt-1">
                  {t("phone_verified_twilio")}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  {t("branch_code")}
                </div>
                <div className="text-xs sm:text-sm font-bold text-white font-mono mt-1">
                  {user.bankCode}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 col-span-2 sm:col-span-1">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  {t("permanent_address")}
                </div>
                <div className="text-xs font-semibold text-slate-200 mt-1 truncate">
                  📍 {user.permanentAddress}
                </div>
              </div>
            </div>
          </div>

          {/* Digital Debit / Customer ID Card */}
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-slate-900 to-indigo-950 border border-emerald-500/40 p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-400">
                  {user.bankName}
                </span>
                <span className="text-xl">💳</span>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">
                  {t("account_number")}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg sm:text-xl font-extrabold font-mono tracking-wider text-white">
                    {user.accountNumber}
                  </span>
                  <button
                    onClick={handleCopyAccount}
                    className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded transition cursor-pointer"
                  >
                    {copied ? `✓ ${t("copied")}` : `📋 ${t("copy")}`}
                  </button>
                </div>
              </div>

              <div className="flex items-end justify-between pt-2 border-t border-slate-700/50">
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-slate-400">
                    {t("account_holder")}
                  </div>
                  <div className="text-sm font-bold text-white tracking-wide">
                    {user.fullName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-widest text-slate-400">
                    {t("status_active")}
                  </div>
                  <div className="text-xs font-bold text-emerald-400">
                    {t("status_active")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Active Token Queue Card */}
        {activeToken && (
          <div className="rounded-2xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-900 border-2 border-emerald-500/50 p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl animate-pulse">
                  🎟️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {t("live_queue_token")}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                      {activeToken.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {t(SERVICE_KEYS[activeToken.serviceType]?.nameKey || "srv_cash")}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => handleCancelToken(activeToken._id)}
                className="px-3.5 py-1.5 bg-rose-950/50 hover:bg-rose-900 text-rose-300 rounded-lg text-xs font-semibold border border-rose-700/50 transition cursor-pointer self-start sm:self-center"
              >
                {t("cancel_ticket")}
              </button>
            </div>

            {/* Token Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {t("your_token_number")}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 mt-1">
                  {activeToken.tokenNumber}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {t("designated_counter")}
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {activeToken.categoryLabel}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {activeToken.assignedCategory}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {t("queue_position")}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  #{activeToken.queuePosition}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {t("ahead_in_line")}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {t("estimated_wait_time")}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400 mt-1">
                  ~{activeToken.estimatedWaitMinutes} <span className="text-xs">{t("mins")}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {t("based_on_live_load")}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <span>🔔</span> {t("ticket_waiting_notice")}{" "}
                <strong className="text-emerald-400 font-mono text-sm">{activeToken.tokenNumber}</strong>.
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {t("issued")}: {new Date(activeToken.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        )}

        {/* Section B: Service Type Selection Interface */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1">
                <span>📍</span> {t("select_purpose")}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {t("service_section_title")}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {t("service_section_subtitle")}
              </p>
            </div>

            {activeToken && (
              <div className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 self-start sm:self-center">
                <span>⚠️</span> Active Token: {activeToken.tokenNumber}
              </div>
            )}
          </div>

          {/* 8 Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SERVICE_OPTIONS.map((serviceName) => {
              const meta = SERVICE_CATEGORY_MAP[serviceName];
              const keys = SERVICE_KEYS[serviceName];
              const isSelected = selectedService === serviceName;

              return (
                <div
                  key={serviceName}
                  onClick={() => setSelectedService(serviceName)}
                  className={`relative rounded-xl p-5 border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? "bg-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500"
                      : "bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl">{meta.icon}</span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {meta.prefix} • ~{meta.avgMinutes} {t("mins")}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-sm pt-1">
                      {t(keys.nameKey)}
                    </h3>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {t(keys.descKey)}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{t("target_counter")}:</span>
                      <span className="font-semibold text-emerald-400">
                        {meta.label}
                      </span>
                    </div>

                    {meta.digitalAlternative && (
                      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-2 text-[10px] text-indigo-300 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">💡</span>
                        <span>{meta.digitalAlternative}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedService(serviceName);
                      }}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? "bg-emerald-600 text-white shadow"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                      }`}
                    >
                      {isSelected ? t("selected") : t("select_service")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Token Generation Drawer / Confirmation */}
          {selectedService && (
            <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-xl p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {SERVICE_CATEGORY_MAP[selectedService].icon}
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {t("confirm_token_for")}: {t(SERVICE_KEYS[selectedService]?.nameKey || "")}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {t("assigned_to")}{" "}
                      <strong className="text-emerald-400">
                        {SERVICE_CATEGORY_MAP[selectedService].label}
                      </strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedService(null)}
                  className="text-xs text-slate-400 hover:text-white self-end sm:self-center cursor-pointer"
                >
                  {t("change_selection")}
                </button>
              </div>

              <form onSubmit={handleRequestToken} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t("additional_notes")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("notes_placeholder")}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedService(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingToken}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmittingToken
                      ? t("generating_token")
                      : t("confirm_generate_ticket")}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
