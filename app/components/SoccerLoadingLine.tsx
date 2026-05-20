"use client";

import { useEffect, useState } from "react";

import { pickSoccerLoadingMessage } from "@/lib/loading-copy";

type Props = {
  className?: string;
  /** Rotate to a new line every N ms while mounted. */
  intervalMs?: number;
};

export function SoccerLoadingLine({ className, intervalMs = 2800 }: Props) {
  const [message, setMessage] = useState(pickSoccerLoadingMessage);

  useEffect(() => {
    const id = window.setInterval(() => {
      setMessage(pickSoccerLoadingMessage());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return (
    <span className={className} aria-live="polite">
      {message}
    </span>
  );
}
