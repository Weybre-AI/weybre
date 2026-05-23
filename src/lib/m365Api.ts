import { supabase } from "@/integrations/supabase/client";

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const M365_OAUTH_SCOPES =
  "email openid profile offline_access Files.ReadWrite Calendars.ReadWrite Sites.ReadWrite.All Team.ReadBasic.All ChannelMessage.Send";

export async function syncM365FromSession(): Promise<{ connected: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const access = session?.provider_token;
  if (!access) return { connected: false };

  const refresh = (session as { provider_refresh_token?: string })?.provider_refresh_token;
  const { data, error } = await supabase.functions.invoke("m365-graph", {
    body: {
      action: "sync",
      access_token: access,
      refresh_token: refresh ?? null,
      expires_at: session?.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    },
  });

  if (error) return { connected: false, error: error.message };
  if (data?.error) return { connected: false, error: data.error };
  return { connected: true };
}

export async function m365Invoke<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("m365-graph", { body });
  if (error) return { data: null, error: error.message };
  if (data?.error) return { data: null, error: String(data.error) };
  return { data: data as T, error: null };
}

export async function uploadToOneDriveViaApi(
  blob: Blob,
  filename: string,
  opts?: { draftId?: string; matterId?: string },
): Promise<string> {
  const content_base64 = await blobToBase64(blob);
  const { data, error } = await m365Invoke<{ webUrl: string }>({
    action: "upload_onedrive",
    filename,
    content_base64,
    mime_type: blob.type || "application/octet-stream",
    draft_id: opts?.draftId,
    matter_id: opts?.matterId,
  });
  if (error) throw new Error(error);
  return data!.webUrl;
}

export async function createCalendarEventViaApi(opts: {
  subject: string;
  body?: string;
  start: string;
  end: string;
  location?: string;
  matterId?: string;
}): Promise<string> {
  const { data, error } = await m365Invoke<{ webLink: string }>({
    action: "create_event",
    ...opts,
    time_zone: "Asia/Kolkata",
  });
  if (error) throw new Error(error);
  return data!.webLink;
}
