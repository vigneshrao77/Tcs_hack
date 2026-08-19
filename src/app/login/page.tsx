"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MacWindowHeader from "@/components/MacWindowHeader";
import { BankIcon, CheckIcon } from "@/components/BankIcons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const [accountNumber, setAccountNumber] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const acc = searchParams.get("account");
    if (acc) {
      setAccountNumber(acc);
      setSuccessMessage("Account created successfully. Please sign in with your credentials.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: accountNumber.trim().toUpperCase(),
          password,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem("bank_user", JSON.stringify(data.data));
        setSuccessMessage("Authentication successful. Redirecting to dashboard...");
        setTimeout(() => {
          router.push("/dashboard");
        }, 800);
      } else {
        setErrorMessage(data.error || "Invalid account number or password.");
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Network communication error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar with Language Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
        <LanguageSwitcher />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Sleek macOS Floating Window Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden">
          <MacWindowHeader
            title={t("login_title")}
            subtitle="Core Banking Client"
          />

          <div className="p-6 sm:p-8 space-y-6">
            {/* Header Icon & Title */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-md mb-1">
                <BankIcon size={22} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {t("login_title")}
              </h1>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {t("login_subtitle")}
              </p>
            </div>

            {/* Alerts */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between shadow-2xs">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="opacity-70 hover:opacity-100 cursor-pointer font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 shadow-2xs">
                <CheckIcon size={14} className="text-emerald-700 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  {t("account_number")} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BNK-84920194"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 font-mono text-xs uppercase placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition shadow-inner"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {t("must_start_with")} Branch Prefix
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  {t("password")} *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 text-xs placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition shadow-inner"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showPassword"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded bg-white border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="showPassword" className="text-slate-600 cursor-pointer text-[11px]">
                    {t("show_password")}
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-b from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 active:from-black active:to-slate-900 text-white font-medium text-xs transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 border border-slate-900/50"
              >
                {isSubmitting ? t("loading") : t("sign_in_btn")}
              </button>
            </form>

            {/* Footer Navigation */}
            <div className="pt-4 border-t border-slate-200/80 text-center text-xs">
              <p className="text-slate-500 text-[11px]">
                {t("no_account_yet")}{" "}
                <Link
                  href="/register"
                  className="text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2 ml-1"
                >
                  {t("register_link")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center text-slate-500">
          Loading client...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
