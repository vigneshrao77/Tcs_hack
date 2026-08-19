"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MacWindowHeader from "@/components/MacWindowHeader";
import { BankIcon, CheckIcon, RefreshIcon } from "@/components/BankIcons";

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

  // Final Registration Submit - Stores Directly in MongoDB
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAlert(null);
    setSuccessAlert(null);

    if (!selectedBank) {
      setErrorAlert("Please select an active branch from the list.");
      return;
    }

    if (!fullName.trim()) {
      setErrorAlert("Please enter your full legal name.");
      return;
    }

    if (!phone.trim()) {
      setErrorAlert("Please enter your mobile phone number.");
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
        // Also save active session locally
        localStorage.setItem("bank_user", JSON.stringify(data.data));

        setSuccessAlert(
          `Account created and saved in database successfully! Account Number: ${data.data.accountNumber}. Redirecting to dashboard...`
        );
        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar with Language Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
        <LanguageSwitcher />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-white/80 text-slate-700 border border-slate-300/80 shadow-2xs backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            <span>{t("account_enrollment_assistant")}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t("register_page_title")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {t("register_page_subtitle")}
          </p>
        </div>

        {/* macOS Window Frame Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden">
          <MacWindowHeader title={t("register_card_title")} subtitle="tcs-customer-registration" />

          <div className="p-6 sm:p-8 space-y-6">
            {errorAlert && (
              <div className="p-3.5 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-900 text-xs font-medium flex items-center justify-between shadow-2xs">
                <span>{errorAlert}</span>
                <button
                  onClick={() => setErrorAlert(null)}
                  className="opacity-70 hover:opacity-100 cursor-pointer font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {successAlert && (
              <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2 shadow-2xs">
                <CheckIcon size={14} className="shrink-0" />
                <span>{successAlert}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-6">
              {/* Step 1: Branch & Identity Details */}
              <div className="space-y-4 border-b border-slate-200/80 pb-5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200/80 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    {t("step1_title")}
                  </h2>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {t("select_branch_label")}
                  </label>
                  {isLoadingBranches ? (
                    <div className="h-10 rounded-xl bg-slate-100 animate-pulse border border-slate-200"></div>
                  ) : (
                    <select
                      value={selectedBankId}
                      onChange={(e) => handleBankChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition shadow-inner cursor-pointer"
                    >
                      {branches.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.bankName} — ({b.bankCode}) • {b.bankLocation}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedBank && (
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                      <BankIcon size={12} />
                      <span>
                        {t("branch_helpline")}: {selectedBank.bankPhone}
                      </span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {t("full_legal_name")}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition shadow-inner"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-slate-600">
                      {t("account_number_label")}
                    </label>
                    {selectedBank && (
                      <button
                        type="button"
                        onClick={() =>
                          generateRandomAccountNumber(selectedBank.bankCode)
                        }
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-medium transition cursor-pointer flex items-center gap-1"
                      >
                        <RefreshIcon size={11} />
                        <span>{t("regenerate")}</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. BNK-84920194"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 font-mono text-xs uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition shadow-inner"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t("must_start_with")}{" "}
                    <strong className="text-slate-800 font-mono">
                      {selectedBank ? selectedBank.bankCode : "BRANCH"}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Step 2: Contact & Address */}
              <div className="space-y-4 border-b border-slate-200/80 pb-5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200/80 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                    2
                  </span>
                  <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    {t("step2_title")}
                  </h2>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {t("phone_label")}
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210 or +91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {t("permanent_address_label")}
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Flat/House No., Street, City, State, PIN Code"
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none shadow-inner"
                  />
                </div>
              </div>

              {/* Step 3: Security & Credentials */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200/80 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                    3
                  </span>
                  <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    {t("step3_title")}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {t("account_password")}
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {t("confirm_password")}
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition shadow-inner"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 text-[11px]">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="rounded text-slate-900 focus:ring-slate-500"
                    />
                    <span>{t("show_passwords")}</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-b from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 active:from-black text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 border border-slate-900/50"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{t("creating_account")}</span>
                    </div>
                  ) : (
                    <span>{t("complete_registration_btn")}</span>
                  )}
                </button>
              </div>
            </form>

            <div className="text-center pt-2 border-t border-slate-200/80">
              <p className="text-xs text-slate-500">
                {t("already_registered")}{" "}
                <Link
                  href="/login"
                  className="font-semibold text-slate-900 hover:underline cursor-pointer"
                >
                  {t("sign_in_now")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
