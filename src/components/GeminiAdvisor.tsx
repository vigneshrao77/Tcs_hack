"use client";

import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { BankingServiceType } from "@/types/serviceTypes";
import { CheckIcon, SparklesIcon, UserIcon } from "@/components/BankIcons";

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

export default function GeminiAdvisor({
  initialService,
  onSelectService,
}: GeminiAdvisorProps) {
  const { t, language } = useLanguage();

  const [queryInput, setQueryInput] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>(initialService || "");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [advice, setAdvice] = useState<AIAdviceResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});

  const handleAnalyze = async (overrideQuery?: string, overrideService?: string) => {
    const q = overrideQuery !== undefined ? overrideQuery : queryInput;
    const s = overrideService !== undefined ? overrideService : selectedService;

    if (!q.trim() && !s) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: s,
          queryText: q,
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

        {advice && (
          <button
            type="button"
            onClick={() => {
              setAdvice(null);
              setQueryInput("");
            }}
            className="text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer self-start sm:self-center"
          >
            ✕ {t("ai_close_advisory")}
          </button>
        )}
      </div>

      {/* Query Search Bar */}
      <div className="space-y-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t("ai_search_placeholder")}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-xs shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || (!queryInput.trim() && !selectedService)}
            className="px-4 py-2.5 bg-gradient-to-b from-slate-900 to-slate-800 hover:from-slate-800 text-white rounded-xl text-xs font-medium shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 border border-slate-900/50"
          >
            <SparklesIcon size={13} />
            <span>{isLoading ? t("ai_analyzing") : t("ai_consult_btn")}</span>
          </button>
        </form>

        {/* Quick Suggestion Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mr-1">
            Quick Queries:
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
      </div>

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
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
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
