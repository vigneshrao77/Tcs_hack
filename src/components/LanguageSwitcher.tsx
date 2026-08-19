"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-lg bg-slate-200/70 p-0.5 border border-black/5 shadow-inner backdrop-blur-md">
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 cursor-pointer ${
          language === "en"
            ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)] font-semibold"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => setLanguage("te")}
        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 cursor-pointer ${
          language === "te"
            ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)] font-semibold"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        తెలుగు
      </button>
    </div>
  );
}
