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
      className={`flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-200 rounded-t-lg select-none ${className}`}
    >
      {/* Institutional Security Status */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          Secure System
        </span>
      </div>

      {/* Centered Document / Section Title */}
      <div className="flex-1 text-center min-w-0 px-4">
        {title && (
          <div className="text-xs font-semibold text-gray-900 truncate">
            {title}
          </div>
        )}
        {subtitle && (
          <div className="text-[11px] text-gray-500 truncate">
            {subtitle}
          </div>
        )}
      </div>

      {/* Right Actions / Spacer */}
      <div className="flex items-center justify-end gap-2 min-w-20">
        {children}
      </div>
    </div>
  );
}
