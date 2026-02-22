"use client";

import React from "react";

interface ScoreGaugeProps {
  score: number;
  size?: number;
}

export function ScoreGauge({ score, size = 180 }: ScoreGaugeProps) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const strokeDashoffset = circumference - progress;

  const getColor = (s: number) => {
    if (s <= 40) return { stroke: "#ef4444", text: "text-red-400", glow: "rgba(239,68,68,0.3)" };
    if (s <= 70) return { stroke: "#f59e0b", text: "text-amber-400", glow: "rgba(245,158,11,0.3)" };
    return { stroke: "#22c55e", text: "text-green-400", glow: "rgba(34,197,94,0.3)" };
  };

  const color = getColor(score);

  const getLabel = (s: number) => {
    if (s <= 40) return "Needs Attention";
    if (s <= 70) return "Room to Improve";
    return "Healthy";
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted/20"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: "stroke-dashoffset 1s ease-in-out",
              filter: `drop-shadow(0 0 8px ${color.glow})`,
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${color.text}`}>{score}</span>
          <span className="text-xs text-muted-foreground mt-0.5">/ 100</span>
        </div>
      </div>
      <span className={`mt-2 text-sm font-medium ${color.text}`}>
        {getLabel(score)}
      </span>
    </div>
  );
}
