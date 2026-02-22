"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TenorLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm: { icon: 28, text: "text-base" },
  md: { icon: 36, text: "text-xl" },
  lg: { icon: 56, text: "text-3xl" },
  xl: { icon: 80, text: "text-5xl" },
};

export function TenorLogo({ size = "md", showText = true, className }: TenorLogoProps) {
  const s = SIZES[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* Icon Mark */}
      <div
        className="relative shrink-0"
        style={{ width: s.icon, height: s.icon }}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Background rounded square */}
          <rect
            x="2"
            y="2"
            width="44"
            height="44"
            rx="12"
            className="fill-foreground dark:fill-white"
            fillOpacity={0.05}
            stroke="url(#tenor-gradient)"
            strokeWidth="2"
          />

          {/* Inner glow circle */}
          <circle cx="24" cy="24" r="16" fill="url(#tenor-gradient)" fillOpacity={0.08} />

          {/* Stylized T — vertical stem */}
          <rect x="21" y="14" width="6" height="22" rx="3" fill="url(#tenor-gradient)" />

          {/* Stylized T — horizontal bar */}
          <rect x="12" y="12" width="24" height="6" rx="3" fill="url(#tenor-gradient)" />

          {/* Data flow dot — top left */}
          <circle cx="14" cy="15" r="2" className="fill-cyan-400 dark:fill-cyan-400" opacity={0.9}>
            <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Data flow dot — top right */}
          <circle cx="34" cy="15" r="2" className="fill-violet-400 dark:fill-violet-400" opacity={0.9}>
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Data flow dot — bottom */}
          <circle cx="24" cy="34" r="2" className="fill-emerald-400 dark:fill-emerald-400" opacity={0.7}>
            <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2.5s" repeatCount="indefinite" />
          </circle>

          {/* Flow lines */}
          <path
            d="M14 17 L21 24"
            stroke="url(#tenor-gradient)"
            strokeWidth="1"
            strokeOpacity={0.3}
            strokeLinecap="round"
          />
          <path
            d="M34 17 L27 24"
            stroke="url(#tenor-gradient)"
            strokeWidth="1"
            strokeOpacity={0.3}
            strokeLinecap="round"
          />

          <defs>
            <linearGradient id="tenor-gradient" x1="0" y1="0" x2="48" y2="48">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Wordmark */}
      {showText && (
        <span
          className={cn(
            "font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent",
            s.text
          )}
        >
          Tenor
        </span>
      )}
    </div>
  );
}

/** Mini icon-only version for compact spaces */
export function TenorIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20", className)}>
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <rect x="9.5" y="6" width="5" height="13" rx="2.5" fill="url(#ti-grad)" />
        <rect x="5" y="5" width="14" height="4.5" rx="2.25" fill="url(#ti-grad)" />
        <defs>
          <linearGradient id="ti-grad" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
