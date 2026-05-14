/**
 * MCP client wiring for the alpha agent.
 *
 * Spawns two stdio MCP servers per request:
 *   - football: mcp-football-server (API-Football wrapper)
 *   - prediction: prediction-mcp (Polymarket + Kalshi)
 *
 * Each server is best-effort: a missing API key or a server-side crash is
 * logged but does not break the request. Tools are prefixed (`football_*`,
 * `prediction_*`) so the agent's local tool names never collide with names
 * the servers emit.
 *
 * Set MCP_DISABLED=1 in env to skip both servers entirely (offline dev).
 */

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { ToolSet } from "ai";

export type McpHandle = {
  tools: ToolSet;
  connected: { football: boolean; prediction: boolean };
  close: () => Promise<void>;
};

const SPAWN_TIMEOUT_MS = 25_000;

async function connectFootball(): Promise<MCPClient | null> {
  if (!process.env.RAPIDAPI_KEY) {
    process.stderr.write(
      "[mcp] football: RAPIDAPI_KEY not set, skipping mcp-football-server.\n",
    );
    return null;
  }
  try {
    return await withTimeout(
      createMCPClient({
        transport: new Experimental_StdioMCPTransport({
          command: "npx",
          args: ["-y", "mcp-football-server"],
          env: {
            RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
            RAPIDAPI_HOST:
              process.env.RAPIDAPI_HOST ?? "v3.football.api-sports.io",
          },
          stderr: "pipe",
        }),
      }),
      SPAWN_TIMEOUT_MS,
      "mcp-football-server",
    );
  } catch (err) {
    process.stderr.write(
      `[mcp] football: failed to start (${(err as Error).message}). Continuing without.\n`,
    );
    return null;
  }
}

async function connectPrediction(): Promise<MCPClient | null> {
  try {
    return await withTimeout(
      createMCPClient({
        transport: new Experimental_StdioMCPTransport({
          command: "npx",
          args: ["-y", "prediction-mcp"],
          stderr: "pipe",
        }),
      }),
      SPAWN_TIMEOUT_MS,
      "prediction-mcp",
    );
  } catch (err) {
    process.stderr.write(
      `[mcp] prediction: failed to start (${(err as Error).message}). Continuing without.\n`,
    );
    return null;
  }
}

function prefixTools(prefix: string, tools: ToolSet): ToolSet {
  const out: Record<string, ToolSet[string]> = {};
  for (const [name, t] of Object.entries(tools)) {
    sanitizeToolSchemaForGemini(t, `${prefix}_${name}`);
    out[`${prefix}_${name}`] = t;
  }
  return out as ToolSet;
}

/**
 * Gemini's function-calling API rejects tool parameter schemas that contain
 * non-string literals in `enum` or `const` (e.g. an integer-valued interval
 * picker like `enum: [1, 60, 1440]`). It is otherwise happy with the schema,
 * so we walk the JSON Schema attached to each MCP-discovered tool and:
 *
 *   - delete `enum` arrays whose members aren't all strings,
 *   - delete `const` whose value isn't a string,
 *   - recover a sensible `type` (`"integer" | "number" | "boolean"`) when one
 *     wasn't declared, so the parameter still has a type signal.
 *
 * This is destructive but in-place mutation is fine: the tools are spawned
 * fresh per request inside `connectMcpClients()`.
 */
function sanitizeToolSchemaForGemini(
  tool: ToolSet[string],
  toolName: string,
): void {
  const schema = (tool as { inputSchema?: unknown }).inputSchema;
  if (!schema || typeof schema !== "object") return;

  // jsonSchema() from @ai-sdk/provider-utils exposes a getter that returns
  // the same underlying object on every read, so mutating it in place
  // reaches the serializer used by the Gemini provider.
  const candidate = (schema as { jsonSchema?: unknown }).jsonSchema;
  const root =
    candidate && typeof candidate === "object"
      ? candidate
      : (schema as Record<string, unknown>);

  const fixed = { count: 0 };
  sanitizeSchemaInPlace(root, fixed);

  if (fixed.count > 0) {
    process.stderr.write(
      `[mcp] sanitized ${fixed.count} Gemini-incompatible enum/const value(s) in ${toolName}\n`,
    );
  }
}

function sanitizeSchemaInPlace(
  schema: unknown,
  fixed: { count: number },
): void {
  if (!schema || typeof schema !== "object") return;
  if (Array.isArray(schema)) {
    for (const item of schema) sanitizeSchemaInPlace(item, fixed);
    return;
  }
  const s = schema as Record<string, unknown>;

  if (
    Array.isArray(s.enum) &&
    (s.enum as unknown[]).some((v) => typeof v !== "string")
  ) {
    const recovered = inferTypeFromValues(s.enum as unknown[]);
    delete s.enum;
    if (!s.type && recovered) s.type = recovered;
    fixed.count += 1;
  }

  if ("const" in s && typeof s.const !== "string") {
    const recovered = inferTypeFromValues([s.const]);
    delete s.const;
    if (!s.type && recovered) s.type = recovered;
    fixed.count += 1;
  }

  // Containers whose VALUES are sub-schemas (Record<string, Schema>).
  for (const key of [
    "properties",
    "patternProperties",
    "definitions",
    "$defs",
  ] as const) {
    const v = s[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const subSchema of Object.values(v as Record<string, unknown>)) {
        sanitizeSchemaInPlace(subSchema, fixed);
      }
    }
  }

  // Containers that themselves are a sub-schema (or array thereof).
  for (const key of ["items", "additionalProperties"] as const) {
    const v = s[key];
    if (v && typeof v === "object") sanitizeSchemaInPlace(v, fixed);
  }

  // Schema-array containers.
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const v = s[key];
    if (Array.isArray(v)) {
      for (const item of v) sanitizeSchemaInPlace(item, fixed);
    }
  }
}

function inferTypeFromValues(values: unknown[]): string | null {
  if (values.length === 0) return null;
  if (values.every((v) => typeof v === "number" && Number.isInteger(v))) {
    return "integer";
  }
  if (values.every((v) => typeof v === "number")) return "number";
  if (values.every((v) => typeof v === "boolean")) return "boolean";
  if (values.every((v) => typeof v === "string")) return "string";
  return null;
}

/**
 * Spin up both MCP servers and return their tools merged into a single map.
 * Always returns a handle - if both servers fail, you still get `tools: {}`
 * and `connected: { football: false, prediction: false }`.
 */
export async function connectMcpClients(): Promise<McpHandle> {
  if (process.env.MCP_DISABLED === "1") {
    return {
      tools: {},
      connected: { football: false, prediction: false },
      close: async () => {},
    };
  }

  const [football, prediction] = await Promise.all([
    connectFootball(),
    connectPrediction(),
  ]);

  let tools: ToolSet = {};
  if (football) {
    try {
      tools = { ...tools, ...prefixTools("football", await football.tools()) };
    } catch (err) {
      process.stderr.write(
        `[mcp] football.tools() failed: ${(err as Error).message}\n`,
      );
    }
  }
  if (prediction) {
    try {
      tools = {
        ...tools,
        ...prefixTools("prediction", await prediction.tools()),
      };
    } catch (err) {
      process.stderr.write(
        `[mcp] prediction.tools() failed: ${(err as Error).message}\n`,
      );
    }
  }

  return {
    tools,
    connected: { football: !!football, prediction: !!prediction },
    close: async () => {
      await Promise.allSettled([
        football?.close(),
        prediction?.close(),
      ]);
    },
  };
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} did not start within ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
