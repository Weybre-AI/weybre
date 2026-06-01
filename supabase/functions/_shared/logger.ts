export function logInfo(message: string, context?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", message, ...context, timestamp: new Date().toISOString() }));
}

export function logError(message: string, error?: unknown, context?: Record<string, unknown>) {
  console.error(JSON.stringify({ 
    level: "error", 
    message, 
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    ...context, 
    timestamp: new Date().toISOString() 
  }));
}
