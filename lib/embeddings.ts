import { google } from "@ai-sdk/google";
import { embedMany } from "ai";

/** Per-request batch size. Gemini's batchEmbedContents caps at 100. */
const BATCH_SIZE = 100;

/** Dimensionality stored in playbook_docs.embedding (vector(768)). */
export const EMBEDDING_DIM = 768;

/** Gemini text embedding model id. */
export const EMBEDDING_MODEL = "gemini-embedding-001";

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/**
 * Embed many strings, returning float[]s in the same order.
 *
 * Splits into BATCH_SIZE chunks and runs them sequentially to keep per-minute
 * rate usage predictable from a script. If you need parallel calls later,
 * swap the for-loop for a small worker pool.
 */
export async function embedBatch(
  texts: string[],
  taskType: TaskType = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = google.textEmbedding(EMBEDDING_MODEL);
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model,
      values: chunk,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIM,
          taskType,
        },
      },
    });

    for (const e of embeddings) {
      if (e.length !== EMBEDDING_DIM) {
        throw new Error(
          `Embedding dimension mismatch: got ${e.length}, expected ${EMBEDDING_DIM}. ` +
            `Check providerOptions.google.outputDimensionality.`,
        );
      }
      out.push(e);
    }
  }

  return out;
}

/** Convenience: embed a single query string for similarity search. */
export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedBatch([text], "RETRIEVAL_QUERY");
  return v;
}
