"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  BankingServiceType,
  CounterCategory,
  SERVICE_CATEGORY_MAP,
} from "@/types/serviceTypes";
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
  CheckIcon,
  SparklesIcon,
  MicrophoneIcon,
  SpeakerIcon,
  UserIcon,
} from "@/components/BankIcons";

interface UserProfile {
  id: string;
  fullName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  phone: string;
  permanentAddress: string;
}

interface ServiceTokenData {
  _id: string;
  tokenNumber: string;
  accountNumber: string;
  customerName: string;
  serviceType: BankingServiceType;
  assignedCategory: CounterCategory;
  categoryLabel: string;
  assignedEmployeeName: string;
  assignedEmployeeId: string;
  assignedDesk: string;
  status: "waiting" | "called" | "in_service" | "completed" | "cancelled";
  queuePosition: number;
  estimatedWaitMinutes: number;
  createdAt: string;
}

interface RequiredDocument {
  name: string;
  description: string;
  isMandatory: boolean;
}

interface AIAdviceResponse {
  requiresVisit: boolean;
  visitVerdict: string;
  summary: string;
  spokenSummary?: string;
  mappedDepartment: string;
  mappedEmployeeRole: string;
  mappedDesk: string;
  digitalAlternatives: string[];
  requiredDocuments: RequiredDocument[];
  prerequisites: string[];
  estimatedCounterMinutes: number;
  bestTimeToVisit: string;
}

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

const SERVICE_KEYS: Record<BankingServiceType, { nameKey: string; descKey: string }> = {
  "Cash withdrawal or deposit": {
    nameKey: "srv_cash_name",
    descKey: "srv_cash_desc",
  },
  "Account opening and closing": {
    nameKey: "srv_account_name",
    descKey: "srv_account_desc",
  },
  "Loan enquiry": {
    nameKey: "srv_loan_enquiry_name",
    descKey: "srv_loan_enquiry_desc",
  },
  "Loan application": {
    nameKey: "srv_loan_app_name",
    descKey: "srv_loan_app_desc",
  },
  "KYC update": {
    nameKey: "srv_kyc_name",
    descKey: "srv_kyc_desc",
  },
  "Cheque services": {
    nameKey: "srv_cheque_name",
    descKey: "srv_cheque_desc",
  },
  "Address change": {
    nameKey: "srv_address_name",
    descKey: "srv_address_desc",
  },
  "Card services": {
    nameKey: "srv_card_name",
    descKey: "srv_card_desc",
  },
};

