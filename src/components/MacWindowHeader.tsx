import React from "react";

interface MacWindowHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function MacWindowHeader({
  title,
  subtitle,
  className = "",
  children,
}: MacWindowHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 bg-gradient-to-b from-slate-100/90 to-slate-200/80 border-b border-slate-200/80 rounded-t-2xl select-none ${className}`}
    >
      {/* Traffic Light Buttons */}
      <div className="flex items-center gap-2 w-20">
        <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/50 shadow-2xs inline-block"></span>
        <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/50 shadow-2xs inline-block"></span>
        <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/50 shadow-2xs inline-block"></span>
      </div>

      {/* Centered Window Title */}
      <div className="flex-1 text-center min-w-0 px-2">
        {title && (
          <div className="text-xs font-semibold text-slate-700 truncate tracking-tight">
            {title}
          </div>
        )}
        {subtitle && (
          <div className="text-[10px] text-slate-500 truncate -mt-0.5">
            {subtitle}
          </div>
        )}
      </div>

      {/* Right side actions or spacer */}
      <div className="flex items-center justify-end gap-2 min-w-20">
        {children}
      </div>
    </div>
  );
}
