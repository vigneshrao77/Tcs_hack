"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { BankIcon, CheckIcon, RefreshIcon, PhoneIcon, LockIcon } from "@/components/BankIcons";

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

  // Send SMS Verification OTP
  const handleSendOtp = async () => {
    if (!phone || phone.trim().length < 8) {
      setErrorAlert("Please enter a valid mobile number with country code (e.g., +91 9876543210 or +1 555...)");
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
        setOtpSuccessNotice(data.message || `Verification code dispatched via SMS to ${phone}`);
      } else {
        setErrorAlert(data.error || "Failed to dispatch SMS verification code");
      }
    } catch (err: unknown) {
      setErrorAlert(
        err instanceof Error ? err.message : "Network communication error"
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 4) {
      setErrorAlert("Please enter the 6-digit verification code received on your phone.");
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
        setOtpSuccessNotice("Mobile phone number verified successfully.");
      } else {
        setErrorAlert(data.error || "Invalid verification code");
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
      setErrorAlert("Please select an active branch from the list.");
      return;
    }

    if (!isOtpVerified) {
      setErrorAlert("Please complete mobile phone verification before submitting registration.");
      return;
    }

    if (password.length < 6) {
      setErrorAlert("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorAlert("Password confirmation does not match.");
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
          `Account created successfully. Account Number: ${data.data.accountNumber}. Redirecting to sign in...`
        );
        setTimeout(() => {
          router.push(`/login?account=${encodeURIComponent(data.data.accountNumber)}`);
        }, 1500);
      } else {
        setErrorAlert(data.error || "Registration failed");
      }
    } catch (err: unknown) {
      setErrorAlert(
        err instanceof Error ? err.message : "Network communication error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar with Language Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
        <LanguageSwitcher />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-600 text-white shadow-sm mb-1">
            <BankIcon size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("register_title")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {t("register_subtitle")}
          </p>
        </div>

        {/* Card Form */}
        <div className="mt-8 bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
          {/* Alerts */}
          {errorAlert && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
              <span>{errorAlert}</span>
              <button
                type="button"
                onClick={() => setErrorAlert(null)}
                className="opacity-70 hover:opacity-100 cursor-pointer font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {successAlert && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckIcon size={14} className="text-emerald-700 shrink-0" />
              <span>{successAlert}</span>
            </div>
          )}

          {otpSuccessNotice && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckIcon size={14} className="text-emerald-700 shrink-0" />
                <span>{otpSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setOtpSuccessNotice(null)}
                className="opacity-70 hover:opacity-100 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            {/* Step 1: Branch & Account Selection */}
            <div className="space-y-4 border-b border-slate-200 pb-5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t("step1_title")}
                </h2>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t("select_bank_branch")}
                </label>
                {isLoadingBranches ? (
                  <div className="text-xs text-slate-500">{t("loading")}</div>
                ) : branches.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    <span>No bank branches registered in the system.</span>
                  </div>
                ) : (
                  <select
                    value={selectedBankId}
                    onChange={(e) => handleBankChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-emerald-600 shadow-2xs"
                  >
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bankName} ({b.bankCode}) — {b.bankLocation}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t("full_name")}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Alexander Hamilton"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-emerald-600 shadow-2xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    {t("unique_acc_label")}
                  </label>
                  {selectedBank && (
                    <button
                      type="button"
                      onClick={() =>
                        generateRandomAccountNumber(selectedBank.bankCode)
                      }
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium transition cursor-pointer flex items-center gap-1"
                    >
                      <RefreshIcon size={12} />
                      <span>{t("regenerate")}</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g., BNK-84920194"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-xs sm:text-sm uppercase focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {t("must_start_with")}{" "}
                  <strong className="text-slate-800 font-mono">
                    {selectedBank ? selectedBank.bankCode : "BRANCH"}
                  </strong>
                </p>
              </div>
            </div>

            {/* Step 2: Mobile Phone Verification */}
            <div className="space-y-4 border-b border-slate-200 pb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center text-[10px] font-bold">
                    2
                  </span>
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {t("step2_title")}
                  </h2>
                </div>
                {isOtpVerified && (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <CheckIcon size={12} />
                    <span>{t("verified")}</span>
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t("phone_label")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    required
                    disabled={isOtpVerified}
                    placeholder="e.g., +91 9876543210 or +1 555 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-500 shadow-2xs"
                  />
                  {!isOtpVerified && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp || !phone}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                    >
                      {isSendingOtp ? t("loading") : isOtpSent ? t("resend_otp") : t("send_otp")}
                    </button>
                  )}
                </div>
              </div>

              {/* OTP Entry Section */}
              {isOtpSent && !isOtpVerified && (
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-800">
                      {t("enter_otp_label")}
                    </label>
                    <span className="text-[11px] text-slate-500">Validity: 5 {t("mins")}</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono tracking-widest text-center text-base focus:outline-none focus:border-emerald-600 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={isVerifyingOtp || otpCode.length < 4}
                      className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-2xs"
                    >
                      {isVerifyingOtp ? t("loading") : t("verify_otp_btn")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Permanent Address & Credentials */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t("step3_title")}
                </h2>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t("permanent_address")} *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g., 142 Elm Street, Suite 4B, City, State, ZIP"
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-emerald-600 resize-none shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t("set_password")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-emerald-600 shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t("confirm_password")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-emerald-600 shadow-2xs"
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
                  className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="showPassword" className="text-xs text-slate-600 cursor-pointer">
                  {t("show_password")}
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !isOtpVerified}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-semibold text-sm transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting
                ? t("loading")
                : !isOtpVerified
                ? t("verify_otp_btn")
                : t("complete_reg_btn")}
            </button>
          </form>

          {/* Footer Link */}
          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-600">
              {t("already_have_account")}{" "}
              <Link
                href="/login"
                className="text-emerald-700 hover:text-emerald-800 font-semibold underline"
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
