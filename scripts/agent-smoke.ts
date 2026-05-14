/**
 * scripts/agent-smoke.ts
 *
 * Runs the alpha agent against a one-off prompt and streams the agent's
 * tool calls + final answer to stdout. Useful for verifying that:
 *  - Local tools (query_historical_data, get_team_sentiment, calculate_ev)
 *    are wired up correctly.
 *  - MCP servers can be spawned (or, with MCP_DISABLED=1, that the agent
 *    runs to completion offline).
 *  - Gemini credentials are valid.
 *
 * Usage:
 *   tsx scripts/agent-smoke.ts --help
 *   tsx scripts/agent-smoke.ts --prompt "Should I bet YES on Mexico to beat USA in their next friendly?"
 *   MCP_DISABLED=1 tsx scripts/agent-smoke.ts --prompt "..."
 */

import { parseArgs } from "node:util";

import { config as loadEnv } from "dotenv";

import { buildAgent } from "@/lib/agent/agent";
import { connectMcpClients } from "@/lib/agent/mcp";

loadEnv({ path: ".env.local" });

function printHelp(): void {
  process.stdout.write(
    [
      "Usage: tsx scripts/agent-smoke.ts --prompt \"<question>\" [--no-stream]",
      "",
      "Options:",
      "  --prompt <q>   The user question. Required.",
      "  --no-stream    Use agent.generate() instead of streaming.",
      "  --help         Show this message.",
      "",
      "Env:",
      "  MCP_DISABLED=1   Skip spawning football + prediction MCP servers.",
      "  GEMINI_AGENT_MODEL=<id>  Override the agent's Gemini model.",
      "",
    ].join("\n"),
  );
}

type Args = { prompt: string; noStream: boolean };

function parseCli(): Args {
  const parsed = parseArgs({
    options: {
      prompt: { type: "string" },
      "no-stream": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (parsed.values.help) {
    printHelp();
    process.exit(0);
  }
  const prompt = parsed.values.prompt;
  if (!prompt) {
    printHelp();
    throw new Error("--prompt is required");
  }
  return { prompt, noStream: Boolean(parsed.values["no-stream"]) };
}

async function main(): Promise<void> {
  const args = parseCli();

  process.stdout.write(`\n[agent-smoke] connecting MCP servers...\n`);
  const mcp = await connectMcpClients();
  process.stdout.write(
    `[agent-smoke] mcp connected: football=${mcp.connected.football} prediction=${mcp.connected.prediction} ` +
      `mcp_tools=${Object.keys(mcp.tools).length}\n`,
  );

  const agent = buildAgent({ mcpTools: mcp.tools });

  try {
    if (args.noStream) {
      const result = await agent.generate({
        prompt: args.prompt,
        onStepFinish: ({ stepNumber, toolCalls, finishReason }) => {
          process.stdout.write(
            `[agent-smoke] step ${stepNumber}: finish=${finishReason} tools=[${(toolCalls ?? [])
              .map((t) => t.toolName)
              .join(", ")}]\n`,
          );
        },
      });
      process.stdout.write(`\n----- FINAL -----\n${result.text}\n`);
    } else {
      const stream = await agent.stream({
        prompt: args.prompt,
        onStepFinish: ({ stepNumber, toolCalls, finishReason }) => {
          process.stdout.write(
            `\n[agent-smoke] step ${stepNumber}: finish=${finishReason} tools=[${(toolCalls ?? [])
              .map((t) => t.toolName)
              .join(", ")}]\n`,
          );
        },
      });
      process.stdout.write(`\n----- STREAM -----\n`);
      for await (const chunk of stream.textStream) {
        process.stdout.write(chunk);
      }
      process.stdout.write(`\n`);
    }
  } finally {
    await mcp.close();
  }
}

main().catch((err) => {
  process.stderr.write(
    `[agent-smoke] FAILED: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + "\n");
  }
  process.exit(1);
});
