/**
 * Microsoft Graph helpers — server-side only.
 * Tokens live in m365_connections; never returned to the browser.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GRAPH = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export const M365_SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "Files.ReadWrite",
  "Calendars.ReadWrite",
  "Sites.ReadWrite.All",
  "Team.ReadBasic.All",
  "ChannelMessage.Send",
].join(" ");

export interface M365Connection {
  id: string;
  user_id: string;
  ms_user_id: string | null;
  ms_email: string | null;
  ms_name: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string;
}

export async function getConnection(
  admin: SupabaseClient,
  userId: string,
): Promise<M365Connection | null> {
  const { data, error } = await admin
    .from("m365_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getConnection", error);
    return null;
  }
  return data as M365Connection | null;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
} | null> {
  const clientId = Deno.env.get("AZURE_CLIENT_ID") ?? Deno.env.get("VITE_AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("AZURE_CLIENT_ID or AZURE_CLIENT_SECRET not configured in Supabase secrets");
    return null;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: M365_SCOPES,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    console.error("token refresh failed", res.status, await res.text());
    return null;
  }

  return res.json();
}

export async function getValidAccessToken(
  admin: SupabaseClient,
  conn: M365Connection,
): Promise<string | null> {
  const expires = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const stillValid = expires > Date.now() + 60_000;

  if (stillValid && conn.access_token) return conn.access_token;

  if (!conn.refresh_token) return stillValid ? conn.access_token : null;

  const refreshed = await refreshAccessToken(conn.refresh_token);
  if (!refreshed) return null;

  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await admin.from("m365_connections").update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? conn.refresh_token,
    token_expires_at: tokenExpiresAt,
    last_used_at: new Date().toISOString(),
  }).eq("id", conn.id);

  return refreshed.access_token;
}

export async function graphRequest<T = unknown>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<{ data?: T; error?: string; status: number }> {
  const url = path.startsWith("http") ? path : `${GRAPH}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) return { status: 204 };

  const text = await res.text();
  let json: T | { error?: { message?: string } } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* non-json */
  }

  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message ?? text.slice(0, 300);
    return { error: msg, status: res.status };
  }

  return { data: json as T, status: res.status };
}

export async function fetchGraphProfile(accessToken: string) {
  return graphRequest<{ id: string; mail?: string; userPrincipalName?: string; displayName?: string }>(
    accessToken,
    "/me?$select=id,mail,userPrincipalName,displayName",
  );
}

export async function upsertConnectionFromOAuth(
  admin: SupabaseClient,
  userId: string,
  tokens: {
    access_token: string;
    refresh_token?: string | null;
    expires_at?: string | null;
    scopes?: string;
  },
): Promise<M365Connection | null> {
  const profile = await fetchGraphProfile(tokens.access_token);
  const me = profile.data;

  const row = {
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    token_expires_at: tokens.expires_at ?? null,
    scopes: tokens.scopes ?? M365_SCOPES,
    ms_user_id: me?.id ?? null,
    ms_email: me?.mail ?? me?.userPrincipalName ?? null,
    ms_name: me?.displayName ?? null,
    last_used_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("m365_connections")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    console.error("upsertConnection", error);
    return null;
  }
  return data as M365Connection;
}
