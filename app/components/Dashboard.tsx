"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useMemo, useCallback } from "react";

import { BrandMark } from "@/app/components/BrandMark";
import { MatchGrid } from "@/app/components/MatchGrid";
import { ReasoningLog } from "@/app/components/ReasoningLog";
import type { AgentUIMessage } from "@/lib/agent/agent";
import type { Fixture } from "@/lib/fixtures";

type Props = {
  fixtures: Fixture[];
};

function buildFixturePrompt(f: Fixture): string {
  return (
    `Analyze ${f.home} vs ${f.away} on ${f.kickoff_iso} (${f.competition}). ` +
    `Polymarket currently has the home-win YES contract at ${f.market_home_win.toFixed(2)}. ` +
    `Estimate P_true for ${f.home} winning and tell me if there is an alpha signal.`
  );
}

export function Dashboard({ fixtures }: Props) {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, stop, error, clearError } =
    useChat<AgentUIMessage>();

  const onAnalyzeFixture = useCallback(
    (f: Fixture) => {
      setActiveId(f.id);
      sendMessage({ text: buildFixturePrompt(f) });
    },
    [sendMessage],
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text) return;
      setActiveId(undefined);
      sendMessage({ text });
      setInput("");
    },
    [input, sendMessage],
  );

  const busy = status === "submitted" || status === "streaming";

  const assistantText = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return "";
    return lastAssistant.parts
      .filter((p): p is { type: "text"; text: string } & typeof p =>
        p.type === "text",
      )
      .map((p) => p.text)
      .join("");
  }, [messages]);

  const userTurns = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user")
        .map((m) =>
          m.parts
            .filter((p): p is { type: "text"; text: string } & typeof p => p.type === "text")
            .map((p) => p.text)
            .join(""),
        ),
    [messages],
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <BrandMark />
        <div className="flex flex-col gap-1 sm:items-end">
          <span className="brand-marquee font-mono text-[10px] font-bold uppercase tracking-[0.32em]">
            Live · 2026 cycle
          </span>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-right sm:text-3xl">
            Find mispriced contracts before <br className="hidden sm:block" />
            <span className="brand-marquee">the market reprices.</span>
          </h1>
        </div>
      </header>

      <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        Click a fixture below to run the agent against Polymarket, historical
        Elo, and the latest Reddit sentiment. Or type a question.
      </p>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            <span
              aria-hidden
              className="inline-block size-2 rounded-sm"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-magenta), var(--brand-lime))",
              }}
            />
            Road to 26 · Upcoming fixtures
          </h2>
          <span className="font-mono text-[10px] text-zinc-500">
            {fixtures.length} match{fixtures.length === 1 ? "" : "es"}
          </span>
        </div>
        <MatchGrid
          fixtures={fixtures}
          onAnalyze={onAnalyzeFixture}
          activeId={activeId}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-h-[40rem] flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              <span
                aria-hidden
                className="inline-block size-1.5 rounded-full"
                style={{ background: "var(--brand-magenta)" }}
              />
              Alpha Feed
            </span>
            <span className="flex items-center gap-2">
              {busy && (
                <span
                  className="flex items-center gap-1.5 font-mono text-[10px]"
                  style={{ color: "var(--brand-amber)" }}
                >
                  <span
                    className="inline-block size-1.5 animate-pulse rounded-full"
                    style={{ background: "var(--brand-amber)" }}
                  />
                  {status === "submitted" ? "submitting" : "streaming"}
                </span>
              )}
              {busy && (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="rounded border border-zinc-300 px-2 py-0.5 font-mono text-[10px] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  stop
                </button>
              )}
            </span>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {userTurns.length === 0 && !assistantText && (
              <div className="px-2 py-12 text-center text-sm text-zinc-500 dark:text-zinc-500">
                Pick a fixture above, or ask:
                <ul className="mt-3 space-y-1 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                  <li>&ldquo;Is Mexico mispriced for the next friendly?&rdquo;</li>
                  <li>&ldquo;Show me Brazil sentiment over the last 14 days&rdquo;</li>
                  <li>&ldquo;Quick EV: p_true 0.6 vs p_market 0.45, stake 100&rdquo;</li>
                </ul>
              </div>
            )}

            {userTurns.map((q, i) => (
              <div key={`u-${i}`} className="mb-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  you
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">
                  {q}
                </div>
              </div>
            ))}

            {assistantText && (
              <div className="mb-4">
                <div
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--brand-lime)" }}
                >
                  agent
                </div>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-zinc-900 dark:text-zinc-100">
                  {assistantText}
                </pre>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                <div className="font-semibold">Agent error</div>
                <div className="mt-1 break-words font-mono text-xs">
                  {error.message}
                </div>
                <button
                  type="button"
                  onClick={() => clearError()}
                  className="mt-2 rounded border border-rose-300 px-2 py-0.5 font-mono text-[10px] hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40"
                >
                  dismiss
                </button>
              </div>
            )}
          </div>

          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the agent..."
              disabled={busy}
              className="flex-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-[var(--brand-magenta)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-magenta)] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded px-4 py-1.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(95deg, var(--brand-magenta) 0%, var(--brand-tangerine) 100%)",
              }}
            >
              Run alpha
            </button>
          </form>
        </div>

        <ReasoningLog messages={messages} />
      </section>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-zinc-400">
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full"
            style={{ background: "var(--brand-magenta)" }}
          />
          Local tools: query_historical_data · get_team_sentiment · calculate_ev
        </span>
        <span aria-hidden>·</span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full"
            style={{ background: "var(--brand-lime)" }}
          />
          MCP: football_*, prediction_*
        </span>
        <span aria-hidden>·</span>
        <span className="opacity-70">
          Kickoff <span className="brand-marquee">11 Jun 2026</span> in Mexico City
        </span>
      </footer>
    </main>
  );
}
