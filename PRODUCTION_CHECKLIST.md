# Production checklist — Weybre AI

## Supabase

1. Run pending SQL in Dashboard → SQL Editor:
   - `supabase/migrations/20260523140000_security_hardening.sql`
   - `supabase/migrations/20260523150000_m365_production.sql`

2. Edge Function secrets:
   - `GOOGLE_AI_API_KEY`
   - `AZURE_CLIENT_ID` (same as Entra app)
   - `AZURE_CLIENT_SECRET`
   - `DODO_PRODUCT_ID_*`, `DODO_WEBHOOK_SECRET`, etc.

3. Deploy functions:
   ```bash
   supabase functions deploy m365-graph research web-search export-matter export-draft --project-ref YOUR_REF
   ```

4. Auth → URL configuration: Site URL `https://weybre.com`, redirect URLs for localhost + production.

5. Auth → Azure: enable provider; add Graph scopes; **admin consent** for:
   - Files.ReadWrite, Calendars.ReadWrite, Sites.ReadWrite.All, Team.ReadBasic.All, ChannelMessage.Send

## Azure Portal

1. App registration → Authentication → redirect URI: `https://YOUR_REF.supabase.co/auth/v1/callback`
2. Certificates & secrets → new client secret → store in Supabase only
3. API permissions → Microsoft Graph delegated permissions (above) → Grant admin consent

## Frontend hosting

1. Set `VITE_SUPABASE_*` env vars (placeholders in `.env.example`)
2. Deploy `dist/` with `public/_headers` (Netlify/Cloudflare Pages pick these up automatically on some hosts)

## Verify

- [ ] Research + web search (credits deduct)
- [ ] Mobile nav (hamburger) on `/app/*`
- [ ] Settings → Microsoft 365 connect → OneDrive export on draft
- [ ] Matter → Outlook calendar event
- [ ] Teams post from Settings (if user is in teams)
- [ ] Users cannot self-upgrade subscription (SQL policy dropped)
