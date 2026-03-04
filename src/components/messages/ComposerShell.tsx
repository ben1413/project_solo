"use client";

import React, { useRef, useLayoutEffect, useEffect } from "react";

interface ComposerShellProps {
  inputValue: string;
  onInputChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  isFocused?: boolean;
  disabled?: boolean;
}

export const ComposerShell = ({
  inputValue,
  onInputChange,
  onKeyDown,
  placeholder = "Message...",
  leftSlot,
  rightSlot,
  isFocused = false,
  disabled = false,
}: ComposerShellProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. Auto-resize logic (The "Elastic" effect)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Reset height to shrink if text was deleted
    el.style.height = "24px"; 
    const scrollHeight = el.scrollHeight;
    
    // Cap it at ~160px (approx 6-7 lines) before scrolling
    el.style.height = `${Math.min(scrollHeight, 160)}px`;
    el.style.overflowY = scrollHeight > 160 ? "auto" : "hidden";
  }, [inputValue]);

  // 2. Focus management
  useEffect(() => {
    if (isFocused && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isFocused]);

  return (
    <div 
      className={`
        relative flex items-end gap-3 p-3 rounded-[26px] border transition-all duration-200
        ${isFocused 
          ? "bg-neutral-900 border-neutral-700 ring-1 ring-neutral-700/50" 
          : "bg-neutral-900/40 border-neutral-800/60"
        }
      `}
    >
      {/* LEFT SLOT (Attachments) */}
      <div className="flex-shrink-0 pb-0.5 text-[var(--text-blue)] hover:text-[var(--text-blue)] transition-colors">
        {leftSlot}
      </div>

      {/* CENTER SLOT (Auto-growing Textarea) */}
      <div className="flex-1 min-w-0 py-1">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent text-[15px] text-[var(--text-blue)] placeholder:text-[var(--text-blue)] resize-none focus:outline-none custom-scrollbar leading-relaxed"
          style={{ maxHeight: "160px" }}
        />
      </div>

      {/* RIGHT SLOT (Mic / Wave / Send) */}
      <div className="flex-shrink-0 pb-0.5 flex items-center gap-2">
        {rightSlot}
      </div>
    </div>
  );
};
