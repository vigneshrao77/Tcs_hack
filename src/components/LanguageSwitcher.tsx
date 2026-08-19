"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200 shadow-inner">
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1 ${
          language === "en"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <span>🇬🇧</span>
        <span>English</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage("te")}
        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1 ${
          language === "te"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <span>🇮🇳</span>
        <span>తెలుగు</span>
      </button>
    </div>
  );
}
