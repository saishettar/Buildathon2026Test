"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TenorLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm: { icon: 28, text: "text-base", gap: "gap-2" },
  md: { icon: 36, text: "text-xl", gap: "gap-2.5" },
  lg: { icon: 56, text: "text-3xl", gap: "gap-3" },
  xl: { icon: 80, text: "text-5xl", gap: "gap-4" },
};

export function TenorLogo({ size = "md", showText = true, className }: TenorLogoProps) {
  const s = SIZES[size];

  return (
    <div className={cn("flex items-center", s.gap, className)}>
      {/* Circle icon with mountain/chevron mark */}
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
          {/* Outer circle */}
          <circle
            cx="24"
            cy="24"
            r="21"
            strokeWidth="3.5"
            className="stroke-foreground"
            fill="none"
          />

          {/* Mountain / chevron shape */}
          <path
            d="M14 32 L24 18 L34 32"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-foreground"
            fill="none"
          />
          {/* Inner chevron accent */}
          <path
            d="M19 32 L24 24 L29 32"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-foreground"
            fill="none"
          />
        </svg>
      </div>

      {/* Wordmark — bold uppercase to match logo image */}
      {showText && (
        <span
          className={cn(
            "font-black tracking-wider uppercase text-foreground",
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
    <div className={cn("flex h-8 w-8 items-center justify-center", className)}>
      <svg viewBox="0 0 48 48" fill="none" className="h-6 w-6">
        <circle
          cx="24"
          cy="24"
          r="21"
          strokeWidth="3.5"
          className="stroke-foreground"
          fill="none"
        />
        <path
          d="M14 32 L24 18 L34 32"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-foreground"
          fill="none"
        />
        <path
          d="M19 32 L24 24 L29 32"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-foreground"
          fill="none"
        />
      </svg>
    </div>
  );
}
