"use client";

import { useEffect, useState, useRef } from "react";
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
  CheckIcon,
  UserIcon,
  MicrophoneIcon,
  SparklesIcon,
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
  assignedEmployeeName?: string;
  assignedEmployeeId?: string;
  assignedDesk?: string;
  status: "waiting" | "called" | "in_service" | "completed" | "cancelled";
  queuePosition: number;
  estimatedWaitMinutes: number;
  notes?: string;
  createdAt: string;
}

interface DocumentRequirement {
  name: string;
  description: string;
  isMandatory: boolean;
}

interface AIAdviceResponse {
  requiresVisit: boolean;
  visitVerdict: string;
  summary: string;
  mappedDepartment?: string;
  mappedEmployeeRole?: string;
  mappedDesk?: string;
  digitalAlternatives: string[];
  requiredDocuments: DocumentRequirement[];
  prerequisites: string[];
  estimatedCounterMinutes: number;
  bestTimeToVisit: string;
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

const renderServiceIcon = (iconId: string, size = 18) => {
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
  const { t, language } = useLanguage();

  const [user, setUser] = useState<CustomerUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [activeToken, setActiveToken] = useState<ActiveToken | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<BankingServiceType | null>(null);
  const [detailedExplanation, setDetailedExplanation] = useState<string>("");
  const [isSubmittingToken, setIsSubmittingToken] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [alertNotice, setAlertNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Gemini AI Analysis state for the selected query
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<boolean>(false);
  const [aiAdvice, setAiAdvice] = useState<AIAdviceResponse | null>(null);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});

  // Senior Citizen Voice-to-Text Speech state
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [voiceStatusNotice, setVoiceStatusNotice] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Helper for localized counter category label
  const getCategoryDeskName = (category: string, fallback: string) => {
    switch (category) {
      case "cashCounters":
        return t("desk_cash");
      case "accountAndKyc":
        return t("desk_acc");
      case "loanOfficers":
        return t("desk_loan");
      case "customerService":
        return t("desk_cust");
      default:
        return fallback;
    }
  };

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

