import "server-only";

import { google } from "@ai-sdk/google";
import { generateObject, type LanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider-v2";

export type LlmProviderId = "gemini" | "ollama";

/** Smallest/fastest stable Gemini on the free tier. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

/** Small open-weight model; run `ollama pull llama3.2` first. */
export const DEFAULT_OLLAMA_MODEL = "llama3.2";

export type ResolvedLlm = {
  provider: LlmProviderId;
  modelId: string;
  displayName: string;
  model: LanguageModel;
};

function resolveProviderId(): LlmProviderId | null {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === "gemini" || explicit === "google") return "gemini";
  if (explicit === "ollama" || explicit === "local") return "ollama";

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) return "gemini";
  if (process.env.LLM_PROVIDER?.trim().toLowerCase() === "ollama") return "ollama";
  if (process.env.OLLAMA_MODEL?.trim() || process.env.OLLAMA_BASE_URL?.trim()) {
    return "ollama";
  }
  return null;
}

export function getResolvedLlm(): ResolvedLlm | null {
  const provider = resolveProviderId();
  if (!provider) return null;

  if (provider === "gemini") {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) return null;
    const modelId =
      process.env.GEMINI_ANALYST_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    return {
      provider: "gemini",
      modelId,
      displayName: `gemini:${modelId}`,
      model: google(modelId),
    };
  }

  const modelId = process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;
  const baseURL =
    process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434/api";
  const ollama = createOllama({ baseURL });
  return {
    provider: "ollama",
    modelId,
    displayName: `ollama:${modelId}`,
    model: ollama(modelId),
  };
}

export function isLlmAnalystConfigured(): boolean {
  return getResolvedLlm() !== null;
}

/** Probe Ollama /api/tags (best-effort; used for clearer errors only). */
export async function isOllamaReachable(): Promise<boolean> {
  const base =
    process.env.OLLAMA_BASE_URL?.trim().replace(/\/api\/?$/, "") ||
    "http://127.0.0.1:11434";
  try {
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { generateObject };
