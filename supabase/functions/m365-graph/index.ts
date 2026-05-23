// Microsoft Graph proxy — Outlook, Teams, OneDrive, SharePoint, Excel (server-side tokens).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { handleOptions, json } from "../_shared/cors.ts";
import { getUser } from "../_shared/auth.ts";
import {
  getConnection,
  getValidAccessToken,
  graphRequest,
  upsertConnectionFromOAuth,
  fetchGraphProfile,
  M365_SCOPES,
} from "../_shared/m365.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Body = {
  action?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  filename?: string;
  content_base64?: string;
  mime_type?: string;
  draft_id?: string;
  matter_id?: string;
  subject?: string;
  body?: string;
  start?: string;
  end?: string;
  location?: string;
  time_zone?: string;
  team_id?: string;
  channel_id?: string;
  message?: string;
  site_id?: string;
  folder_path?: string;
  workbook_item_id?: string;
  worksheet_name?: string;
  values?: unknown[][];
};

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return handleOptions(origin);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401, origin);

    const user = await getUser(auth);
    if (!user) return json({ error: "Unauthorized" }, 401, origin);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body: Body = await req.json().catch(() => ({}));
    const action = body.action ?? "status";

    // ---- OAuth token sync (after Microsoft sign-in) ----
    if (action === "sync") {
      if (!body.access_token) {
        return json({ error: "Microsoft sign-in did not complete. Try Connect again." }, 400, origin);
      }
      const profile = await fetchGraphProfile(body.access_token);
      if (profile.error || !profile.data?.id) {
        return json({ error: "Invalid Microsoft token. Sign in again." }, 401, origin);
      }
      const msEmail = (profile.data.mail ?? profile.data.userPrincipalName ?? "").toLowerCase().trim();
      const { data: authUser } = await admin.auth.admin.getUserById(user.id);
      const userEmail = (authUser?.user?.email ?? user.email ?? "").toLowerCase().trim();
      if (msEmail && userEmail && msEmail !== userEmail) {
        return json({
          error: "Microsoft account email must match your Weybre login email.",
        }, 403, origin);
      }
      const conn = await upsertConnectionFromOAuth(admin, user.id, {
        access_token: body.access_token,
        refresh_token: body.refresh_token ?? null,
        expires_at: body.expires_at ?? null,
        scopes: M365_SCOPES,
      });
      if (!conn) {
        return json({ error: "Could not link Microsoft account. Try again or contact support." }, 500, origin);
      }
      return json({
        connected: true,
        ms_email: conn.ms_email,
        ms_name: conn.ms_name,
        scopes: conn.scopes,
      }, 200, origin);
    }

    if (action === "disconnect") {
      await admin.from("m365_connections").delete().eq("user_id", user.id);
      return json({ connected: false }, 200, origin);
    }

    if (action === "status") {
      const { data } = await admin
        .from("m365_connection_status")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({ connected: !!data?.ms_email, ...data }, 200, origin);
    }

    const conn = await getConnection(admin, user.id);
    if (!conn) {
      return json({ error: "Microsoft 365 not connected. Sign in with Microsoft in Settings." }, 400, origin);
    }

    const token = await getValidAccessToken(admin, conn);
    if (!token) {
      return json({
        error: "Microsoft connection needs refresh. Open Settings → Disconnect, then Connect Microsoft 365 again.",
      }, 401, origin);
    }

    await admin.from("m365_connections").update({ last_used_at: new Date().toISOString() }).eq("user_id", user.id);

    // ---- OneDrive upload ----
    if (action === "upload_onedrive") {
      if (!body.filename || !body.content_base64) {
        return json({ error: "filename and content_base64 required" }, 400, origin);
      }
      const bytes = decodeBase64(body.content_base64);
      const path = `/me/drive/root:/Weybre AI/${encodeURIComponent(body.filename)}:/content`;
      const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": body.mime_type ?? "application/octet-stream",
        },
        body: bytes,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return json({ error: err?.error?.message ?? "OneDrive upload failed" }, res.status, origin);
      }
      const item = await res.json();
      await admin.from("onedrive_exports").insert({
        user_id: user.id,
        draft_id: body.draft_id ?? null,
        matter_id: body.matter_id ?? null,
        ms_item_id: item.id,
        ms_web_url: item.webUrl,
        file_name: body.filename,
        file_size: bytes.length,
        format: body.filename.endsWith(".pdf") ? "pdf" : "docx",
      });
      return json({ webUrl: item.webUrl, itemId: item.id }, 200, origin);
    }

    // ---- Outlook calendar ----
    if (action === "create_event") {
      const tz = body.time_zone ?? "Asia/Kolkata";
      const g = await graphRequest(token, "/me/events", {
        method: "POST",
        body: JSON.stringify({
          subject: body.subject,
          body: body.body ? { contentType: "text", content: body.body } : undefined,
          start: { dateTime: body.start, timeZone: tz },
          end: { dateTime: body.end, timeZone: tz },
          location: body.location ? { displayName: body.location } : undefined,
        }),
      });
      if (g.error) return json({ error: g.error }, g.status, origin);
      const event = g.data as { id: string; webLink: string };
      await admin.from("outlook_events").insert({
        user_id: user.id,
        matter_id: body.matter_id ?? null,
        ms_event_id: event.id,
        ms_event_url: event.webLink,
        subject: body.subject ?? "Event",
        start_at: new Date(body.start!).toISOString(),
        end_at: new Date(body.end!).toISOString(),
        location: body.location ?? null,
      });
      return json({ webLink: event.webLink, eventId: event.id }, 200, origin);
    }

    if (action === "list_events") {
      const g = await graphRequest<{ value: unknown[] }>(
        token,
        "/me/calendarView?startDateTime=" + encodeURIComponent(new Date().toISOString()) +
          "&endDateTime=" + encodeURIComponent(new Date(Date.now() + 90 * 86400000).toISOString()) +
          "&$top=20&$orderby=start/dateTime",
      );
      if (g.error) return json({ error: g.error }, g.status, origin);
      return json({ events: g.data?.value ?? [] }, 200, origin);
    }

    // ---- Teams ----
    if (action === "list_teams") {
      const g = await graphRequest<{ value: { id: string; displayName: string }[] }>(token, "/me/joinedTeams");
      if (g.error) return json({ error: g.error }, g.status, origin);
      return json({ teams: g.data?.value ?? [] }, 200, origin);
    }

    if (action === "list_channels") {
      if (!body.team_id) return json({ error: "team_id required" }, 400, origin);
      const g = await graphRequest<{ value: { id: string; displayName: string }[] }>(
        token,
        `/teams/${body.team_id}/channels`,
      );
      if (g.error) return json({ error: g.error }, g.status, origin);
      return json({ channels: g.data?.value ?? [] }, 200, origin);
    }

    if (action === "post_teams_message") {
      if (!body.team_id || !body.channel_id || !body.message) {
        return json({ error: "team_id, channel_id, and message required" }, 400, origin);
      }
      const g = await graphRequest<{ id: string; webUrl?: string }>(
        token,
        `/teams/${body.team_id}/channels/${body.channel_id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            body: { contentType: "text", content: body.message },
          }),
        },
      );
      if (g.error) return json({ error: g.error }, g.status, origin);
      const msg = g.data!;
      await admin.from("teams_posts").insert({
        user_id: user.id,
        team_id: body.team_id,
        channel_id: body.channel_id,
        message_id: msg.id,
        web_url: msg.webUrl ?? null,
        preview: body.message.slice(0, 500),
        matter_id: body.matter_id ?? null,
      });
      return json({ messageId: msg.id }, 200, origin);
    }

    // ---- SharePoint ----
    if (action === "list_sites") {
      const g = await graphRequest<{ value: { id: string; name: string; webUrl: string }[] }>(
        token,
        "/sites?search=*&$top=15",
      );
      if (g.error) return json({ error: g.error }, g.status, origin);
      return json({ sites: g.data?.value ?? [] }, 200, origin);
    }

    if (action === "upload_sharepoint") {
      if (!body.site_id || !body.filename || !body.content_base64) {
        return json({ error: "site_id, filename, content_base64 required" }, 400, origin);
      }
      const folder = body.folder_path ?? "Weybre AI";
      const bytes = decodeBase64(body.content_base64);
      const path = `/sites/${body.site_id}/drive/root:/${folder}/${encodeURIComponent(body.filename)}:/content`;
      const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": body.mime_type ?? "application/octet-stream",
        },
        body: bytes,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return json({ error: err?.error?.message ?? "SharePoint upload failed" }, res.status, origin);
      }
      const item = await res.json();
      await admin.from("sharepoint_exports").insert({
        user_id: user.id,
        site_id: body.site_id,
        drive_id: item.parentReference?.driveId ?? null,
        item_id: item.id,
        web_url: item.webUrl,
        file_name: body.filename,
        matter_id: body.matter_id ?? null,
        draft_id: body.draft_id ?? null,
      });
      return json({ webUrl: item.webUrl, itemId: item.id }, 200, origin);
    }

    // ---- Excel: append row to table (workbook must exist in user's OneDrive) ----
    if (action === "excel_append") {
      if (!body.workbook_item_id || !body.worksheet_name || !body.values?.length) {
        return json({ error: "workbook_item_id, worksheet_name, values required" }, 400, origin);
      }
      const range = `${body.worksheet_name}!A1`;
      const g = await graphRequest(
        token,
        `/me/drive/items/${body.workbook_item_id}/workbook/worksheets('${encodeURIComponent(body.worksheet_name)}')/range(address='${range}')/insert`,
        {
          method: "POST",
          body: JSON.stringify({
            shift: "Down",
            values: body.values,
          }),
        },
      );
      if (g.error) return json({ error: g.error }, g.status, origin);
      return json({ ok: true }, 200, origin);
    }

    return json({ error: `Unknown action: ${action}` }, 400, origin);
  } catch (e) {
    console.error("m365-graph error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500, origin);
  }
});
