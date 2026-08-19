"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { SparklesIcon, CheckIcon, BankIcon } from "@/components/BankIcons";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  time: string;
}

export default function ChatBotWidget() {
  const { language } = useLanguage();
  const isTelugu = language === "te";

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize initial greeting on mount / language change
  useEffect(() => {
    const welcomeMsg: ChatMessage = {
      id: "welcome-1",
      role: "model",
      text: isTelugu
        ? "నమస్కారం! నేను మీ స్మార్ట్ బ్యాంకింగ్ AI అసిస్టెంట్‌ని.\n\nమీరు ఏ బ్యాంకింగ్ సేవల గురించైనా అడగవచ్చు: లోన్లు, KYC అప్‌డేట్, నగదు డిపాజిట్, టోకెన్ సమయాలు మరియు అవసరమైన పత్రాలు.\n\nఈరోజు మీకు ఎలాంటి సహాయం కావాలి?"
        : "Hello! I am your Smart AI Banking Assistant.\n\nI can help you with loan eligibility, mandatory KYC documents, cash deposit limits, branch visit requirements, and booking token slots (9:00 AM – 5:00 PM).\n\nHow may I help you today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages([welcomeMsg]);
  }, [isTelugu]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: query,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputText("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, text: m.text })),
          language: isTelugu ? "te" : "en",
        }),
      });

      const data = await res.json();
      const botReply = data.reply || (isTelugu ? "సమాధానం ప్రాసెస్ చేయలేకపోయాము. దయచేసి మళ్ళీ ప్రయత్నించండి." : "Could not process response. Please try again.");

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: botReply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: isTelugu ? "నెట్‌వర్క్ లోపం. దయచేసి మళ్ళీ ప్రయత్నించండి." : "Network connection error. Please try again.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const sampleChips = isTelugu
    ? [
        "KYC కోసం ఏ డాక్యుమెంట్లు కావాలి?",
        "హోమ్ లోన్ ప్రాసెస్ ఏమిటి?",
        "బ్యాంకు పని వేళలు & స్లాట్లు?",
        "పోగొట్టుకున్న ATM కార్డు బ్లాక్ చేయడం ఎలా?",
      ]
    : [
        "What documents for KYC update?",
        "How to apply for a personal loan?",
        "Branch operating hours & slots?",
        "How to block a lost ATM card?",
      ];

  return (
    <div className="fixed bottom-6 right-6 z-40 font-sans">
      {/* Expanded Chat Window */}
      {isOpen ? (
        <div className="w-[340px] sm:w-[380px] h-[520px] bg-white border border-gray-900 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 animate-in fade-in slide-in-from-bottom-3">
          {/* Header */}
          <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center">
                <SparklesIcon size={14} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-semibold tracking-tight">
                    {isTelugu ? "స్మార్ట్ బ్యాంకింగ్ చాట్‌బాట్" : "Smart Banking AI Chat"}
                  </h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                </div>
                <span className="text-[10px] text-gray-300 font-mono">
                  Online • Gemini 1.5 Flash
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const welcomeMsg: ChatMessage = {
                    id: "welcome-1",
                    role: "model",
                    text: isTelugu
                      ? "చాట్ రీసెట్ చేయబడింది. నేను మీకు ఎలా సహాయపడగలను?"
                      : "Chat cleared. How can I help you today?",
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  };
                  setMessages([welcomeMsg]);
                }}
                title="Clear Chat"
                className="text-gray-400 hover:text-white text-[11px] px-1.5 py-0.5 rounded cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-gray-50/50">
            {messages.map((m) => {
              const isBot = m.role === "model";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                      isBot
                        ? "bg-white border border-gray-200 text-gray-900 shadow-xs"
                        : "bg-gray-900 text-white shadow-xs"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 px-1 font-mono">
                    {m.time}
                  </span>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-2.5 max-w-[120px] shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-[10px] text-gray-500 font-mono ml-1">Typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Query Chips */}
          <div className="px-3 py-1.5 bg-white border-t border-gray-100 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {sampleChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip)}
                className="whitespace-nowrap px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-medium border border-gray-200 transition-colors cursor-pointer shrink-0"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Message Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              placeholder={isTelugu ? "మీ ప్రశ్నను టైప్ చేయండి..." : "Type your banking query..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900 transition-colors"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="px-3 py-2 rounded-md bg-gray-900 hover:bg-black text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
            >
              {isTelugu ? "పంపు" : "Send"}
            </button>
          </form>
        </div>
      ) : (
        /* Floating Right Badge / Docked Button */
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2.5 bg-gray-900 hover:bg-black text-white px-4 py-2.5 rounded-full shadow-lg border border-gray-700 hover:scale-105 transition-all duration-150 cursor-pointer"
        >
          <div className="text-right">
            <div className="text-xs font-bold leading-tight flex items-center justify-end gap-1.5">
              <span className="text-[9px] bg-blue-500 text-white font-semibold px-1 py-0.2 rounded font-mono">
                AI 24/7
              </span>
              <span>{isTelugu ? "💬 బ్యాంకింగ్ చాట్‌బాట్" : "💬 Banking Chatbot"}</span>
            </div>
            <span className="text-[10px] text-gray-300 block leading-tight">
              {isTelugu ? "ఏ సందేహమైనా అడగండి" : "Ask anything about banking"}
            </span>
          </div>
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <SparklesIcon size={15} />
          </div>
        </button>
      )}
    </div>
  );
}
