"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-md bg-gray-100 p-0.5 border border-gray-200">
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors duration-100 cursor-pointer ${
          language === "en"
            ? "bg-white text-gray-900 shadow-xs font-semibold"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => setLanguage("te")}
        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors duration-100 cursor-pointer ${
          language === "te"
            ? "bg-white text-gray-900 shadow-xs font-semibold"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        తెలుగు
      </button>
    </div>
  );
}
