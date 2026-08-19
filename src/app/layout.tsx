import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Core Banking • Operations & Queue Suite",
  description: "Enterprise bank operations, counter token dispatch, and queue analytics",
};

import BotWidgetsWrapper from "@/components/BotWidgetsWrapper";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f5f5f7] text-[#1d1d1f] selection:bg-blue-500/20 selection:text-blue-900">
        <LanguageProvider>
          {children}
          <BotWidgetsWrapper />
        </LanguageProvider>
      </body>
    </html>
  );
}
