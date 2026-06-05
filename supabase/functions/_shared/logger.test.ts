import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { logInfo, logError } from "./logger.ts";

Deno.test("logger - logInfo outputs structured JSON to console.log", () => {
  const originalConsoleLog = console.log;
  let loggedMessage = "";
  console.log = (msg) => { loggedMessage = msg; };

  try {
    logInfo("Test info message", { custom: "data" });
    
    const parsed = JSON.parse(loggedMessage);
    assertEquals(parsed.level, "info");
    assertEquals(parsed.message, "Test info message");
    assertEquals(parsed.custom, "data");
    assertStringIncludes(loggedMessage, "timestamp");
  } finally {
    console.log = originalConsoleLog;
  }
});

Deno.test("logger - logError outputs structured JSON to console.error", () => {
  const originalConsoleError = console.error;
  let loggedMessage = "";
  console.error = (msg) => { loggedMessage = msg; };

  try {
    const errorObj = new Error("Test exception");
    logError("Test error message", errorObj, { extra: 123 });
    
    const parsed = JSON.parse(loggedMessage);
    assertEquals(parsed.level, "error");
    assertEquals(parsed.message, "Test error message");
    assertEquals(parsed.extra, 123);
    assertEquals(parsed.error.message, "Test exception");
    assertEquals(parsed.error.name, "Error");
    assertStringIncludes(loggedMessage, "timestamp");
  } finally {
    console.error = originalConsoleError;
  }
});