export default function DashboardPage() {
  const router = useRouter();
  const { t, language } = useLanguage();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeToken, setActiveToken] = useState<ServiceTokenData | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  const [selectedService, setSelectedService] = useState<BankingServiceType | null>(null);
  const [detailedExplanation, setDetailedExplanation] = useState<string>("");
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [voiceStatusNotice, setVoiceStatusNotice] = useState<string | null>(null);

  const [aiAdvice, setAiAdvice] = useState<AIAdviceResponse | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<boolean>(false);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});

  // Speech-to-Speech State
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isSynthesizingSpeech, setIsSynthesizingSpeech] = useState<boolean>(false);

  const [isSubmittingToken, setIsSubmittingToken] = useState<boolean>(false);
  const [alertNotice, setAlertNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const drawerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Check Local Auth State on Mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("bank_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } else {
        router.push("/login");
      }
    } catch {
      localStorage.removeItem("bank_user");
      router.push("/login");
    } finally {
      setIsCheckingAuth(false);
    }
  }, [router]);

  // Fetch Active Token Status
  useEffect(() => {
    if (!user) return;

    const fetchTokenStatus = async () => {
      try {
        const res = await fetch(
          `/api/tokens?accountNumber=${encodeURIComponent(user.accountNumber)}&bankCode=${encodeURIComponent(user.bankCode)}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          setActiveToken(data.data);
        } else {
          setActiveToken(null);
        }
      } catch (err) {
        console.error("Failed to fetch token status:", err);
      }
    };

    fetchTokenStatus();
    const interval = setInterval(fetchTokenStatus, 8000);
    return () => clearInterval(interval);
  }, [user]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const getCategoryDeskName = (category: CounterCategory, defaultLabel: string) => {
    switch (category) {
      case "cashCounters":
        return t("counter_cash");
      case "loanOfficers":
        return t("counter_loan");
      case "customerService":
        return t("counter_customer");
      case "accountAndKyc":
        return t("counter_account");
      case "managers":
        return t("counter_manager");
      default:
        return defaultLabel;
    }
  };

  const renderServiceIcon = (iconId: string, size = 16) => {
    switch (iconId) {
      case "CashIcon":
      case "cash":
        return <CashIcon size={size} />;
      case "UserPlusIcon":
      case "AccountIcon":
      case "account":
        return <AccountIcon size={size} />;
      case "BriefcaseIcon":
      case "LoanIcon":
      case "loan":
        return <LoanIcon size={size} />;
      case "ShieldCheckIcon":
      case "KycIcon":
      case "kyc":
        return <KycIcon size={size} />;
      case "FileTextIcon":
      case "ChequeIcon":
      case "cheque":
        return <ChequeIcon size={size} />;
      case "MapPinIcon":
      case "AddressIcon":
      case "address":
        return <AddressIcon size={size} />;
      case "CreditCardIcon":
      case "CardIcon":
      case "card":
        return <CardIcon size={size} />;
      default:
        return <TicketIcon size={size} />;
    }
  };

  // Service Selection Trigger
  const handleSelectService = (serviceName: BankingServiceType) => {
    setSelectedService(serviceName);
    setDetailedExplanation("");
    setAiAdvice(null);
    setCheckedDocs({});
    stopSpeechAudio();

    fetchGeminiAdvice(serviceName, "", false);

    setTimeout(() => {
      drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  // Automatic Gemini AI Evaluation
  const fetchGeminiAdvice = async (
    service: BankingServiceType,
    explanation: string,
    autoPlayVoice = false
  ) => {
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
      if (res.ok && data.success && data.data) {
        setAiAdvice(data.data);

        // Auto-play voice advice for Speech-to-Speech workflow
        if (autoPlayVoice) {
          const speechText = data.data.spokenSummary || data.data.summary || data.data.visitVerdict;
          playSpeechAudio(speechText);
        }
      }
    } catch (err) {
      console.error("AI Advisor evaluation failed:", err);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Speech-to-Speech Audio Player Handler
  const stopSpeechAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setIsSynthesizingSpeech(false);
  };

  const playSpeechAudio = async (customText?: string) => {
    if (isPlayingAudio) {
      stopSpeechAudio();
      return;
    }

    const textToSpeak = (
      customText ||
      aiAdvice?.spokenSummary ||
      aiAdvice?.summary ||
      aiAdvice?.visitVerdict ||
      ""
    ).trim();

    if (!textToSpeak) return;

    setIsSynthesizingSpeech(true);

    try {
      const res = await fetch("/api/ai-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSpeak,
          language: language === "te" ? "te" : "en",
        }),
      });

      const data = await res.json();

      if (data.success && data.audioBase64) {
        const audioSrc = `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`;
        const audio = new Audio(audioSrc);
        audioElementRef.current = audio;

        audio.onplay = () => {
          setIsSynthesizingSpeech(false);
          setIsPlayingAudio(true);
        };
        audio.onended = () => {
          setIsPlayingAudio(false);
          audioElementRef.current = null;
        };
        audio.onerror = () => {
          setIsPlayingAudio(false);
          setIsSynthesizingSpeech(false);
        };

        await audio.play();
      } else if (typeof window !== "undefined" && window.speechSynthesis) {
        // Fallback to browser Web Speech API
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = language === "te" ? "te-IN" : "en-IN";
        utterance.onstart = () => {
          setIsSynthesizingSpeech(false);
          setIsPlayingAudio(true);
        };
        utterance.onend = () => {
          setIsPlayingAudio(false);
        };
        utterance.onerror = () => {
          setIsPlayingAudio(false);
          setIsSynthesizingSpeech(false);
        };
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error("Speech synthesis failed:", err);
      setIsPlayingAudio(false);
      setIsSynthesizingSpeech(false);
    }
  };

  // Senior Citizen Voice-to-Text Input Handler using Sarvam AI STT
  const startVoiceInput = async () => {
    setVoiceStatusNotice(null);
    stopSpeechAudio();

    // 1. Live speech feedback
    const win = typeof window !== "undefined" ? (window as any) : null;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language === "te" ? "te-IN" : "en-IN";

        recognition.onresult = (event: any) => {
          let liveText = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            liveText += event.results[i][0].transcript;
          }
          if (liveText) {
            setDetailedExplanation(liveText);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.warn("Live speech recognition not started:", err);
      }
    }

    // 2. High-fidelity audio recording for Sarvam AI (saarika:v2.5)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Microphone access is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let selectedMime = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          selectedMime = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          selectedMime = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          selectedMime = "audio/ogg;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          selectedMime = "audio/mp4";
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
      });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsListeningVoice(false);
        setVoiceStatusNotice(t("ai_analyzing"));

        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMime });
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
                mimeType: selectedMime,
                language: language === "te" ? "te" : "en",
              }),
            });
            const data = await res.json();
            if (data.success && data.text) {
              setDetailedExplanation(data.text);
              if (selectedService) {
                // Trigger Gemini evaluation and automatically speak back the advice (Speech-to-Speech)
                fetchGeminiAdvice(selectedService, data.text, true);
              }
              setVoiceStatusNotice(`✓ Transcribed via Sarvam AI (saarika:v2.5)`);
              setTimeout(() => setVoiceStatusNotice(null), 4000);
            } else if (data.error) {
              setVoiceStatusNotice(`Sarvam AI: ${data.error}`);
              setTimeout(() => setVoiceStatusNotice(null), 4000);
            } else {
              setVoiceStatusNotice(null);
            }
          } catch {
            setVoiceStatusNotice(null);
          }
        };

        stream.getTracks().forEach((trk) => trk.stop());
      };

      mediaRecorder.start(250);
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
      alert("Microphone permission denied. Please allow microphone access in your browser.");
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
    stopSpeechAudio();
    localStorage.removeItem("bank_user");
    setUser(null);
    setActiveToken(null);
    router.push("/login");
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
          notes: detailedExplanation.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setActiveToken(data.data);
        setSelectedService(null);
        setDetailedExplanation("");
        stopSpeechAudio();
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
      const res = await fetch(
        `/api/tokens/${tokenId}?accountNumber=${encodeURIComponent(user?.accountNumber || "")}`,
        {
          method: "DELETE",
          headers: { "x-account-number": user?.accountNumber || "" },
        }
      );
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

  // Loading skeleton
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] text-gray-500 flex items-center justify-center font-mono text-xs">
        Loading core banking services...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] font-sans pb-16">
      {/* Top Institutional Navigation Bar */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-gray-900 text-white flex items-center justify-center font-bold text-xs">
              <BankIcon size={14} />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">
                {user.bankName}
              </span>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                {user.bankCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 font-mono">
              <span>{user.fullName}</span>
              <span>•</span>
              <span className="text-gray-900 font-medium">{user.accountNumber}</span>
            </div>

            <LanguageSwitcher />

            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-medium px-2.5 py-1 rounded bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
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
            className={`p-3.5 rounded-md text-xs font-medium flex items-center justify-between border ${
              alertNotice.type === "success"
                ? "bg-green-50 text-green-900 border-green-200"
                : "bg-red-50 text-red-900 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckIcon size={14} className="shrink-0" />
              <span>{alertNotice.text}</span>
            </div>
            <button
              onClick={() => setAlertNotice(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Customer Account & Institutional Details */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
                  {user.fullName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                  {t("status_active")}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {t("dashboard_subtitle")} • Branch {user.bankName} ({user.bankCode})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-500 uppercase">{t("account_number")}:</span>
              <span className="text-sm font-semibold font-mono text-gray-900">
                {user.accountNumber}
              </span>
              <button
                type="button"
                onClick={handleCopyAccount}
                className="text-[11px] bg-gray-50 hover:bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 transition-colors cursor-pointer"
              >
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
            <div>
              <span className="text-[11px] text-gray-400 uppercase font-medium">Registered Mobile</span>
              <div className="font-mono text-gray-800 font-medium mt-0.5">{user.phone}</div>
            </div>
            <div>
              <span className="text-[11px] text-gray-400 uppercase font-medium">Assigned Branch</span>
              <div className="text-gray-800 font-medium mt-0.5">{user.bankName} ({user.bankCode})</div>
            </div>
            <div>
              <span className="text-[11px] text-gray-400 uppercase font-medium">Permanent Address</span>
              <div className="text-gray-800 font-medium mt-0.5 truncate">{user.permanentAddress}</div>
            </div>
          </div>
        </div>

        {/* Live Active Token Queue Card */}
        {activeToken && (
          <div className="bg-white border border-gray-900 rounded-lg p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gray-900 text-white flex items-center justify-center">
                  <TicketIcon size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-green-50 text-green-800 border border-green-200 font-semibold">
                      {t("live_queue_token")}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 uppercase">
                      {activeToken.status}
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900 mt-0.5">
                    {t(SERVICE_KEYS[activeToken.serviceType]?.nameKey || "srv_cash")}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCancelToken(activeToken._id)}
                className="px-3 py-1 bg-white hover:bg-red-50 hover:text-red-700 text-gray-700 rounded text-xs font-medium border border-gray-300 hover:border-red-200 transition-colors cursor-pointer self-start sm:self-center"
              >
                {t("cancel_ticket")}
              </button>
            </div>

            {/* Assigned Staff & Desk */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded bg-gray-800 text-white flex items-center justify-center shrink-0">
                  <UserIcon size={13} />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-gray-400">
                    Assigned Bank Employee
                  </div>
                  <div className="text-xs font-semibold text-gray-900 flex items-center gap-2 mt-0.5">
                    <span>{activeToken.assignedEmployeeName || "Counter Officer"}</span>
                    {activeToken.assignedEmployeeId && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-gray-700 border border-gray-200">
                        {activeToken.assignedEmployeeId}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-xs text-gray-500">Designated Desk:</span>
                <span className="text-xs font-semibold text-gray-900 font-mono bg-white px-2.5 py-1 rounded border border-gray-200">
                  {activeToken.assignedDesk || activeToken.categoryLabel}
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="text-[11px] text-gray-500">{t("your_token_number")}</div>
                <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                  {activeToken.tokenNumber}
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="text-[11px] text-gray-500">{t("designated_counter")}</div>
                <div className="text-xs font-semibold text-gray-900 mt-1">
                  {getCategoryDeskName(activeToken.assignedCategory, activeToken.categoryLabel)}
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                  {activeToken.assignedDesk || activeToken.assignedCategory}
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="text-[11px] text-gray-500">{t("queue_position")}</div>
                <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                  #{activeToken.queuePosition}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{t("ahead_in_line")}</div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="text-[11px] text-gray-500">{t("estimated_wait_time")}</div>
                <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                  ~{activeToken.estimatedWaitMinutes} <span className="text-xs font-normal text-gray-400">{t("mins")}</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{t("based_on_live_load")}</div>
              </div>
            </div>
          </div>
        )}

        {/* Section: 8 Banking Query Service Cards */}
        <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 tracking-tight">
                {t("service_section_title")}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {t("service_section_subtitle")}
              </p>
            </div>

            {activeToken && (
              <span className="text-xs text-gray-500 font-mono">
                Active Ticket: <strong className="text-gray-900">{activeToken.tokenNumber}</strong>
              </span>
            )}
          </div>

          {/* Grid */}
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
                  className={`rounded-lg p-3.5 border transition-colors duration-100 cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? "bg-gray-50 border-gray-900 ring-1 ring-gray-900"
                      : "bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50/50"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-7 h-7 rounded flex items-center justify-center ${
                          isSelected ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {renderServiceIcon(meta.iconId, 14)}
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">
                        {meta.prefix} • ~{meta.avgMinutes} {t("mins")}
                      </span>
                    </div>

                    <h3 className="font-semibold text-xs text-gray-900 pt-1">
                      {t(keys.nameKey)}
                    </h3>

                    <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                      {t(keys.descKey)}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-gray-100 text-[11px] flex items-center justify-between text-gray-500">
                    <span>{deskName}</span>
                    <span className="font-medium text-gray-900">
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
              className="bg-gray-50 border border-gray-300 rounded-lg p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-gray-900 text-white flex items-center justify-center shrink-0">
                    {renderServiceIcon(SERVICE_CATEGORY_MAP[selectedService].iconId, 15)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-xs sm:text-sm">
                      {t("confirm_token_for")}: {t(SERVICE_KEYS[selectedService]?.nameKey || "")}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      {t("assigned_to")}{" "}
                      <strong className="text-gray-800">
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
                  onClick={() => {
                    stopSpeechAudio();
                    setSelectedService(null);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-900 cursor-pointer"
                >
                  {t("change_selection")}
                </button>
              </div>

              {/* Detailed Explanation Text / Sarvam Voice */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-700">
                    {t("detailed_explanation")}
                  </label>

                  <button
                    type="button"
                    onClick={isListeningVoice ? stopVoiceInput : startVoiceInput}
                    title={t("senior_voice_helper")}
                    className={`text-xs px-2.5 py-1 rounded font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-100 ${
                      isListeningVoice
                        ? "bg-red-600 text-white animate-pulse"
                        : "bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 shadow-xs"
                    }`}
                  >
                    <MicrophoneIcon size={12} className={isListeningVoice ? "animate-bounce" : "text-gray-700"} />
                    <span>{isListeningVoice ? t("stop_listening") : t("voice_input_btn")}</span>
                  </button>
                </div>

                {voiceStatusNotice && (
                  <div className="p-2 rounded bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    <span>{voiceStatusNotice}</span>
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
                      fetchGeminiAdvice(selectedService, val, false);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 resize-none"
                />
              </div>

              {/* Gemini AI Analysis Box & Speech-to-Speech Audio */}
              <div className="space-y-3 pt-1">
                {isAnalyzingAI && (
                  <div className="p-3 rounded-md bg-white border border-gray-200 flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></span>
                    <span className="font-medium">{t("ai_analyzing")}</span>
                  </div>
                )}

                {aiAdvice && !isAnalyzingAI && (
                  <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3 shadow-xs">
                    {/* Header with Speech-to-Speech Audio Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <SparklesIcon size={14} className="text-gray-800" />
                        <span className="text-xs font-semibold text-gray-900">
                          {t("ai_advisor_title")}
                        </span>
                      </div>

                      {/* Interactive Speech-to-Speech Audio Button */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => playSpeechAudio()}
                          disabled={isSynthesizingSpeech}
                          className={`text-xs px-2.5 py-1 rounded font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-100 ${
                            isPlayingAudio
                              ? "bg-gray-900 text-white shadow-xs"
                              : "bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300"
                          }`}
                        >
                          <SpeakerIcon size={12} className={isPlayingAudio ? "animate-pulse text-green-400" : "text-gray-700"} />
                          <span>
                            {isSynthesizingSpeech
                              ? "Synthesizing voice..."
                              : isPlayingAudio
                              ? t("stop_voice_advice")
                              : t("play_voice_advice")}
                          </span>

                          {/* Soundwave animation indicator when playing */}
                          {isPlayingAudio && (
                            <span className="inline-flex items-center gap-0.5 ml-1">
                              <span className="w-1 h-3 bg-green-400 animate-pulse"></span>
                              <span className="w-1 h-4 bg-green-400 animate-bounce"></span>
                              <span className="w-1 h-2 bg-green-400 animate-pulse"></span>
                            </span>
                          )}
                        </button>

                        <span className="text-[10px] font-mono text-gray-500 hidden sm:inline">
                          {t("speech_to_speech_badge")}
                        </span>
                      </div>
                    </div>

                    {/* Verdict Banner */}
                    <div
                      className={`p-3 rounded border text-xs ${
                        aiAdvice.requiresVisit
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-green-50 border-green-200 text-green-900"
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            aiAdvice.requiresVisit ? "bg-amber-600" : "bg-green-600"
                          }`}
                        ></span>
                        <span>{aiAdvice.visitVerdict}</span>
                      </div>
                      <p className="mt-1 pl-4 opacity-90 leading-relaxed text-[11px]">
                        {aiAdvice.summary}
                      </p>
                    </div>

                    {/* Digital Alternatives */}
                    {!aiAdvice.requiresVisit && aiAdvice.digitalAlternatives.length > 0 && (
                      <div className="space-y-1.5 bg-gray-50 border border-gray-200 rounded p-3 text-xs">
                        <div className="font-medium text-gray-900">
                          {t("ai_digital_alternatives")}
                        </div>
                        <ul className="space-y-1 text-gray-700 pl-1">
                          {aiAdvice.digitalAlternatives.map((alt, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                              <span className="text-gray-400">•</span>
                              <span>{alt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Document Checklist */}
                    {aiAdvice.requiredDocuments && aiAdvice.requiredDocuments.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-800">{t("ai_required_documents")}</span>
                          <span className="text-[10px] text-gray-400 font-mono">
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
                                className={`p-2.5 rounded border transition-colors cursor-pointer flex items-start gap-2 ${
                                  isChecked
                                    ? "bg-green-50 border-green-200"
                                    : "bg-gray-50 border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!isChecked}
                                  onChange={() => {}}
                                  className="mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900 pointer-events-none"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className={`text-xs font-medium ${
                                        isChecked ? "line-through text-gray-400" : "text-gray-900"
                                      }`}
                                    >
                                      {doc.name}
                                    </span>
                                    <span
                                      className={`text-[9px] px-1 py-0.2 rounded font-mono font-medium ${
                                        doc.isMandatory
                                          ? "bg-red-50 text-red-700 border border-red-200"
                                          : "bg-gray-100 text-gray-600 border border-gray-200"
                                      }`}
                                    >
                                      {doc.isMandatory ? t("ai_mandatory") : t("ai_optional")}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                                    {doc.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Action */}
              <form onSubmit={handleRequestToken} className="pt-2">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopSpeechAudio();
                      setSelectedService(null);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded text-xs font-medium transition-colors cursor-pointer"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingToken}
                    className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white rounded text-xs font-medium shadow-xs transition-colors duration-100 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmittingToken ? t("generating_token") : t("confirm_generate_ticket")}
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
