"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-md bg-slate-100 p-0.5 border border-slate-200 shadow-2xs font-sans">
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
          language === "en"
            ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => setLanguage("te")}
        className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
          language === "te"
            ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        తెలుగు
      </button>
    </div>
  );
}
