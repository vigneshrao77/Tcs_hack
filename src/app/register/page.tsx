"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface BankBranch {
  _id: string;
  bankName: string;
  bankCode: string;
  bankLocation: string;
  bankPhone: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [branches, setBranches] = useState<BankBranch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(true);

  // Form State
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [isOtpVerified, setIsOtpVerified] = useState<boolean>(false);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [otpSuccessNotice, setOtpSuccessNotice] = useState<string | null>(null);

  const [permanentAddress, setPermanentAddress] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successAlert, setSuccessAlert] = useState<string | null>(null);

  // Fetch branches for selection
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setIsLoadingBranches(true);
        const res = await fetch("/api/banks");
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setBranches(data.data);
          setSelectedBankId(data.data[0]._id);
          generateRandomAccountNumber(data.data[0].bankCode || "BNK");
        }
      } catch (err) {
        console.error("Failed to load branches:", err);
      } finally {
        setIsLoadingBranches(false);
      }
    };

    fetchBranches();
  }, []);

  const selectedBank = branches.find((b) => b._id === selectedBankId);

  const handleBankChange = (bankId: string) => {
    setSelectedBankId(bankId);
    const bank = branches.find((b) => b._id === bankId);
    const prefix = bank ? bank.bankCode : "BNK";
    generateRandomAccountNumber(prefix);
  };

  const generateRandomAccountNumber = (prefix: string) => {
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
    const formattedPrefix = prefix.replace(/\s+/g, "").toUpperCase();
    setAccountNumber(`${formattedPrefix}-${randomDigits}`);
  };

  // Send Twilio OTP
  const handleSendOtp = async () => {
    if (!phone || phone.trim().length < 8) {
      setErrorAlert("Please enter a valid phone number with country code (e.g. +91 9876543210 or +1 555...)");
      return;
    }

    setIsSendingOtp(true);
    setErrorAlert(null);
    setOtpSuccessNotice(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsOtpSent(true);
        setOtpSuccessNotice(data.message || `Verification code sent via SMS to ${phone}`);
      } else {
        setErrorAlert(data.error || "Failed to send verification code via Twilio");
      }
    } catch (err: unknown) {
      setErrorAlert(
        err instanceof Error ? err.message : "Network error sending OTP"
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 4) {
      setErrorAlert("Please enter the 6-digit OTP code received on your phone.");
      return;
    }

    setIsVerifyingOtp(true);
    setErrorAlert(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otpCode }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsOtpVerified(true);
        setOtpSuccessNotice("Phone number verified successfully via SMS code!");
      } else {
        setErrorAlert(data.error || "Invalid OTP code");
      }
    } catch (err: unknown) {
      setErrorAlert(
        err instanceof Error ? err.message : "Network error during verification"
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Final Registration Submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAlert(null);
    setSuccessAlert(null);

    if (!selectedBank) {
      setErrorAlert("Please select a bank branch or register one in the admin panel.");
      return;
    }

    if (!isOtpVerified) {
      setErrorAlert("Please verify your phone number with Twilio OTP before submitting.");
      return;
    }

    if (password.length < 6) {
      setErrorAlert("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorAlert("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          bankId: selectedBank._id,
          bankName: selectedBank.bankName,
          bankCode: selectedBank.bankCode,
          accountNumber,
          phone,
          permanentAddress,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessAlert(
          `Registration successful! Your Account Number is ${data.data.accountNumber}. Redirecting to login...`
        );
        setTimeout(() => {
          router.push(`/login?account=${encodeURIComponent(data.data.accountNumber)}`);
        }, 2000);
      } else {
        setErrorAlert(data.error || "Registration failed");
      }
    } catch (err: unknown) {
      setErrorAlert(
        err instanceof Error ? err.message : "Network error during registration"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar with Language Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
        <LanguageSwitcher />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-3xl shadow-inner">
            🏦
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            {t("register_title")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {t("register_subtitle")}
          </p>
        </div>

        {/* Card Form */}
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Alerts */}
          {errorAlert && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center justify-between">
              <span>⚠️ {errorAlert}</span>
              <button
                type="button"
                onClick={() => setErrorAlert(null)}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {successAlert && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
              <span className="animate-bounce">✅</span>
              <span>{successAlert}</span>
            </div>
          )}

          {otpSuccessNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>📱</span>
                <span>{otpSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setOtpSuccessNotice(null)}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            {/* Step 1: Bank Selection & Account Number */}
            <div className="space-y-4 border-b border-slate-800 pb-5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                {t("step1_title")}
              </h2>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t("select_bank_branch")}
                </label>
                {isLoadingBranches ? (
                  <div className="text-xs text-slate-400">{t("loading")}</div>
                ) : branches.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
                    <span>No bank branches registered yet.</span>
                    <Link
                      href="/admin"
                      className="underline font-bold text-amber-200 hover:text-white"
                    >
                      Register a branch in Admin →
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedBankId}
                    onChange={(e) => handleBankChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bankName} ({b.bankCode}) - {b.bankLocation}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t("full_name")}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alexander Hamilton"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    {t("unique_acc_label")}
                  </label>
                  {selectedBank && (
                    <button
                      type="button"
                      onClick={() =>
                        generateRandomAccountNumber(selectedBank.bankCode)
                      }
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                    >
                      {t("regenerate")}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC-84920194"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono text-xs sm:text-sm uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {t("must_start_with")}{" "}
                  <strong className="text-emerald-400 font-mono">
                    {selectedBank ? selectedBank.bankCode : "BANK"}
                  </strong>
                </p>
              </div>
            </div>

            {/* Step 2: Phone & Twilio OTP Verification */}
            <div className="space-y-4 border-b border-slate-800 pb-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  {t("step2_title")}
                </h2>
                {isOtpVerified && (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                    ✓ {t("verified")}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t("phone_label")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    required
                    disabled={isOtpVerified}
                    placeholder="e.g. +91 9876543210 or +1 555 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                  />
                  {!isOtpVerified && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp || !phone}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSendingOtp ? t("loading") : isOtpSent ? t("resend_otp") : t("send_otp")}
                    </button>
                  )}
                </div>
              </div>

              {/* OTP Entry Section */}
              {isOtpSent && !isOtpVerified && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-emerald-400">
                      {t("enter_otp_label")}
                    </label>
                    <span className="text-[11px] text-slate-400">5 {t("mins")}</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tracking-widest text-center text-base focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={isVerifyingOtp || otpCode.length < 4}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      {isVerifyingOtp ? t("loading") : t("verify_otp_btn")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Permanent Address & Password */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                {t("step3_title")}
              </h2>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t("permanent_address")} *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. 142 Elm Street, Apt 4B, New York, NY 10001"
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t("set_password")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t("confirm_password")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showPassword"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="showPassword" className="text-xs text-slate-400 cursor-pointer">
                  {t("show_password")}
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !isOtpVerified}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting
                ? t("loading")
                : !isOtpVerified
                ? t("verify_otp_btn")
                : t("complete_reg_btn")}
            </button>
          </form>

          {/* Footer Link */}
          <div className="text-center pt-2 border-t border-slate-800/80">
            <p className="text-xs text-slate-400">
              {t("already_have_account")}{" "}
              <Link
                href="/login"
                className="text-emerald-400 hover:text-emerald-300 font-semibold underline"
              >
                {t("sign_in_link")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
