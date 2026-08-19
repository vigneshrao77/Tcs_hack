"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { BankingServiceType } from "@/types/serviceTypes";
import {
  CheckIcon,
  SparklesIcon,
  UserIcon,
  MicrophoneIcon,
} from "@/components/BankIcons";

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

interface GeminiAdvisorProps {
  initialService?: BankingServiceType | null;
  onSelectService?: (service: BankingServiceType) => void;
}

// Declare webkitSpeechRecognition on window for TypeScript
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export default function GeminiAdvisor({
  initialService,
  onSelectService,
}: GeminiAdvisorProps) {
  const { t, language } = useLanguage();

  const [queryInput, setQueryInput] = useState<string>("");
  const [detailedExplanation, setDetailedExplanation] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>(initialService || "");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [advice, setAdvice] = useState<AIAdviceResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});

  // Voice recording state (Voice to Text for Seniors)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Update selectedService if prop changes
  useEffect(() => {
    if (initialService) {
      setSelectedService(initialService);
    }
  }, [initialService]);

  // Handle Voice-to-Text Speech Recognition (Web Speech API + Gemini Fallback)
  const startVoiceInput = () => {
    setErrorMsg(null);
    setVoiceNotice(null);

    const win = typeof window !== "undefined" ? (window as unknown as IWindow) : null;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language === "te" ? "te-IN" : "en-IN";

        recognition.onstart = () => {
          setIsListening(true);
          setVoiceNotice(t("listening"));
        };

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setDetailedExplanation(transcript);
            if (!queryInput) {
              setQueryInput(transcript);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          setIsListening(false);
          setVoiceNotice(null);
          // Fallback to MediaRecorder audio recording
          startMediaRecorderVoice();
        };

        recognition.onend = () => {
          setIsListening(false);
          setVoiceNotice(t("voice_converted"));
          setTimeout(() => setVoiceNotice(null), 3000);
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn("Speech recognition init failed, using MediaRecorder fallback:", err);
      }
    }

    startMediaRecorderVoice();
  };

  // Fallback: Record Audio Blob and transcribe via Gemini API (/api/ai-transcribe)
  const startMediaRecorderVoice = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Microphone access is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        setVoiceNotice(t("ai_analyzing"));
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // Convert Blob to Base64
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
              if (!queryInput) setQueryInput(data.text);
              setVoiceNotice(t("voice_converted"));
            } else {
              setVoiceNotice(null);
            }
          } catch (err) {
            console.error("Transcription failed:", err);
            setVoiceNotice(null);
          }
        };

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsListening(true);
      setVoiceNotice(t("listening"));

      // Automatically stop recording after 8 seconds
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, 8000);
    } catch (err) {
      console.error("Microphone access denied:", err);
      setIsListening(false);
      alert("Microphone permission denied. Please allow microphone access.");
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  const handleAnalyze = async (overrideQuery?: string, overrideService?: string) => {
    const q = overrideQuery !== undefined ? overrideQuery : queryInput;
    const s = overrideService !== undefined ? overrideService : selectedService;
    const fullQueryText = `${q} ${detailedExplanation}`.trim();

    if (!fullQueryText && !s) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: s,
          queryText: fullQueryText,
          language: language === "te" ? "te" : "en",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAdvice(data.data);
        setCheckedDocs({});
      } else {
        setErrorMsg(data.error || "Failed to analyze banking query.");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDocChecked = (docName: string) => {
    setCheckedDocs((prev) => ({
      ...prev,
      [docName]: !prev[docName],
    }));
  };

  const QUICK_QUERIES = [
    { label: "Lost Debit Card", service: "Card services", query: "I lost my debit card, need replacement" },
    { label: "KYC & Aadhaar Update", service: "KYC update", query: "Want to update KYC with Aadhaar & PAN" },
    { label: "Home / Car Loan", service: "Loan application", query: "Applying for ₹30 Lakh Home Loan" },
    { label: "High Cash Deposit", service: "Cash withdrawal or deposit", query: "Cash deposit of ₹1.5 Lakhs" },
    { label: "Address Change", service: "Address change", query: "Changed residence, need address update" },
  ];

  return (
    <div className="rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-300/80 p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-sm">
            <SparklesIcon size={16} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{t("ai_advisor_title")}</span>
              <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                Gemini 2.5 Flash
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {t("ai_advisor_subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {/* Senior Citizen Voice Assistant Button */}
          <button
            type="button"
            onClick={isListening ? stopVoiceInput : startVoiceInput}
            title={t("senior_voice_helper")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
              isListening
                ? "bg-rose-600 text-white animate-pulse ring-2 ring-rose-300"
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
            }`}
          >
            <MicrophoneIcon size={14} className={isListening ? "animate-bounce" : "text-indigo-600"} />
            <span>{isListening ? t("stop_listening") : t("voice_input_btn")}</span>
          </button>

          {advice && (
            <button
              type="button"
              onClick={() => {
                setAdvice(null);
                setQueryInput("");
                setDetailedExplanation("");
              }}
              className="text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer px-2 py-1"
            >
              ✕ {t("ai_close_advisory")}
            </button>
          )}
        </div>
      </div>

      {/* Voice Status Alert */}
      {voiceNotice && (
        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2 shadow-2xs animate-fadeIn">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping"></div>
          <span className="font-medium">{voiceNotice}</span>
        </div>
      )}

      {/* 2 Input Fields: Field 1 (Query) & Field 2 (Detailed Explanation Textbox) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAnalyze();
        }}
        className="space-y-3"
      >
        {/* Field 1: Core Query / Service Selection */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
            1. Core Banking Query / Service *
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder={t("ai_search_placeholder")}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-xs shadow-inner"
            />
          </div>
        </div>

        {/* Field 2: Dedicated Detailed Explanation Text Box */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              2. {t("detailed_explanation")}
            </label>
            <span className="text-[10px] text-slate-400 font-mono">
              Voice-to-Text Enabled 🎙️
            </span>
          </div>
          <div className="relative">
            <textarea
              rows={2}
              placeholder={t("detailed_explanation_placeholder")}
              value={detailedExplanation}
              onChange={(e) => setDetailedExplanation(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-xs resize-none shadow-inner"
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          {/* Quick Suggestion Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mr-1">
              Quick:
            </span>
            {QUICK_QUERIES.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setQueryInput(item.query);
                  setSelectedService(item.service);
                  handleAnalyze(item.query, item.service);
                }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 border border-slate-200 transition cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading || (!queryInput.trim() && !detailedExplanation.trim() && !selectedService)}
            className="px-5 py-2.5 bg-gradient-to-b from-slate-900 to-slate-800 hover:from-slate-800 text-white rounded-xl text-xs font-medium shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 border border-slate-900/50 shrink-0"
          >
            <SparklesIcon size={13} />
            <span>{isLoading ? t("ai_analyzing") : t("ai_consult_btn")}</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {errorMsg}
        </div>
      )}

      {/* AI Advice Output Card */}
      {advice && (
        <div className="bg-slate-50/80 border border-slate-300/80 rounded-xl p-4 sm:p-5 space-y-4 shadow-inner">
          {/* Verdict Banner */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              advice.requiresVisit
                ? "bg-amber-50 border-amber-300 text-amber-950"
                : "bg-emerald-50 border-emerald-300 text-emerald-950"
            }`}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    advice.requiresVisit ? "bg-amber-600" : "bg-emerald-600"
                  }`}
                ></span>
                <span className="font-bold text-xs sm:text-sm">
                  {advice.visitVerdict}
                </span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed pl-4">
                {advice.summary}
              </p>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px] self-start sm:self-center shrink-0">
              <span className="px-2 py-0.5 rounded-md bg-white/80 border border-black/10">
                ⏱ {advice.estimatedCounterMinutes} {t("mins")}
              </span>
            </div>
          </div>

          {/* Mapped Bank Officer & Counter Assignment Pill Box */}
          {(advice.mappedDepartment || advice.mappedEmployeeRole || advice.mappedDesk) && (
            <div className="bg-white/90 border border-slate-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <UserIcon size={15} />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Assigned Bank Officer & Counter
                  </div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                    <span>{advice.mappedEmployeeRole}</span>
                    {advice.mappedDesk && (
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {advice.mappedDesk}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {advice.mappedDepartment && (
                <div className="text-[11px] font-medium text-slate-500 self-start sm:self-center">
                  Department: <strong className="text-slate-800">{advice.mappedDepartment}</strong>
                </div>
              )}
            </div>
          )}

          {/* If Visit NOT Required: Digital Alternatives */}
          {!advice.requiresVisit && advice.digitalAlternatives.length > 0 && (
            <div className="space-y-2 bg-white/80 border border-slate-200 rounded-xl p-3.5">
              <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckIcon size={13} className="text-emerald-600" />
                <span>{t("ai_digital_alternatives")}</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-700 pl-1">
                {advice.digitalAlternatives.map((alt, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                    <span className="text-emerald-700 font-bold mt-0.5">→</span>
                    <span>{alt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Aligned Document & Certificate Checklist */}
          {advice.requiredDocuments && advice.requiredDocuments.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  📋 {t("ai_required_documents")}
                </h4>
                <span className="text-[10px] text-slate-400">
                  {Object.values(checkedDocs).filter(Boolean).length} / {advice.requiredDocuments.length} ready
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {advice.requiredDocuments.map((doc, idx) => {
                  const isChecked = checkedDocs[doc.name];
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleDocChecked(doc.name)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                        isChecked
                          ? "bg-emerald-50/70 border-emerald-300"
                          : "bg-white border-slate-200 hover:border-slate-300"
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
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start pt-1">
            {/* Prerequisites */}
            {advice.prerequisites && advice.prerequisites.length > 0 && (
              <div className="md:col-span-8 space-y-1.5 bg-white/80 border border-slate-200 rounded-xl p-3">
                <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  ⚠️ {t("ai_prerequisites")}
                </h4>
                <ul className="space-y-1 text-[11px] text-slate-600 pl-1">
                  {advice.prerequisites.map((pre, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-slate-400">•</span>
                      <span>{pre}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Visiting Timing Spec */}
            <div className="md:col-span-4 bg-white/80 border border-slate-200 rounded-xl p-3 space-y-1">
              <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                ⏳ {t("ai_best_time")}
              </div>
              <div className="text-xs font-semibold text-slate-900 font-mono">
                {advice.bestTimeToVisit}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {t("ai_est_counter_time")}: ~{advice.estimatedCounterMinutes} {t("mins")}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
