"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MacWindowHeader from "@/components/MacWindowHeader";

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
        localStorage.setItem("bank_user", JSON.stringify(data.data));

        setSuccessAlert(
          `Account created successfully (${data.data.accountNumber}). Redirecting...`
        );
        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);
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
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
        <LanguageSwitcher />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="text-center space-y-1 mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            {t("register_page_title")}
          </h1>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {t("register_page_subtitle")}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden">
          <MacWindowHeader title={t("register_card_title")} subtitle="enrollment-system" />

          <div className="p-6 sm:p-8 space-y-6">
            {errorAlert && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between">
                <span>{errorAlert}</span>
                <button
                  onClick={() => setErrorAlert(null)}
                  className="text-red-600 hover:text-red-900 font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {successAlert && (
              <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-xs font-medium">
                {successAlert}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
              {/* Section 1: Institution & Account */}
              <div className="space-y-3 pb-4 border-b border-gray-100">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  1. Institution & Account ID
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t("select_branch_label")}
                  </label>
                  {isLoadingBranches ? (
                    <div className="h-9 rounded-md bg-gray-100 animate-pulse border border-gray-200"></div>
                  ) : (
                    <select
                      value={selectedBankId}
                      onChange={(e) => handleBankChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 text-xs focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer"
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t("full_legal_name")} <span className="text-gray-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-700">
                      {t("account_number_label")}
                    </label>
                    {selectedBank && (
                      <button
                        type="button"
                        onClick={() =>
                          generateRandomAccountNumber(selectedBank.bankCode)
                        }
                        className="text-[11px] text-gray-600 hover:text-gray-900 font-medium transition cursor-pointer"
                      >
                        {t("regenerate")}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SBI-84920194"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 font-mono text-xs uppercase focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                  />
                </div>
              </div>

              {/* Section 2: Contact & Address */}
              <div className="space-y-3 pb-4 border-b border-gray-100">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  2. Contact & Address
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t("phone_label")} <span className="text-gray-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 font-mono text-xs placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t("permanent_address_label")} <span className="text-gray-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Flat/House No., Street, City, State, PIN Code"
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Section 3: Credentials */}
              <div className="space-y-3">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  3. Security Credentials
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t("account_password")} <span className="text-gray-400">*</span>
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 text-xs focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t("confirm_password")} <span className="text-gray-400">*</span>
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 text-xs focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none text-gray-600 text-[11px]">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span>{t("show_passwords")}</span>
                </label>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-md bg-gray-900 hover:bg-black text-white text-xs font-medium shadow-xs transition-colors duration-100 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? t("creating_account") : t("complete_registration_btn")}
                </button>
              </div>
            </form>

            <div className="text-center pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {t("already_registered")}{" "}
                <Link
                  href="/login"
                  className="font-semibold text-gray-900 hover:underline cursor-pointer ml-1"
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
