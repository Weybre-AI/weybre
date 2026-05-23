/**
 * Microsoft 365 — all Graph calls go through the m365-graph edge function.
 * OAuth tokens are stored server-side only (production-safe).
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  M365_OAUTH_SCOPES,
  syncM365FromSession,
  m365Invoke,
  uploadToOneDriveViaApi,
  createCalendarEventViaApi,
} from "@/lib/m365Api";
import { safeRedirectPath } from "@/lib/safeRedirect";

export interface M365Status {
  connected: boolean;
  ms_email?: string | null;
  ms_name?: string | null;
  token_valid?: boolean;
  onedrive_enabled?: boolean;
  calendar_enabled?: boolean;
  teams_enabled?: boolean;
  sharepoint_enabled?: boolean;
}

export function useM365() {
  const [status, setStatus] = useState<M365Status>({ connected: false });
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    const { data, error } = await m365Invoke<M365Status>({ action: "status" });
    if (!error && data) {
      setStatus({
        connected: !!data.ms_email || !!data.connected,
        ms_email: data.ms_email,
        ms_name: data.ms_name,
        token_valid: data.token_valid,
        onedrive_enabled: data.onedrive_enabled,
        calendar_enabled: data.calendar_enabled,
        teams_enabled: data.teams_enabled,
        sharepoint_enabled: data.sharepoint_enabled,
      });
    } else {
      setStatus({ connected: false });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) {
        await syncM365FromSession();
      }
      if (!cancelled) await refreshStatus();
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.provider_token) {
        await syncM365FromSession();
      }
      if (!cancelled) await refreshStatus();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refreshStatus]);

  async function connectMicrosoft(redirectPath = "/app/settings") {
    const path = safeRedirectPath(redirectPath, "/app/settings");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: M365_OAUTH_SCOPES,
        redirectTo: `${window.location.origin}${path}`,
      },
    });
    if (error) toast.error(error.message);
  }

  async function disconnectMicrosoft() {
    const { error } = await m365Invoke({ action: "disconnect" });
    if (error) toast.error(error);
    else {
      setStatus({ connected: false });
      toast.success("Microsoft 365 disconnected");
    }
  }

  return {
    connected: status.connected && (status.token_valid !== false),
    loading,
    status,
    refreshStatus,
    uploadToOneDrive: uploadToOneDriveViaApi,
    createCalendarEvent: createCalendarEventViaApi,
    connectMicrosoft,
    disconnectMicrosoft,
    invoke: m365Invoke,
  };
}
