# Production-Grade Fixes for Edge Functions

## Issue: "Failed to send a request to the Edge Function"

### Root Cause
All edge functions have CORS misconfiguration - they're not properly passing the origin header through the response chain, causing browser CORS errors.

### Symptoms
- Browser console shows CORS errors
- Edge function invocations fail from the frontend
- Error message: "Failed to send a request to the Edge Function"

### Solution
Every edge function must:
1. Extract origin from request headers
2. Pass origin to all response functions
3. Use consistent error handling with proper CORS headers

## Files That Need Fixing

### Critical (User-Facing Functions)
1. ✅ `research/index.ts` - Partially fixed, needs completion
2. ⚠️ `draft/index.ts` - Needs fixing
3. ⚠️ `contract-intake/index.ts` - Needs fixing
4. ⚠️ `decision-engine/index.ts` - Needs fixing
5. ⚠️ `litigation-intel/index.ts` - Needs fixing
6. ⚠️ `web-search/index.ts` - Needs fixing
7. ⚠️ `vision-ocr/index.ts` - Needs fixing
8. ⚠️ `export-draft/index.ts` - Needs fixing
9. ⚠️ `export-matter/index.ts` - Needs fixing
10. ⚠️ `ecourts/index.ts` - Needs fixing

### Already Correct
- ✅ `create-dodo-checkout/index.ts` - Properly handles origin
- ✅ `cancel-dodo-subscription/index.ts` - Properly handles origin
- ✅ `dodo-webhook/index.ts` - Webhook, doesn't need browser CORS
- ✅ `org-sso-register/index.ts` - Uses shared json function correctly

## Standard Pattern

Every edge function should follow this pattern:

```typescript
import { corsHeaders, handleOptions, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    // ... function logic ...
    
    // Success response
    return json({ data: result }, 200, origin);
    
  } catch (e) {
    console.error("function-name error", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" }, 
      500, 
      origin
    );
  }
});
```

## Quick Fix Script

Run this to fix all functions at once:

```bash
# This will be implemented in the next step
```

## Testing After Fix

1. Open browser console
2. Navigate to any page that calls edge functions
3. Make a request (e.g., research query)
4. Verify:
   - No CORS errors in console
   - Request completes successfully
   - Response headers include `Access-Control-Allow-Origin`

## Additional Production Issues Found

### 1. Missing Error Handling
Many functions don't properly catch and return errors with CORS headers.

### 2. Inconsistent Response Format
Some functions return `{ data }`, others return data directly.

### 3. No Request Timeout
Edge functions can hang indefinitely.

### 4. Missing Request ID Logging
Hard to debug issues without request tracing.

### 5. No Retry Logic
Transient failures aren't handled.

## Recommended Production Enhancements

### 1. Add Request Tracing
```typescript
const requestId = crypto.randomUUID();
console.log(`[${requestId}] Starting request`, { user: user.id, function: "research" });
```

### 2. Add Timeout Wrapper
```typescript
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error("Request timeout")), 30000)
);
const result = await Promise.race([actualWork(), timeoutPromise]);
```

### 3. Standardize Error Responses
```typescript
interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  request_id?: string;
}
```

### 4. Add Health Check Endpoint
```typescript
if (req.url.endsWith("/health")) {
  return json({ status: "ok", timestamp: new Date().toISOString() }, 200, origin);
}
```

### 5. Add Metrics Logging
```typescript
const startTime = Date.now();
// ... do work ...
const duration = Date.now() - startTime;
console.log(`[metrics] ${functionName} completed in ${duration}ms`);
```

## Implementation Priority

### Phase 1: Critical CORS Fixes (Now)
- Fix all 10 user-facing edge functions
- Deploy immediately
- Test all features

### Phase 2: Error Handling (This Week)
- Standardize error responses
- Add request tracing
- Add timeout handling

### Phase 3: Monitoring (This Month)
- Add metrics logging
- Set up error alerting
- Add health checks

## Deployment Checklist

- [ ] Fix all edge function CORS issues
- [ ] Test each function in browser
- [ ] Verify no CORS errors in console
- [ ] Check Supabase logs for errors
- [ ] Monitor error rates after deployment
- [ ] Have rollback plan ready
