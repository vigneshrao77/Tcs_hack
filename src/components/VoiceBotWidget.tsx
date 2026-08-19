"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  MicrophoneIcon,
  SpeakerIcon,
  SparklesIcon,
} from "@/components/BankIcons";

export default function VoiceBotWidget() {
  const { language } = useLanguage();
  const isTelugu = language === "te";

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [responseText, setResponseText] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const liveTranscriptRef = useRef<string>("");
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

    // Clean markdown symbols for natural speech synthesis
    const cleanSpeechText = text
      .replace(/[*#_`]/g, "")
      .replace(/•/g, "")
      .replace(/\n+/g, " ")
      .trim();

    try {
      const res = await fetch("/api/ai-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanSpeechText.slice(0, 500),
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
        const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
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

  const processQueryResponse = async (queryText: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) {
      setStatusMessage(
        isTelugu
          ? "వాయిస్ వినపడలేదు. దయచేసి మళ్ళీ స్పష్టంగా మాట్లాడండి."
          : "Could not detect speech. Please try speaking clearly."
      );
      setIsProcessing(false);
      return;
    }

    setTranscript(cleanQuery);
    setIsProcessing(true);
    setStatusMessage(isTelugu ? "AI సమాధానం సిద్ధం చేస్తోంది..." : "AI generating accurate response...");

    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", text: cleanQuery }],
          language: isTelugu ? "te" : "en",
        }),
      });

      const chatData = await chatRes.json();
      const answer =
        chatData.reply ||
        (isTelugu
          ? "మీ ప్రశ్నకు సమాధానం దొరకలేదు. దయచేసి బ్రాంచ్ కౌంటర్‌ను సంప్రదించండి."
          : "Could not find answer for this inquiry. Please consult the branch counter.");

      setResponseText(answer);
      setStatusMessage("");
      setIsProcessing(false);

      // Speak back the answer immediately
      playVoiceResponse(answer);
    } catch (err) {
      console.error("Voice bot query processing error:", err);
      setStatusMessage(isTelugu ? "ప్రాసెసింగ్ లోపం జరిగింది." : "Error generating response.");
      setIsProcessing(false);
    }
  };

  const startVoiceCapture = async () => {
    stopAudio();
    setTranscript("");
    setResponseText("");
    liveTranscriptRef.current = "";
    setStatusMessage(isTelugu ? "వింటోంది... మాట్లాడండి" : "Listening... Please speak your question");

    // 1. Live browser SpeechRecognition for instant transcription capture
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
          if (live) {
            liveTranscriptRef.current = live;
            setTranscript(live);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.warn("Speech recognition initialization:", err);
      }
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
        setStatusMessage(isTelugu ? "Sarvam AI పరిశీలిస్తోంది..." : "Transcribing with Sarvam AI...");

        const currentLiveTranscript = liveTranscriptRef.current.trim();

        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMime });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];
          let finalTranscription = currentLiveTranscript;

          try {
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
            if (sttData.success && sttData.text && sttData.text.trim()) {
              finalTranscription = sttData.text.trim();
            }
          } catch (sttErr) {
            console.warn("Sarvam STT failed, using live recognition text:", sttErr);
          }

          // Process the transcribed user speech and generate accurate response
          await processQueryResponse(finalTranscription || currentLiveTranscript);
        };

        stream.getTracks().forEach((trk) => trk.stop());
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Auto-stop after 8 seconds of speech recording
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, 8000);
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

  const sampleQuestions = isTelugu
    ? [
        "KYC అప్‌డేట్ కోసం ఏ డాక్యుమెంట్లు కావాలి?",
        "గోల్డ్ లోన్ మరియు పర్సనల్ లోన్ వివరాలు ఏమిటి?",
        "బ్యాంకు పని వేళలు & స్లాట్లు ఎప్పుడు ఉంటాయి?",
        "పోగొట్టుకున్న ATM కార్డును ఎలా బ్లాక్ చేయాలి?",
      ]
    : [
        "What documents are required for KYC update?",
        "How to apply for a personal loan?",
        "What are the branch working hours & time slots?",
        "How do I block a lost ATM card?",
      ];

  return (
    <div className="fixed bottom-6 left-6 z-40 font-sans">
      {/* Expanded Voice Modal */}
      {isOpen ? (
        <div className="w-[340px] sm:w-[400px] bg-white border border-gray-900 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 animate-in fade-in slide-in-from-bottom-3">
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
          <div className="p-4 space-y-3.5 max-h-[480px] overflow-y-auto">
            {/* Interactive Microphone Button */}
            <div className="flex flex-col items-center justify-center py-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
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
                      ? "మాట్లాడుతున్నారు... పూర్తయ్యాక ఇక్కడ నొక్కండి"
                      : "Listening... Tap button when done"
                    : isProcessing
                    ? isTelugu
                      ? "సమాధానం పరిశీలిస్తోంది..."
                      : "Analyzing question..."
                    : isTelugu
                    ? "నొక్కి మాట్లాడండి (తెలుగు / English)"
                    : "Tap to Speak (Telugu / English)"}
                </span>
                <span className="text-[10px] text-gray-500">
                  {isTelugu ? "స్పష్టమైన వాయిస్ ద్వారా ఖచ్చితమైన సమాధానం పొందండి" : "Speak naturally for instant voice response"}
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

            {/* Transcribed User Speech */}
            {transcript && (
              <div className="p-2.5 rounded bg-gray-100 border border-gray-200 text-xs space-y-1">
                <div className="text-[10px] uppercase font-mono font-semibold text-gray-500">
                  {isTelugu ? "మీరు అడిగిన ప్రశ్న:" : "You Asked:"}
                </div>
                <p className="text-gray-900 font-medium">"{transcript}"</p>
              </div>
            )}

            {/* Response Display with Speech Control */}
            {responseText && (
              <div className="p-3.5 rounded-lg bg-green-50 border border-green-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-green-900 font-semibold text-xs">
                    <SparklesIcon size={14} className="text-green-700" />
                    <span>{isTelugu ? "AI సమాధానం" : "AI Voice Response"}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => (isPlayingAudio ? stopAudio() : playVoiceResponse(responseText))}
                    className="px-2.5 py-1 rounded bg-white text-green-900 border border-green-300 text-[11px] font-medium flex items-center gap-1 hover:bg-green-100 cursor-pointer shadow-2xs"
                  >
                    <SpeakerIcon size={11} className={isPlayingAudio ? "animate-pulse text-green-600" : ""} />
                    <span>{isPlayingAudio ? (isTelugu ? "⏹️ ఆపండి" : "⏹️ Stop") : (isTelugu ? "🔊 మళ్ళీ వినండి" : "🔊 Listen")}</span>
                  </button>
                </div>

                <div className="text-green-950 text-[11px] leading-relaxed whitespace-pre-wrap">
                  {responseText}
                </div>

                {/* Animated Waveform when playing audio */}
                {isPlayingAudio && (
                  <div className="flex items-center gap-1 pt-1 justify-center border-t border-green-200">
                    <span className="w-1 h-3 bg-green-600 animate-pulse"></span>
                    <span className="w-1 h-5 bg-green-600 animate-bounce"></span>
                    <span className="w-1 h-4 bg-green-600 animate-pulse"></span>
                    <span className="w-1 h-6 bg-green-600 animate-bounce"></span>
                    <span className="w-1 h-3 bg-green-600 animate-pulse"></span>
                    <span className="text-[10px] text-green-800 font-mono ml-1.5 font-medium">
                      {isTelugu ? "వాయిస్ సమాధానం వినబడుతోంది..." : "Speaking response aloud..."}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Quick Sample Questions */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] uppercase font-mono font-semibold text-gray-500 block">
                {isTelugu ? "త్వరిత ప్రశ్నలు (నొక్కి వినండి):" : "Quick Sample Questions (Tap to Ask):"}
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {sampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => processQueryResponse(q)}
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
        /* Floating Left Badge */
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
