"use client";

import { isToolUIPart, getToolName } from "ai";
import { useEffect, useRef } from "react";

import type { AgentUIMessage } from "@/lib/agent/agent";

type ToolEvent = {
  msgId: string;
  index: number;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  toolName: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function eventsFor(messages: AgentUIMessage[]): ToolEvent[] {
  const out: ToolEvent[] = [];
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    m.parts.forEach((part, index) => {
      if (!isToolUIPart(part)) return;
      const p = part as unknown as {
        state: ToolEvent["state"];
        input?: unknown;
        output?: unknown;
        errorText?: string;
      };
      out.push({
        msgId: m.id,
        index,
        state: p.state,
        toolName: getToolName(part),
        input: p.input,
        output: p.output,
        errorText: p.errorText,
      });
    });
  }
  return out;
}

const STATE_BADGE: Record<
  ToolEvent["state"],
  { label: string; style: React.CSSProperties }
> = {
  "input-streaming": {
    label: "calling",
    style: {
      background: "color-mix(in srgb, var(--brand-amber) 18%, transparent)",
      color: "var(--brand-amber)",
    },
  },
  "input-available": {
    label: "running",
    style: {
      background: "color-mix(in srgb, var(--brand-amber) 18%, transparent)",
      color: "var(--brand-amber)",
    },
  },
  "output-available": {
    label: "ok",
    style: {
      background: "color-mix(in srgb, var(--brand-lime) 18%, transparent)",
      color: "var(--brand-lime)",
    },
  },
  "output-error": {
    label: "error",
    style: {
      background: "color-mix(in srgb, var(--brand-magenta) 18%, transparent)",
      color: "var(--brand-magenta)",
    },
  },
};

function prettyJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function shortJson(v: unknown, max = 220): string {
  const s = typeof v === "string" ? v : prettyJson(v);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function ReasoningLog({ messages }: { messages: AgentUIMessage[] }) {
  const events = eventsFor(messages);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length, messages]);

  return (
    <aside
      className="flex h-full min-h-[40rem] flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="Agent reasoning log"
    >
      <header className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full"
            style={{ background: "var(--brand-lime)" }}
          />
          Reasoning Log
        </span>
        <span className="font-mono text-[10px] text-zinc-400">
          {events.length} step{events.length === 1 ? "" : "s"}
        </span>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-2">
        {events.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-zinc-500 dark:text-zinc-500">
            Idle. Click a match above or ask a question to start the agent.
          </div>
        ) : (
          <ol className="space-y-2">
            {events.map((e, i) => {
              const badge = STATE_BADGE[e.state];
              return (
                <li
                  key={`${e.msgId}-${e.index}-${e.state}`}
                  className="rounded-md border border-zinc-200 bg-zinc-50/70 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-zinc-400">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-mono text-xs font-medium text-zinc-950 dark:text-zinc-50">
                        {e.toolName}
                      </span>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={badge.style}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {e.input !== undefined && (
                    <pre
                      className="mt-2 max-h-32 overflow-auto rounded border border-l-2 bg-white p-2 font-mono text-[11px] leading-tight text-zinc-700"
                      style={{
                        borderColor: "rgba(0,0,0,0.08)",
                        borderLeftColor: "var(--brand-sky)",
                      }}
                    >
                      {shortJson(e.input)}
                    </pre>
                  )}
                  {e.state === "output-available" && e.output !== undefined && (
                    <pre
                      className="mt-1 max-h-40 overflow-auto rounded border border-l-2 p-2 font-mono text-[11px] leading-tight"
                      style={{
                        background:
                          "color-mix(in srgb, var(--brand-lime) 7%, #fff)",
                        borderColor:
                          "color-mix(in srgb, var(--brand-lime) 25%, transparent)",
                        borderLeftColor: "var(--brand-lime)",
                        color: "color-mix(in srgb, var(--brand-lime) 60%, #000)",
                      }}
                    >
                      {shortJson(e.output)}
                    </pre>
                  )}
                  {e.state === "output-error" && (
                    <pre
                      className="mt-1 max-h-32 overflow-auto rounded border border-l-2 p-2 font-mono text-[11px] leading-tight"
                      style={{
                        background:
                          "color-mix(in srgb, var(--brand-magenta) 7%, #fff)",
                        borderColor:
                          "color-mix(in srgb, var(--brand-magenta) 30%, transparent)",
                        borderLeftColor: "var(--brand-magenta)",
                        color:
                          "color-mix(in srgb, var(--brand-magenta) 65%, #000)",
                      }}
                    >
                      {e.errorText ?? "(no error text)"}
                    </pre>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}
