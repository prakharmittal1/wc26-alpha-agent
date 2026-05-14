/**
 * POST /api/chat
 *
 * Streams the WC26 Alpha Agent's reasoning + final summary for the given
 * UI-message thread. Each request spawns the MCP servers (football +
 * prediction), runs the ToolLoopAgent, and tears the MCP servers down.
 */

import { createAgentUIStreamResponse } from "ai";

import { buildAgent } from "@/lib/agent/agent";
import { connectMcpClients } from "@/lib/agent/mcp";

// MCP needs child_process; Edge runtime can't spawn. Pin to Node.
export const runtime = "nodejs";
// Tool calls + MCP spawn can stretch past Vercel's default 10s budget.
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as { messages?: unknown };
  const uiMessages = body.messages;
  if (!Array.isArray(uiMessages)) {
    return Response.json(
      { error: "Body must be { messages: UIMessage[] }." },
      { status: 400 },
    );
  }

  const mcp = await connectMcpClients();
  const agent = buildAgent({ mcpTools: mcp.tools });

  return createAgentUIStreamResponse({
    agent,
    uiMessages,
    onFinish: async () => {
      await mcp.close();
    },
  });
}
