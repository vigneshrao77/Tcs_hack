"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MacWindowHeader from "@/components/MacWindowHeader";

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
        }, 600);
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
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8 flex items-center gap-2.5">
        <Link
          href="/bank/employee"
          className="text-xs font-medium text-gray-700 hover:text-gray-900 border border-gray-300 bg-white px-2.5 py-1 rounded-md"
        >
          🏢 Staff Counter
        </Link>
        <LanguageSwitcher />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden">
          <MacWindowHeader
            title={t("login_title")}
            subtitle={t("core_banking_client")}
          />

          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
                {t("login_title")}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                {t("login_subtitle")}
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-red-600 hover:text-red-900 font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-xs font-medium">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("account_number")} <span className="text-gray-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SBI-84920194"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2 rounded-md bg-white border border-gray-300 text-gray-900 font-mono text-xs uppercase placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {t("must_start_with")} branch code
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("password")} <span className="text-gray-400">*</span>
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-md bg-white border border-gray-300 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer select-none text-[11px]">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span>{t("show_password")}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-md bg-gray-900 hover:bg-black text-white font-medium text-xs shadow-xs transition-colors duration-100 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? t("loading") : t("sign_in_btn")}
              </button>
            </form>

            <div className="pt-4 border-t border-gray-100 text-center text-xs">
              <p className="text-gray-500 text-[11px]">
                {t("no_account_yet")}{" "}
                <Link
                  href="/register"
                  className="text-gray-900 font-semibold hover:underline ml-1"
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
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-gray-500 text-xs font-mono">
          Loading authentication client...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
