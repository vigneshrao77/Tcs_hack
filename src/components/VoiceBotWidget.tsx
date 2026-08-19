"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  MicrophoneIcon,
  SpeakerIcon,
  SparklesIcon,
  CheckIcon,
} from "@/components/BankIcons";

export default function VoiceBotWidget() {
  const { language } = useLanguage();
  const isTelugu = language === "te";

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [responseTitle, setResponseTitle] = useState<string>("");
  const [responseText, setResponseText] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Stop audio on unmount
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

  const stopAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  const playVoiceResponse = async (text: string) => {
    if (!text || !text.trim()) return;
    stopAudio();

    try {
      const res = await fetch("/api/ai-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          language: isTelugu ? "te" : "en",
        }),
      });

      const data = await res.json();
      if (data.success && data.audioBase64) {
        const audioSrc = `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`;
        const audio = new Audio(audioSrc);
        audioElementRef.current = audio;

        audio.onplay = () => setIsPlayingAudio(true);
        audio.onended = () => {
          setIsPlayingAudio(false);
          audioElementRef.current = null;
        };
        audio.onerror = () => setIsPlayingAudio(false);

        await audio.play();
      } else if (typeof window !== "undefined" && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = isTelugu ? "te-IN" : "en-IN";
        utterance.onstart = () => setIsPlayingAudio(true);
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error("Voice playback error:", err);
      setIsPlayingAudio(false);
    }
  };

  const startVoiceCapture = async () => {
    stopAudio();
    setTranscript("");
    setResponseTitle("");
    setResponseText("");
    setStatusMessage(isTelugu ? "వింటోంది... మాట్లాడండి" : "Listening... Please speak your question");

    // 1. Live browser recognition for immediate visual feedback
    const win = typeof window !== "undefined" ? (window as any) : null;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = isTelugu ? "te-IN" : "en-IN";

        recognition.onresult = (event: any) => {
          let live = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            live += event.results[i][0].transcript;
          }
          if (live) setTranscript(live);
        };
        recognitionRef.current = recognition;
        recognition.start();
      } catch {}
    }

    // 2. High-fidelity audio recording for Sarvam AI STT
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
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          selectedMime = "audio/mp4";
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMime });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        setStatusMessage(isTelugu ? "Sarvam AI ప్రాసెస్ చేస్తోంది..." : "Sarvam AI processing audio...");

        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMime });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];
          try {
            // 1. Transcribe with Sarvam AI STT
            const sttRes = await fetch("/api/ai-transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audioBase64: base64Audio,
                mimeType: selectedMime,
                language: isTelugu ? "te" : "en",
              }),
            });
            const sttData = await sttRes.json();
            const transcribedText = sttData.text || transcript;

            if (transcribedText) {
              setTranscript(transcribedText);
              setStatusMessage(isTelugu ? "సలహా సిద్ధం చేస్తోంది..." : "Preparing voice advice...");

              // 2. Query Banking Advisor
              const adviceRes = await fetch("/api/ai-advisor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  serviceType: "General Enquiry",
                  queryText: transcribedText,
                  language: isTelugu ? "te" : "en",
                }),
              });
              const adviceData = await adviceRes.json();
              if (adviceData.success && adviceData.data) {
                const title = adviceData.data.visitVerdict || (isTelugu ? "బ్యాంకింగ్ సలహా" : "Banking Advice");
                const summary = adviceData.data.spokenSummary || adviceData.data.summary || "";
                setResponseTitle(title);
                setResponseText(summary);
                setStatusMessage("");
                playVoiceResponse(summary);
              }
            } else {
              setStatusMessage(isTelugu ? "వాయిస్ వినపడలేదు. మళ్ళీ ప్రయత్నించండి." : "Could not hear audio. Please try speaking again.");
            }
          } catch (err) {
            console.error("Voice bot workflow error:", err);
            setStatusMessage(isTelugu ? "ప్రాసెసింగ్ లోపం. దయచేసి మళ్ళీ ప్రయత్నించండి." : "Processing error. Please try again.");
          } finally {
            setIsProcessing(false);
          }
        };

        stream.getTracks().forEach((trk) => trk.stop());
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, 7000);
    } catch {
      setIsRecording(false);
      alert("Microphone permission was denied. Please allow microphone access to talk to the Voice Bot.");
    }
  };

  const stopVoiceCapture = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleQuickQuestion = (qText: string) => {
    setTranscript(qText);
    setIsProcessing(true);
    setStatusMessage(isTelugu ? "సలహా పరిశీలిస్తోంది..." : "Checking banking advice...");

    fetch("/api/ai-advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceType: "General Enquiry",
        queryText: qText,
        language: isTelugu ? "te" : "en",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const title = data.data.visitVerdict || (isTelugu ? "బ్యాంకింగ్ సలహా" : "Banking Advice");
          const summary = data.data.spokenSummary || data.data.summary || "";
          setResponseTitle(title);
          setResponseText(summary);
          setStatusMessage("");
          playVoiceResponse(summary);
        }
      })
      .catch(() => {
        setStatusMessage(isTelugu ? "లోపం జరిగింది" : "Error fetching advice");
      })
      .finally(() => {
        setIsProcessing(false);
      });
  };

  const sampleQuestions = isTelugu
    ? [
        "KYC కోసం బ్రాంచ్‌కు వెళ్ళాలా?",
        "గోల్డ్ లోన్ కోసం ఏ డాక్యుమెంట్లు కావాలి?",
        "బ్యాంకు పని వేళలు ఏమిటి?",
        "ATM పిన్ ఎలా సెట్ చేయాలి?",
      ]
    : [
        "Is branch visit mandatory for KYC?",
        "What documents needed for a gold loan?",
        "What are the branch operating hours?",
        "How to generate new ATM debit PIN?",
      ];

  return (
    <div className="fixed bottom-6 left-6 z-40 font-sans">
      {/* Expanded Voice Modal */}
      {isOpen ? (
        <div className="w-[340px] sm:w-[380px] bg-white border border-gray-900 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 animate-in fade-in slide-in-from-bottom-3">
          {/* Header */}
          <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-500 text-white flex items-center justify-center animate-pulse">
                <MicrophoneIcon size={14} />
              </div>
              <div>
                <h3 className="text-xs font-semibold tracking-tight">
                  {isTelugu ? "AI వాయిస్ అసిస్టెంట్" : "AI Voice Banking Bot"}
                </h3>
                <span className="text-[10px] text-gray-300 font-mono">
                  Sarvam AI & Gemini Speech-to-Speech
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopAudio();
                setIsOpen(false);
              }}
              className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 max-h-[460px] overflow-y-auto">
            {/* Interactive Microphone Button */}
            <div className="flex flex-col items-center justify-center py-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <button
                type="button"
                onClick={isRecording ? stopVoiceCapture : startVoiceCapture}
                disabled={isProcessing}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer shadow-md ${
                  isRecording
                    ? "bg-red-600 text-white ring-4 ring-red-200 animate-pulse scale-105"
                    : isProcessing
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-gray-900 hover:bg-black text-white hover:scale-105"
                }`}
              >
                <MicrophoneIcon size={24} className={isRecording ? "animate-bounce" : ""} />
              </button>

              <div className="text-center">
                <span className="text-xs font-semibold text-gray-900 block">
                  {isRecording
                    ? isTelugu
                      ? "మాట్లాడుతున్నారు... పూర్తయ్యాక నొక్కండి"
                      : "Listening... Tap to stop"
                    : isProcessing
                    ? isTelugu
                      ? "ప్రాసెస్ అవుతోంది..."
                      : "Processing voice..."
                    : isTelugu
                    ? "తెలుగు లేదా English లో మాట్లాడండి"
                    : "Tap & Speak in Telugu or English"}
                </span>
                <span className="text-[10px] text-gray-500">
                  {isTelugu ? "సహజమైన వాయిస్ ద్వారా సమాధానం వినండి" : "Voice question converted instantly"}
                </span>
              </div>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div className="p-2 rounded bg-blue-50 border border-blue-200 text-blue-900 text-xs text-center font-medium flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Transcribed User Question */}
            {transcript && (
              <div className="p-2.5 rounded bg-gray-100 border border-gray-200 text-xs space-y-1">
                <div className="text-[10px] uppercase font-mono font-semibold text-gray-500">
                  {isTelugu ? "మీరు అడిగిన ప్రశ్న:" : "You Asked:"}
                </div>
                <p className="text-gray-900 font-medium">"{transcript}"</p>
              </div>
            )}

            {/* AI Response Card */}
            {responseText && (
              <div className="p-3.5 rounded-lg bg-green-50 border border-green-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-green-900 font-semibold text-xs">
                    <SparklesIcon size={14} className="text-green-700" />
                    <span>{responseTitle || (isTelugu ? "AI వాయిస్ సమాధానం" : "AI Voice Advice")}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => (isPlayingAudio ? stopAudio() : playVoiceResponse(responseText))}
                    className="px-2 py-0.5 rounded bg-white text-green-900 border border-green-300 text-[11px] font-medium flex items-center gap-1 hover:bg-green-100 cursor-pointer"
                  >
                    <SpeakerIcon size={11} className={isPlayingAudio ? "animate-pulse text-green-600" : ""} />
                    <span>{isPlayingAudio ? (isTelugu ? "ఆపండి" : "Stop") : (isTelugu ? "🔊 మళ్ళీ వినండి" : "🔊 Listen")}</span>
                  </button>
                </div>

                <p className="text-green-950 text-[11px] leading-relaxed">
                  {responseText}
                </p>

                {/* Animated Waveform when playing */}
                {isPlayingAudio && (
                  <div className="flex items-center gap-1 pt-1 justify-center">
                    <span className="w-1 h-3 bg-green-600 animate-pulse"></span>
                    <span className="w-1 h-5 bg-green-600 animate-bounce"></span>
                    <span className="w-1 h-4 bg-green-600 animate-pulse"></span>
                    <span className="w-1 h-6 bg-green-600 animate-bounce"></span>
                    <span className="w-1 h-3 bg-green-600 animate-pulse"></span>
                    <span className="text-[10px] text-green-800 font-mono ml-1">
                      {isTelugu ? "వాయిస్ వినబడుతోంది..." : "Speaking response aloud..."}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Quick Sample Questions */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] uppercase font-mono font-semibold text-gray-500 block">
                {isTelugu ? "త్వరిత వాయిస్ ప్రశ్నలు:" : "Quick Questions to Tap:"}
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {sampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickQuestion(q)}
                    className="text-left px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-800 rounded border border-gray-200 text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span className="truncate">{q}</span>
                    <span className="text-gray-400 text-xs ml-1">🎙️</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Floating Left Badge / Docked Button */
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => {
              startVoiceCapture();
            }, 300);
          }}
          className="group flex items-center gap-2.5 bg-gray-900 hover:bg-black text-white px-4 py-2.5 rounded-full shadow-lg border border-gray-700 hover:scale-105 transition-all duration-150 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 animate-pulse shadow-xs">
            <MicrophoneIcon size={15} />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
              <span>{isTelugu ? "🎙️ AI వాయిస్ బాట్" : "🎙️ AI Voice Bot"}</span>
              <span className="text-[9px] bg-emerald-500 text-black font-semibold px-1 py-0.2 rounded font-mono">
                LIVE
              </span>
            </div>
            <span className="text-[10px] text-gray-300 block leading-tight">
              {isTelugu ? "మాట్లాడండి (తెలుగు / Eng)" : "Speak in Telugu or English"}
            </span>
          </div>
        </button>
      )}
    </div>
  );
}
