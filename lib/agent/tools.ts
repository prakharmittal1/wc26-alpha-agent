/**
 * Local tools (no MCP) for the alpha agent.
 *
 * These wrap Phase 1 + Phase 2 storage and the deterministic EV math so
 * the LLM can request them by name from the tool loop.
 */

import { tool } from "ai";
import { z } from "zod";

import { embedQuery } from "@/lib/embeddings";
import { getServiceSupabase } from "@/lib/supabase/server";
import { canonicalizeTeam, WC2026_TEAMS } from "@/lib/teams";

// ---------------------------------------------------------------------------
// 1. query_historical_data -> match_playbook_docs RPC
// ---------------------------------------------------------------------------

export const queryHistoricalDataTool = tool({
  description:
    "Search the historical knowledge base (international match results + WC 2026 match-probability tables) using a natural-language query. Returns the most similar rows, ranked by cosine similarity over Gemini embeddings.",
  inputSchema: z.object({
    query: z
      .string()
      .min(3)
      .describe(
        "Question or phrase to search for, e.g. 'Mexico vs USA recent head-to-head results' or 'Brazil group D probability'.",
      ),
    match_count: z
      .number()
      .int()
      .min(1)
      .max(25)
      .default(8)
      .describe("How many rows to return."),
    filter: z
      .object({
        source: z
          .enum(["international_results", "wc2026_probabilities"])
          .optional(),
        home: z.string().optional(),
        away: z.string().optional(),
        tournament: z.string().optional(),
      })
      .optional()
      .describe(
        "Optional metadata filters. Keys correspond to columns in playbook_docs.metadata.",
      ),
  }),
  execute: async ({ query, match_count, filter }) => {
    const embedding = await embedQuery(query);
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.rpc("match_playbook_docs", {
      query_embedding: embedding as unknown as string,
      match_count,
      filter: filter ?? {},
    });
    if (error) {
      return { error: `match_playbook_docs failed: ${error.message}`, rows: [] };
    }
    return {
      rows: (data ?? []).map((r: {
        id: number;
        content: string;
        metadata: Record<string, unknown>;
        similarity: number;
      }) => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        similarity: Number(r.similarity.toFixed(4)),
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// 2. get_team_sentiment -> sentiment_scores (Phase 2 output)
// ---------------------------------------------------------------------------

export const getTeamSentimentTool = tool({
  description:
    "Look up the Reddit-derived sentiment score (Sent_d) for a national team over a recent window. Score is in roughly [-1, +1] using the spec formula: (N_pos - N_neg) / (N_pos + N_neutral + N_neg + 3). Higher = bullish.",
  inputSchema: z.object({
    team: z
      .string()
      .describe(
        "National team name. Aliases like 'USA', 'Brasil', 'El Tri' are accepted.",
      ),
    days: z
      .number()
      .int()
      .min(1)
      .max(60)
      .default(7)
      .describe("Look-back window in days (inclusive of today)."),
  }),
  execute: async ({ team, days }) => {
    const canonical = canonicalizeTeam(team);
    if (!canonical) {
      return {
        error: `Unknown team "${team}". Use a canonical WC 2026 team name.`,
        allowlist_sample: WC2026_TEAMS.slice(0, 8),
      };
    }
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("sentiment_scores")
      .select("date, n_pos, n_neg, n_neutral, score")
      .eq("team", canonical)
      .gte("date", cutoff)
      .order("date", { ascending: false });
    if (error) {
      return { error: `sentiment_scores lookup failed: ${error.message}` };
    }
    const rows = data ?? [];
    if (rows.length === 0) {
      return {
        team: canonical,
        days,
        rolling_score: null,
        daily: [],
        note: "No sentiment_scores rows yet; run `npm run sentiment` first.",
      };
    }
    // Volume-weighted rolling score over the window:
    //   (sum N_pos - sum N_neg) / (sum total + 3)
    let np = 0;
    let nn = 0;
    let nu = 0;
    for (const r of rows) {
      np += r.n_pos;
      nn += r.n_neg;
      nu += r.n_neutral;
    }
    const rolling = (np - nn) / (np + nu + nn + 3);
    return {
      team: canonical,
      days,
      rolling_score: Number(rolling.toFixed(4)),
      totals: { n_pos: np, n_neg: nn, n_neutral: nu },
      daily: rows,
    };
  },
});

// ---------------------------------------------------------------------------
// 3. calculate_ev -> deterministic EV math (no LLM)
// ---------------------------------------------------------------------------
//
// Expected Value of a YES position on a binary contract at price p_market,
// when our fair estimate is p_true and stake = 1 unit:
//
//   net_profit  = (1 / p_market) - 1
//   loss        = 1
//   EV(stake=1) = p_true * net_profit - (1 - p_true) * 1
//
// We also surface the spec's alpha-threshold check (|p_true - p_market| > 0.05).

export const calculateEvTool = tool({
  description:
    "Deterministically compute Expected Value (EV) for a YES position on a Polymarket-style contract. Provide p_true (your fair estimate) and p_market (the current trade price). Returns EV per 1 unit staked, the price gap, and whether the gap clears the spec's 0.05 alpha threshold.",
  inputSchema: z.object({
    p_true: z
      .number()
      .min(0)
      .max(1)
      .describe("Fair probability of the YES outcome, in [0, 1]."),
    p_market: z
      .number()
      .gt(0)
      .lt(1)
      .describe("Current Polymarket YES trade price, in (0, 1)."),
    stake: z
      .number()
      .positive()
      .default(1)
      .describe("Stake size in whatever currency unit. Default 1 unit."),
    side: z
      .enum(["yes", "no"])
      .default("yes")
      .describe(
        "Which side of the contract to evaluate. 'no' flips both prices.",
      ),
  }),
  execute: async ({ p_true, p_market, stake, side }) => {
    const pTrue = side === "yes" ? p_true : 1 - p_true;
    const pMkt = side === "yes" ? p_market : 1 - p_market;
    const netProfit = (1 / pMkt - 1) * stake;
    const loss = stake;
    const ev = pTrue * netProfit - (1 - pTrue) * loss;
    const edge = pTrue - pMkt;
    const alpha = Math.abs(edge) > 0.05;
    return {
      side,
      p_true_adjusted: Number(pTrue.toFixed(4)),
      p_market_adjusted: Number(pMkt.toFixed(4)),
      stake,
      net_profit_if_win: Number(netProfit.toFixed(4)),
      loss_if_lose: Number(loss.toFixed(4)),
      ev: Number(ev.toFixed(4)),
      edge: Number(edge.toFixed(4)),
      alpha_signal: alpha,
      alpha_threshold: 0.05,
      rationale: alpha
        ? `|p_true - p_market| = ${Math.abs(edge).toFixed(3)} > 0.05 -> ALPHA`
        : `|p_true - p_market| = ${Math.abs(edge).toFixed(3)} <= 0.05 -> no signal`,
    };
  },
});

export const localTools = {
  query_historical_data: queryHistoricalDataTool,
  get_team_sentiment: getTeamSentimentTool,
  calculate_ev: calculateEvTool,
} as const;
