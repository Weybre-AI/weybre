/**
 * Utility script to configure Supermemory settings for Weybre.
 * Usage: npx tsx scripts/setup-supermemory.ts
 */
import "dotenv/config";

const SUPERMEMORY_API_KEY = process.env.SUPERMEMORY_API_KEY;

if (!SUPERMEMORY_API_KEY) {
  console.error("❌ SUPERMEMORY_API_KEY not found in .env");
  process.exit(1);
}

async function setup() {
  console.log("🚀 Configuring Supermemory for Weybre...");

  try {
    const response = await fetch("https://api.supermemory.ai/v3/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-supermemory-api-key": SUPERMEMORY_API_KEY as string,
      },
      body: JSON.stringify({
        shouldLLMFilter: true,
        filterPrompt: `Weybre is a legal research and matter management platform for Indian law firms. containerTag is orgId. We store research findings, case-law summaries, matter details, and user preferences to provide a personalized legal assistant experience.`,
      }),
    });

    if (response.ok) {
      console.log("✅ Supermemory settings updated successfully!");
    } else {
      const error = await response.text();
      console.error(`❌ Failed to update settings: ${response.status} ${error}`);
    }
  } catch (err) {
    console.error("❌ Error connecting to Supermemory API:", err);
  }
}

setup();
