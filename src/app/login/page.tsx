"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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
      setSuccessMessage("Account created! Please sign in with your password.");
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
        setSuccessMessage("Login successful! Redirecting to your dashboard...");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);
      } else {
        setErrorMessage(data.error || "Invalid account number or password.");
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Network error during login"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar with Language Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
        <LanguageSwitcher />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Header Icon */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-3xl shadow-sm">
            💳
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {t("login_title")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {t("login_subtitle")}
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
          {/* Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
              <span>⚠️ {errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <span>✅</span>
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t("account_number")} *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. HDFC-84920194 or SBI-019284"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-sm uppercase placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 shadow-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {t("must_start_with")} BANK CODE
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t("password")} *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showPassword"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="showPassword" className="text-slate-600 cursor-pointer">
                  {t("show_password")}
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? t("loading") : t("sign_in_btn")}
            </button>
          </form>

          {/* Navigation Links */}
          <div className="pt-4 border-t border-slate-100 space-y-3 text-center text-xs">
            <p className="text-slate-600">
              {t("no_account_yet")}{" "}
              <Link
                href="/register"
                className="text-emerald-700 hover:text-emerald-800 font-semibold underline"
              >
                {t("register_with_twilio")}
              </Link>
            </p>
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
