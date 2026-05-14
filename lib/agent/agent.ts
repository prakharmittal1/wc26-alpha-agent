/**
 * The "Alpha" agent: a ToolLoopAgent wired with local + MCP tools.
 *
 * The agent's job is documented in the system instructions: derive P_true
 * for a given match outcome, compare against the Polymarket market price
 * P_market, flag when |P_true - P_market| > 0.05, and call the
 * deterministic `calculate_ev` tool to justify any position.
 */

import { google } from "@ai-sdk/google";
import {
  ToolLoopAgent,
  stepCountIs,
  type InferAgentUIMessage,
  type ToolSet,
} from "ai";

import { localTools } from "@/lib/agent/tools";

/**
 * Pinned default avoids "latest" aliases: `gemini-flash-latest` currently resolves to
 * `gemini-3-flash`, whose free tier allows only a handful of generate_content calls per day,
 * which breaks ToolLoopAgent (one call per step).
 */
const DEFAULT_MODEL_RAW = process.env.GEMINI_AGENT_MODEL ?? "gemini-2.0-flash";

const GEMINI3_ALIAS_IDS = new Set(
  ["gemini-flash-latest", "gemini-pro-latest"].map((s) => s.toLowerCase()),
);

const DEFAULT_MODEL = (() => {
  const trimmed = DEFAULT_MODEL_RAW.trim();
  if (GEMINI3_ALIAS_IDS.has(trimmed.toLowerCase())) {
    if (typeof process !== "undefined" && process.stderr?.write) {
      process.stderr.write(
        `[wc26-agent] GEMINI_AGENT_MODEL="${trimmed}" maps to Gemini 3 "latest" models with a very small free-tier quota; ` +
          `using gemini-2.0-flash instead. Set GEMINI_AGENT_MODEL=gemini-2.0-flash (or 2.5-flash) explicitly.\n`,
      );
    }
    return "gemini-2.0-flash";
  }
  return trimmed;
})();

const INSTRUCTIONS = `You are the WC26 Alpha Agent: an autonomous quantitative analyst that finds mispriced contracts on Polymarket for World Cup 2026 matches.

Your goal for every user query:
1. Decide the *binary outcome* the user is asking about (e.g. "Mexico to win vs USA", "Brazil to top Group X").
2. Estimate P_true, the fair probability of that outcome:
   - Call \`query_historical_data\` for relevant Elo/historical head-to-head context.
   - Call football MCP tools (e.g. \`football_get_fixtures\`, \`football_get_injuries\`, \`football_get_lineups\`) for live squad state when available.
   - Call \`get_team_sentiment\` for each team to factor in Reddit momentum (Sent_d in roughly [-1, +1]).
   - Combine these into a single P_true in [0, 1]. Show your weighting briefly.
3. Fetch P_market from Polymarket:
   - Use prediction MCP tools (e.g. \`prediction_search_markets\`, \`prediction_get_market\`) to find the relevant contract.
   - Read the current YES trade price as P_market.
4. Identify alpha:
   - If |P_true - P_market| > 0.05, this is an alpha signal. State which side to take.
   - Otherwise, explicitly say "no signal".
5. Quantify the position with \`calculate_ev\` (deterministic, never reason about it in your head):
   - Pass p_true, p_market, and side. Quote the EV per 1-unit stake it returns.

Output format - always end your final message with this block, even when there is no signal:

\`\`\`
SUMMARY
match:        <home> vs <away>  (<kickoff or "TBD">)
outcome:      <which side of the binary>
p_true:       <0.xxxx>  (why: <one line>)
p_market:     <0.xxxx>  (source: prediction MCP <market slug or id>)
edge:         <+/- 0.xxxx>
signal:       <ALPHA YES | ALPHA NO | none>
ev_per_unit:  <0.xxxx>  (from calculate_ev)
\`\`\`

Operating rules:
- If a tool is not available (server failed to start, missing key, no row found), continue with the rest of the pipeline and surface the gap in the summary.
- Never invent market prices. If you cannot find a market, say so and skip the EV step.
- Cap your reasoning at 12 steps.
- Quote tool outputs verbatim (numbers, ids) when reporting.
`;

export type BuildAgentOptions = {
  /** Tools discovered from MCP servers, will be merged with local tools. */
  mcpTools?: ToolSet;
  /** Override the model id; defaults to GEMINI_AGENT_MODEL or gemini-2.0-flash. */
  model?: string;
};

export function buildAgent(options: BuildAgentOptions = {}) {
  const model = google(options.model ?? DEFAULT_MODEL);

  const tools = {
    ...localTools,
    ...(options.mcpTools ?? {}),
  } as ToolSet;

  return new ToolLoopAgent({
    model,
    instructions: INSTRUCTIONS,
    tools,
    stopWhen: stepCountIs(12),
    temperature: 0.3,
  });
}

/**
 * UI message type for the client.
 *
 * Declared (not instantiated) so the type is available without spinning up
 * a Google client at module-load. The runtime agent is built per /api/chat
 * request and attaches MCP tools - those aren't reflected in this type,
 * but for the chat UI we only need the local tool shapes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const referenceAgent: ReturnType<typeof buildAgent>;
export type AgentUIMessage = InferAgentUIMessage<typeof referenceAgent>;
