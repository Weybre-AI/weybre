// deploy: 20260523160000
// eCourts India API proxy (authenticated, rate-limited)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/credits.ts";

const BASE = "https://webapi.ecourtsindia.com";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);
    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const rateCheck = checkRateLimit(user.id, 30, 60000);
    if (!rateCheck.allowed) return json({ error: rateCheck.error }, 429, origin);

    const token = Deno.env.get("ECOURTS_API_TOKEN");
    if (!token) return json({ error: "eCourts integration is not configured" }, 500, origin);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    let url = "";
    const init: RequestInit = {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    };

    if (action === "search") {
      const params = new URLSearchParams();
      const allowed = [
        "query", "advocates", "judges", "petitioners", "respondents", "litigants",
        "courtCodes", "caseTypes", "caseStatuses", "states",
        "filingDateFrom", "filingDateTo", "decisionDateFrom", "decisionDateTo",
        "page", "pageSize", "sortBy", "sortOrder",
      ];
      for (const k of allowed) {
        const v = body[k];
        if (v == null || v === "") continue;
        if (Array.isArray(v)) v.forEach((x: unknown) => params.append(k, String(x)));
        else params.set(k, String(v));
      }
      if (!params.has("pageSize")) params.set("pageSize", "20");
      const q = String(body.query ?? "");
      if (q.length > 500) return json({ error: "Query too long (max 500 chars)" }, 400, origin);
      url = `${BASE}/api/partner/search?${params.toString()}`;
    } else if (action === "case") {
      const cnr = String(body.cnr || "").trim().toUpperCase();
      if (!/^[A-Z]{4}\d{12}$/.test(cnr)) {
        return json({ error: "Invalid CNR. Expected 16 chars: 4 letters + 12 digits." }, 400, origin);
      }
      url = `${BASE}/api/partner/case/${cnr}`;
    } else if (action === "causelist") {
      const params = new URLSearchParams();
      for (const k of ["date", "courtCode", "judge", "advocate", "litigant", "state", "district", "page", "pageSize"]) {
        const v = body[k];
        if (v != null && v !== "") params.set(k, String(v));
      }
      url = `${BASE}/api/partner/causelist/search?${params.toString()}`;
    } else if (action === "available-dates") {
      const params = new URLSearchParams();
      for (const k of ["state", "district", "courtCode", "complexCode"]) {
        const v = body[k];
        if (v != null && v !== "") params.set(k, String(v));
      }
      url = `${BASE}/api/partner/causelist/available-dates?${params.toString()}`;
    } else {
      return json({ error: "Unknown action. Use: search | case | causelist | available-dates" }, 400, origin);
    }

    const r = await fetch(url, init);
    const text = await r.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 2000) }; }
    if (!r.ok) return json({ error: `eCourts API ${r.status}`, details: data }, r.status, origin);
    return json(data, 200, origin);
  } catch (e) {
    return json({ error: (e as Error).message }, 500, origin);
  }
});