  // When a service is selected, automatically analyze with Gemini AI
  const handleSelectService = (service: BankingServiceType) => {
    setSelectedService(service);
    setDetailedExplanation("");
    setAiAdvice(null);
    setCheckedDocs({});
    setVoiceStatusNotice(null);

    // Automatically trigger initial AI evaluation for this service
    fetchGeminiAdvice(service, "");

    // Smooth scroll to drawer
    setTimeout(() => {
      drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Fetch Gemini AI Advice for the query + detailed explanation
  const fetchGeminiAdvice = async (service: BankingServiceType, explanation: string) => {
    setIsAnalyzingAI(true);
    try {
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: service,
          queryText: explanation,
          language: language === "te" ? "te" : "en",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAiAdvice(data.data);
      }
    } catch (err) {
      console.error("AI Advisor evaluation failed:", err);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Senior Citizen Voice-to-Text Input Handler
  const startVoiceInput = () => {
    setVoiceStatusNotice(null);

    const win = typeof window !== "undefined" ? (window as any) : null;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language === "te" ? "te-IN" : "en-IN";

        recognition.onstart = () => {
          setIsListeningVoice(true);
          setVoiceStatusNotice(t("listening"));
        };

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setDetailedExplanation(transcript);
            if (selectedService) {
              fetchGeminiAdvice(selectedService, transcript);
            }
          }
        };

        recognition.onerror = () => {
          setIsListeningVoice(false);
          setVoiceStatusNotice(null);
          startMediaRecorderVoice();
        };

        recognition.onend = () => {
          setIsListeningVoice(false);
          setVoiceStatusNotice(t("voice_converted"));
          setTimeout(() => setVoiceStatusNotice(null), 3000);
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch {}
    }

    startMediaRecorderVoice();
  };

  const startMediaRecorderVoice = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Microphone access is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsListeningVoice(false);
        setVoiceStatusNotice(t("ai_analyzing"));
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];
          try {
            const res = await fetch("/api/ai-transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audioBase64: base64Audio,
                mimeType: "audio/webm",
                language: language === "te" ? "te" : "en",
              }),
            });
            const data = await res.json();
            if (data.success && data.text) {
              setDetailedExplanation(data.text);
              if (selectedService) {
                fetchGeminiAdvice(selectedService, data.text);
              }
              setVoiceStatusNotice(t("voice_converted"));
            } else {
              setVoiceStatusNotice(null);
            }
          } catch {
            setVoiceStatusNotice(null);
          }
        };

        stream.getTracks().forEach((trk) => trk.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsListeningVoice(true);
      setVoiceStatusNotice(t("listening"));

      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, 8000);
    } catch {
      setIsListeningVoice(false);
      alert("Microphone permission denied. Please allow microphone access.");
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListeningVoice(false);
  };

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
          notes: detailedExplanation,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setActiveToken(data.data);
        setSelectedService(null);
        setDetailedExplanation("");
        setAiAdvice(null);
        setAlertNotice({
          type: "success",
          text: `Queue Ticket ${data.data.tokenNumber} issued & mapped to ${data.data.assignedEmployeeName || "Officer"} at ${data.data.assignedDesk || "Counter"}.`,
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
      <div className="min-h-screen bg-[#f5f5f7] text-slate-500 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-7 h-7 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs">{t("loading")}</p>
        </div>
      </div>
    );
  }

  // If user is NOT logged in, show sleek macOS Welcome Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans flex flex-col justify-between">
        {/* macOS Top App Bar */}
        <nav className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-30 shadow-2xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/50 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/50 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/50 inline-block"></span>
              <span className="ml-3 font-semibold text-slate-900 text-xs sm:text-sm tracking-tight">
                {t("app_title")}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />
            </div>
          </div>
        </nav>

        {/* Hero macOS Card */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 flex flex-col items-center justify-center text-center space-y-8">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-white/80 text-slate-700 border border-slate-300/80 shadow-2xs backdrop-blur-md">
              <ShieldCheckIcon size={13} className="text-emerald-700" />
              <span>{t("network_setup")}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {t("auth_gate_title")}
            </h1>

            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
              {t("auth_gate_subtitle")}
            </p>
          </div>

          {/* Action Window Card */}
          <div className="w-full max-w-md bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-2xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.06)] space-y-3.5">
            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-b from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 active:from-black active:to-slate-900 text-white font-medium text-xs transition shadow-sm flex items-center justify-center gap-2 cursor-pointer border border-slate-900/50"
            >
              <span>{t("gate_signin_btn")}</span>
            </Link>

            <div className="relative flex items-center justify-center py-1">
              <div className="border-t border-slate-200/80 w-full"></div>
              <span className="bg-white/90 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                {t("gate_or")}
              </span>
              <div className="border-t border-slate-200/80 w-full"></div>
            </div>

            <Link
              href="/register"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 font-medium text-xs border border-slate-300/80 transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <span>{t("gate_register_btn")}</span>
            </Link>
          </div>

          {/* Services Quick View */}
          <div className="w-full pt-6 border-t border-slate-200/80 space-y-3.5 text-left">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">
              {t("branch_service_categories")}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SERVICE_OPTIONS.map((srv) => {
                const meta = SERVICE_CATEGORY_MAP[srv];
                const keys = SERVICE_KEYS[srv];
                const deskName = getCategoryDeskName(meta.category, meta.label);

                return (
                  <div
                    key={srv}
                    className="p-3 rounded-xl bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-2xs text-xs flex items-start gap-2.5 hover:bg-white transition"
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {renderServiceIcon(meta.iconId, 14)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate text-[11px]">
                        {t(keys.nameKey)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {deskName}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-200/80 py-3 text-center text-[11px] text-slate-400 bg-white/50 backdrop-blur-md">
          {t("app_footer")}
        </footer>
      </div>
    );
  }

  // If user IS logged in, render sleek macOS App Dashboard
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans pb-16">
      {/* macOS Top Unified Toolbar */}
      <nav className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/50 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/50 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/50 inline-block"></span>
            </div>

            <div className="h-4 w-[1px] bg-slate-300/80 mx-1"></div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                {user.bankName}
              </span>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {user.bankCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />

            <button
              onClick={handleLogout}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100/90 text-slate-700 border border-slate-300/80 hover:bg-slate-200/90 transition cursor-pointer"
            >
              {t("sign_out")}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Notice Banner */}
        {alertNotice && (
          <div
            className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-2xs backdrop-blur-md ${
              alertNotice.type === "success"
                ? "bg-emerald-50/90 text-emerald-900 border border-emerald-200"
                : "bg-rose-50/90 text-rose-900 border border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckIcon size={14} className="shrink-0" />
              <span>{alertNotice.text}</span>
            </div>
            <button
              onClick={() => setAlertNotice(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Customer Header & Account Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Profile Details Window */}
          <div className="lg:col-span-7 bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                {t("verified_account")}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">{t("status_active")}</span>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {t("welcome_back")}, {user.fullName}
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">
                {t("dashboard_subtitle")}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                <div className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider">
                  {t("phone_status")}
                </div>
                <div className="text-xs font-semibold text-emerald-800 mt-1 flex items-center gap-1">
                  <CheckIcon size={12} />
                  <span>{t("phone_verified")}</span>
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                <div className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider">
                  {t("branch_code")}
                </div>
                <div className="text-xs font-bold text-slate-900 font-mono mt-1">
                  {user.bankCode}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 col-span-2 sm:col-span-1 shadow-2xs">
                <div className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider">
                  {t("permanent_address")}
                </div>
                <div className="text-xs font-medium text-slate-700 mt-1 truncate">
                  {user.permanentAddress}
                </div>
              </div>
            </div>
          </div>

          {/* Sleek macOS Dark Card Panel */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 text-white border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <BankIcon size={16} className="text-emerald-400" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
                    {user.bankName}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800/90 text-emerald-400 border border-slate-700">
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
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded-md border border-slate-700 transition cursor-pointer"
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
                  <div className="font-medium text-slate-200 mt-0.5 text-xs">
                    {user.fullName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-widest text-slate-400">
                    {t("registered_phone")}
                  </div>
                  <div className="font-mono text-slate-300 mt-0.5 text-xs">
                    {user.phone}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Active Token Queue Card with Mapped Employee & Desk */}
        {activeToken && (
          <div className="rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-300/80 p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                  <TicketIcon size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                      {t("live_queue_token")}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                      {activeToken.status}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-0.5">
                    {t(SERVICE_KEYS[activeToken.serviceType]?.nameKey || "srv_cash")}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => handleCancelToken(activeToken._id)}
                className="px-3 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-lg text-xs font-medium border border-slate-300 hover:border-rose-200 transition cursor-pointer self-start sm:self-center"
              >
                {t("cancel_ticket")}
              </button>
            </div>

            {/* Mapped Bank Employee & Assigned Counter Banner */}
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <UserIcon size={16} />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Assigned Bank Employee
                  </div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                    <span>{activeToken.assignedEmployeeName || "Counter Officer"}</span>
                    {activeToken.assignedEmployeeId && (
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-white text-slate-800 border border-slate-300 shadow-2xs">
                        ID: {activeToken.assignedEmployeeId}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-[11px] text-slate-500">Designated Counter:</span>
                <span className="text-xs font-bold text-slate-900 font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs">
                  {activeToken.assignedDesk || activeToken.categoryLabel}
                </span>
              </div>
            </div>

            {/* Token Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                <div className="text-[10px] uppercase font-semibold text-slate-400">
                  {t("your_token_number")}
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                  {activeToken.tokenNumber}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                <div className="text-[10px] uppercase font-semibold text-slate-400">
                  {t("designated_counter")}
                </div>
                <div className="text-xs font-bold text-slate-900 mt-1">
                  {getCategoryDeskName(activeToken.assignedCategory, activeToken.categoryLabel)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {activeToken.assignedDesk || activeToken.assignedCategory}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                <div className="text-[10px] uppercase font-semibold text-slate-400">
                  {t("queue_position")}
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  #{activeToken.queuePosition}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {t("ahead_in_line")}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                <div className="text-[10px] uppercase font-semibold text-slate-400">
                  {t("estimated_wait_time")}
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  ~{activeToken.estimatedWaitMinutes} <span className="text-xs font-normal text-slate-400">{t("mins")}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {t("based_on_live_load")}
                </div>
              </div>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-600">
              <span className="text-[11px]">
                {t("ticket_waiting_notice")}{" "}
                <strong className="text-slate-900 font-mono">{activeToken.tokenNumber}</strong>. Please approach <strong className="text-slate-900">{activeToken.assignedDesk || "the counter"}</strong> when called.
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {t("issued")}: {new Date(activeToken.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        )}

        {/* Section: Select Banking Service Query */}
        <section className="bg-white/90 backdrop-blur-xl border border-slate-300/80 rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {t("service_section_title")}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("service_section_subtitle")}
              </p>
            </div>

            {activeToken && (
              <div className="text-[11px] bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1 rounded-full self-start sm:self-center font-medium">
                {t("active_badge")}: <strong className="font-mono text-slate-900">{activeToken.tokenNumber}</strong>
              </div>
            )}
          </div>

          {/* 8 Banking Query Service Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {SERVICE_OPTIONS.map((serviceName) => {
              const meta = SERVICE_CATEGORY_MAP[serviceName];
              const keys = SERVICE_KEYS[serviceName];
              const isSelected = selectedService === serviceName;
              const deskName = getCategoryDeskName(meta.category, meta.label);

              return (
                <div
                  key={serviceName}
                  onClick={() => handleSelectService(serviceName)}
                  className={`rounded-xl p-3.5 border transition-all duration-150 cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-blue-500/30"
                      : "bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-2xs text-slate-900"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? "bg-slate-800 text-white"
                            : "bg-white border border-slate-200 text-slate-700"
                        }`}
                      >
                        {renderServiceIcon(meta.iconId, 15)}
                      </div>
                      <span
                        className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? "bg-slate-800 text-slate-300 border border-slate-700"
                            : "bg-white text-slate-600 border border-slate-200"
                        }`}
                      >
                        {meta.prefix} • ~{meta.avgMinutes} {t("mins")}
                      </span>
                    </div>

                    <h3 className="font-bold text-xs pt-1 truncate">
                      {t(keys.nameKey)}
                    </h3>

                    <p
                      className={`text-[11px] leading-relaxed line-clamp-2 ${
                        isSelected ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {t(keys.descKey)}
                    </p>
                  </div>

                  <div
                    className={`pt-2 border-t text-[10px] flex items-center justify-between ${
                      isSelected ? "border-slate-800 text-slate-400" : "border-slate-200/80 text-slate-500"
                    }`}
                  >
                    <span>{deskName}</span>
                    <span className="font-semibold text-[10px]">
                      {isSelected ? t("selected_check") : t("select_arrow")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Detailed Explanation & Gemini AI Evaluation Drawer */}
          {selectedService && (
            <div
              ref={drawerRef}
              className="bg-slate-50/90 border border-slate-300 rounded-xl p-5 space-y-4 shadow-sm animate-fadeIn"
            >
              {/* Drawer Title Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                    {renderServiceIcon(SERVICE_CATEGORY_MAP[selectedService].iconId, 16)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                      {t("confirm_token_for")}: {t(SERVICE_KEYS[selectedService]?.nameKey || "")}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {t("assigned_to")}{" "}
                      <strong className="text-slate-800">
                        {getCategoryDeskName(
                          SERVICE_CATEGORY_MAP[selectedService].category,
                          SERVICE_CATEGORY_MAP[selectedService].label
                        )}
                      </strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 self-end sm:self-center cursor-pointer"
                >
                  {t("change_selection")}
                </button>
              </div>

              {/* Detailed Explanation Text / Voice Input Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    {t("detailed_explanation")}
                  </label>
                  {/* Senior Citizen Voice Button */}
                  <button
                    type="button"
                    onClick={isListeningVoice ? stopVoiceInput : startVoiceInput}
                    title={t("senior_voice_helper")}
                    className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs ${
                      isListeningVoice
                        ? "bg-rose-600 text-white animate-pulse"
                        : "bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300"
                    }`}
                  >
                    <MicrophoneIcon size={13} className={isListeningVoice ? "animate-bounce" : "text-indigo-600"} />
                    <span>{isListeningVoice ? t("stop_listening") : t("voice_input_btn")}</span>
                  </button>
                </div>

                {voiceStatusNotice && (
                  <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2 animate-fadeIn">
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></div>
                    <span className="font-medium">{voiceStatusNotice}</span>
                  </div>
                )}

                <textarea
                  rows={2}
                  placeholder={t("detailed_explanation_placeholder")}
                  value={detailedExplanation}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDetailedExplanation(val);
                    if (selectedService) {
                      fetchGeminiAdvice(selectedService, val);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-inner resize-none"
                />
              </div>

              {/* Gemini AI Automatic Analysis & Checklist Box */}
              <div className="space-y-3 pt-1">
                {isAnalyzingAI && (
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2.5 text-xs text-slate-600">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium">{t("ai_analyzing")}</span>
                  </div>
                )}

                {aiAdvice && !isAnalyzingAI && (
                  <div className="bg-white/90 border border-slate-300/80 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
                    {/* Gemini AI Header Badge */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <SparklesIcon size={15} className="text-indigo-600" />
                        <span className="text-xs font-bold text-slate-900">
                          {t("ai_advisor_title")}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                        Gemini 2.5 Flash
                      </span>
                    </div>

                    {/* Verdict Banner (Mandatory Visit vs Digital Resolution) */}
                    <div
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        aiAdvice.requiresVisit
                          ? "bg-amber-50 border-amber-300 text-amber-950"
                          : "bg-emerald-50 border-emerald-300 text-emerald-950"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              aiAdvice.requiresVisit ? "bg-amber-600" : "bg-emerald-600"
                            }`}
                          ></span>
                          <span className="font-bold text-xs sm:text-sm">
                            {aiAdvice.visitVerdict}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-90 leading-relaxed pl-4">
                          {aiAdvice.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[10px] self-start sm:self-center shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-white/80 border border-black/10">
                          ⏱ {aiAdvice.estimatedCounterMinutes} {t("mins")}
                        </span>
                      </div>
                    </div>

                    {/* Mapped Bank Officer & Counter Desk */}
                    {(aiAdvice.mappedDepartment || aiAdvice.mappedEmployeeRole || aiAdvice.mappedDesk) && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                            <UserIcon size={14} />
                          </div>
                          <div>
                            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                              Assigned Officer & Counter
                            </div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                              <span>{aiAdvice.mappedEmployeeRole}</span>
                              {aiAdvice.mappedDesk && (
                                <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                                  {aiAdvice.mappedDesk}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {aiAdvice.mappedDepartment && (
                          <div className="text-[11px] font-medium text-slate-500 self-start sm:self-center">
                            Dept: <strong className="text-slate-800">{aiAdvice.mappedDepartment}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* If Visit NOT Required: Step-by-Step Digital Alternatives */}
                    {!aiAdvice.requiresVisit && aiAdvice.digitalAlternatives.length > 0 && (
                      <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckIcon size={13} className="text-emerald-600" />
                          <span>{t("ai_digital_alternatives")}</span>
                        </h4>
                        <ul className="space-y-1.5 text-xs text-slate-700 pl-1">
                          {aiAdvice.digitalAlternatives.map((alt, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                              <span className="text-emerald-700 font-bold mt-0.5">→</span>
                              <span>{alt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Aligned Document & Certificate Checklist */}
                    {aiAdvice.requiredDocuments && aiAdvice.requiredDocuments.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            📋 {t("ai_required_documents")}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {Object.values(checkedDocs).filter(Boolean).length} / {aiAdvice.requiredDocuments.length} ready
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {aiAdvice.requiredDocuments.map((doc, idx) => {
                            const isChecked = checkedDocs[doc.name];
                            return (
                              <div
                                key={idx}
                                onClick={() =>
                                  setCheckedDocs((prev) => ({
                                    ...prev,
                                    [doc.name]: !prev[doc.name],
                                  }))
                                }
                                className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2 ${
                                  isChecked
                                    ? "bg-emerald-50/70 border-emerald-300"
                                    : "bg-slate-50/70 border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!isChecked}
                                  onChange={() => {}}
                                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className={`text-xs font-semibold ${
                                        isChecked ? "line-through text-slate-500" : "text-slate-900"
                                      }`}
                                    >
                                      {doc.name}
                                    </span>
                                    <span
                                      className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-medium ${
                                        doc.isMandatory
                                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                                          : "bg-slate-100 text-slate-600 border border-slate-200"
                                      }`}
                                    >
                                      {doc.isMandatory ? t("ai_mandatory") : t("ai_optional")}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                    {doc.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Prerequisites & Best Visiting Time */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start pt-1">
                      {aiAdvice.prerequisites && aiAdvice.prerequisites.length > 0 && (
                        <div className="md:col-span-8 space-y-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                          <h4 className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">
                            ⚠️ {t("ai_prerequisites")}
                          </h4>
                          <ul className="space-y-1 text-[10px] text-slate-600 pl-1">
                            {aiAdvice.prerequisites.map((pre, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-slate-400">•</span>
                                <span>{pre}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-0.5">
                        <div className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">
                          ⏳ {t("ai_best_time")}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-900 font-mono">
                          {aiAdvice.bestTimeToVisit}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <form onSubmit={handleRequestToken} className="pt-2">
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedService(null)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-medium transition cursor-pointer shadow-2xs"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingToken}
                    className="px-5 py-2 bg-gradient-to-b from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 active:from-black text-white rounded-xl text-xs font-medium shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 border border-slate-900/50"
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
