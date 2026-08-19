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
import {
  BankIcon,
  CashIcon,
  AccountIcon,
  LoanIcon,
  KycIcon,
  ChequeIcon,
  AddressIcon,
  CardIcon,
  TicketIcon,
  ShieldCheckIcon,
  UserIcon,
  CheckIcon,
} from "@/components/BankIcons";

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

const renderServiceIcon = (iconId: string, size = 20) => {
  switch (iconId) {
    case "cash":
      return <CashIcon size={size} />;
    case "account":
      return <AccountIcon size={size} />;
    case "loan":
      return <LoanIcon size={size} />;
    case "kyc":
      return <KycIcon size={size} />;
    case "cheque":
      return <ChequeIcon size={size} />;
    case "address":
      return <AddressIcon size={size} />;
    case "card":
      return <CardIcon size={size} />;
    default:
      return <TicketIcon size={size} />;
  }
};

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
          text: `Queue Ticket ${data.data.tokenNumber} issued. Position: #${data.data.queuePosition} in line.`,
        });
      } else {
        setAlertNotice({
          type: "error",
          text: data.error || "Failed to generate token ticket",
        });
      }
    } catch (err: unknown) {
      setAlertNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Network error generating ticket",
      });
    } finally {
      setIsSubmittingToken(false);
    }
  };

  const handleCancelToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to cancel this queue ticket?")) return;

    try {
      const res = await fetch(`/api/tokens/${tokenId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveToken(null);
        setAlertNotice({
          type: "success",
          text: "Queue token ticket has been cancelled.",
        });
      } else {
        alert(data.error || "Failed to cancel ticket");
      }
    } catch (err) {
      console.error("Cancel failed:", err);
      alert("Failed to cancel token due to network error");
    }
  };

  // Initial Auth Check Spinner
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-500 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs">{t("loading")}</p>
        </div>
      </div>
    );
  }

  // If user is NOT logged in, show the clean Institutional Gateway
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col justify-between">
        {/* Top Navbar */}
        <nav className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-emerald-700 text-white flex items-center justify-center">
                <BankIcon size={18} />
              </div>
              <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">
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
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <ShieldCheckIcon size={14} className="text-emerald-700" />
              <span>Branch Queue & Service Management Portal</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {t("auth_gate_title")}
            </h1>

            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              {t("auth_gate_subtitle")}
            </p>
          </div>

          {/* Primary Action Buttons: Sign In / Create Account */}
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-3.5">
            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-semibold text-sm transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t("gate_signin_btn")}</span>
            </Link>

            <div className="relative flex items-center justify-center py-1">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {t("gate_or")}
              </span>
              <div className="border-t border-slate-200 w-full"></div>
            </div>

            <Link
              href="/register"
              className="w-full py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm border border-slate-300 transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <span>{t("gate_register_btn")}</span>
            </Link>
          </div>

          {/* 8 Services Overview Grid */}
          <div className="w-full pt-8 border-t border-slate-200 space-y-4 text-left">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
              Branch Service Offerings
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SERVICE_OPTIONS.map((srv) => {
                const meta = SERVICE_CATEGORY_MAP[srv];
                const keys = SERVICE_KEYS[srv];
                return (
                  <div
                    key={srv}
                    className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs flex items-start gap-2.5 hover:border-slate-300 transition"
                  >
                    <div className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {renderServiceIcon(meta.iconId, 16)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {t(keys.nameKey)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {meta.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
          Branch Operations Core • Enterprise Banking Management System
        </footer>
      </div>
    );
  }

  // If user IS logged in, render corporate dashboard
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Top Navbar */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-700 text-white flex items-center justify-center">
              <BankIcon size={18} />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm sm:text-base">
                {user.bankName}
              </span>
              <span className="ml-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {user.bankCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <LanguageSwitcher />

            <button
              onClick={handleLogout}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 transition cursor-pointer"
            >
              {t("sign_out")}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Notice Banner */}
        {alertNotice && (
          <div
            className={`p-3.5 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-between ${
              alertNotice.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                : "bg-rose-50 text-rose-800 border border-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckIcon size={16} className="shrink-0" />
              <span>{alertNotice.text}</span>
            </div>
            <button
              onClick={() => setAlertNotice(null)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Customer Header & Account Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Profile Details */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              {t("verified_account")}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {t("welcome_back")}, {user.fullName}
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm max-w-xl">
              {t("dashboard_subtitle")}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  {t("phone_status")}
                </div>
                <div className="text-xs font-semibold text-emerald-800 mt-1 flex items-center gap-1">
                  <CheckIcon size={12} />
                  <span>{t("phone_verified")}</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  {t("branch_code")}
                </div>
                <div className="text-xs font-bold text-slate-900 font-mono mt-1">
                  {user.bankCode}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3.5 col-span-2 sm:col-span-1 shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  {t("permanent_address")}
                </div>
                <div className="text-xs font-medium text-slate-700 mt-1 truncate">
                  {user.permanentAddress}
                </div>
              </div>
            </div>
          </div>

          {/* Institutional Account Card */}
          <div className="lg:col-span-5">
            <div className="rounded-xl bg-slate-900 text-white border border-slate-800 p-5 shadow-md space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <BankIcon size={16} className="text-emerald-400" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
                    {user.bankName}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  {t("status_active")}
                </span>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">
                  {t("account_number")}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold font-mono tracking-wider text-white">
                    {user.accountNumber}
                  </span>
                  <button
                    onClick={handleCopyAccount}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded border border-slate-700 transition cursor-pointer"
                  >
                    {copied ? t("copied") : t("copy")}
                  </button>
                </div>
              </div>

              <div className="flex items-end justify-between pt-2 border-t border-slate-800 text-xs">
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-slate-400">
                    {t("account_holder")}
                  </div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {user.fullName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-widest text-slate-400">
                    {t("registered_phone")}
                  </div>
                  <div className="font-mono text-slate-300 mt-0.5">
                    {user.phone}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Active Token Queue Card */}
        {activeToken && (
          <div className="rounded-xl bg-white border border-slate-300 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
                  <TicketIcon size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                      {t("live_queue_token")}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                      {activeToken.status}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    {t(SERVICE_KEYS[activeToken.serviceType]?.nameKey || "srv_cash")}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => handleCancelToken(activeToken._id)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 hover:border-rose-200 transition cursor-pointer self-start sm:self-center"
              >
                {t("cancel_ticket")}
              </button>
            </div>

            {/* Token Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {t("your_token_number")}
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">
                  {activeToken.tokenNumber}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {t("designated_counter")}
                </div>
                <div className="text-xs font-bold text-slate-900 mt-1">
                  {activeToken.categoryLabel}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {activeToken.assignedCategory}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {t("queue_position")}
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  #{activeToken.queuePosition}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {t("ahead_in_line")}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {t("estimated_wait_time")}
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  ~{activeToken.estimatedWaitMinutes} <span className="text-xs font-normal text-slate-500">{t("mins")}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {t("based_on_live_load")}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                {t("ticket_waiting_notice")}{" "}
                <strong className="text-emerald-800 font-mono text-sm">{activeToken.tokenNumber}</strong>.
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {t("issued")}: {new Date(activeToken.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        )}

        {/* Section B: Service Type Selection Interface */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-1">
                <span>•</span> {t("select_purpose")}
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {t("service_section_title")}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("service_section_subtitle")}
              </p>
            </div>

            {activeToken && (
              <div className="text-xs bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg self-start sm:self-center font-medium">
                Active Ticket: <strong className="font-mono text-slate-900">{activeToken.tokenNumber}</strong>
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
                  className={`rounded-lg p-4 border transition-all cursor-pointer flex flex-col justify-between space-y-3.5 ${
                    isSelected
                      ? "bg-emerald-50/50 border-emerald-600 ring-1 ring-emerald-600"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded bg-slate-100 text-slate-700 flex items-center justify-center">
                        {renderServiceIcon(meta.iconId, 18)}
                      </div>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {meta.prefix} • ~{meta.avgMinutes} {t("mins")}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm pt-1">
                      {t(keys.nameKey)}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {t(keys.descKey)}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">{t("target_counter")}:</span>
                      <span className="font-semibold text-slate-800">
                        {meta.label}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedService(serviceName);
                      }}
                      className={`w-full py-1.5 px-3 rounded text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
                      }`}
                    >
                      {isSelected ? t("selected") : t("select_service")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Token Generation Drawer */}
          {selectedService && (
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-emerald-700 text-white flex items-center justify-center">
                    {renderServiceIcon(SERVICE_CATEGORY_MAP[selectedService].iconId, 18)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t("confirm_token_for")}: {t(SERVICE_KEYS[selectedService]?.nameKey || "")}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {t("assigned_to")}{" "}
                      <strong className="text-slate-800">
                        {SERVICE_CATEGORY_MAP[selectedService].label}
                      </strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedService(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 self-end sm:self-center cursor-pointer"
                >
                  {t("change_selection")}
                </button>
              </div>

              <form onSubmit={handleRequestToken} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t("additional_notes")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("notes_placeholder")}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedService(null)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition cursor-pointer shadow-2xs"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingToken}
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
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
