import { requireEnv } from "./auth.ts";

const SUPERMEMORY_API_KEY = Deno.env.get("SUPERMEMORY_API_KEY") ?? "";

export interface SupermemoryContext {
  profile?: {
    static: string[];
    dynamic: string[];
  };
  searchResults?: {
    results: Array<{ memory?: string; chunk?: string }>;
  };
}

/**
 * Fetches user profile and relevant memories from Supermemory.
 * Choice: OPTION A (One call with search included)
 */
export async function getSupermemoryContext(
  orgId: string,
  query: string
): Promise<SupermemoryContext> {
  if (!SUPERMEMORY_API_KEY || !orgId) return {};

  try {
    const response = await fetch("https://api.supermemory.ai/v4/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supermemory-api-key": SUPERMEMORY_API_KEY,
      },
      body: JSON.stringify({
        containerTag: orgId,
        q: query,
      }),
    });

    if (!response.ok) {
      console.warn("Supermemory profile fetch failed:", response.status);
      return {};
    }

    return await response.json();
  } catch (error) {
    console.error("Supermemory error:", error);
    return {};
  }
}

/**
 * Adds a new memory to Supermemory.
 */
export async function addSupermemory(
  orgId: string,
  userId: string,
  content: string
): Promise<void> {
  if (!SUPERMEMORY_API_KEY || !orgId) return;

  try {
    const response = await fetch("https://api.supermemory.ai/v3/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supermemory-api-key": SUPERMEMORY_API_KEY,
      },
      body: JSON.stringify({
        content,
        containerTag: orgId,
        metadata: { userId },
      }),
    });

    if (!response.ok) {
      console.warn("Supermemory add failed:", response.status);
    }
  } catch (error) {
    console.error("Supermemory add error:", error);
  }
}

/**
 * Configures Supermemory settings (Run this once or during deployment).
 */
export async function configureSupermemory(): Promise<void> {
  if (!SUPERMEMORY_API_KEY) return;

  await fetch("https://api.supermemory.ai/v3/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-supermemory-api-key": SUPERMEMORY_API_KEY,
    },
    body: JSON.stringify({
      shouldLLMFilter: true,
      filterPrompt: `Weybre is a legal research and matter management platform for Indian law firms. containerTag is orgId. We store research findings, case-law summaries, matter details, and user preferences to provide a personalized legal assistant experience.`,
    }),
  });
}
