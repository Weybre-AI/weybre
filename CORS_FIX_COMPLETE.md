# CORS Fix - Production Ready

## ✅ Fixed Functions
1. **research/index.ts** - All json() calls now include origin
2. **draft/index.ts** - All json() calls now include origin

## ⚠️ Remaining Functions to Fix

Apply this pattern to each:

```typescript
// At the top
function json(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// In handler
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return handleOptions(origin);
  
  try {
    // ... logic ...
    return json({ data }, 200, origin);
  } catch (e) {
    return json({ error: e.message }, 500, origin);
  }
});
```

### Functions Needing Fix:
- contract-intake/index.ts
- decision-engine/index.ts
- litigation-intel/index.ts
- web-search/index.ts
- vision-ocr/index.ts
- export-draft/index.ts
- export-matter/index.ts
- ecourts/index.ts
- ingest-judgments/index.ts

## Quick Test
After deploying, test with:
```javascript
// In browser console
const { data, error } = await supabase.functions.invoke('research', {
  body: { query: 'test' }
});
console.log('Success:', data, 'Error:', error);
```

Should see no CORS errors in console.
