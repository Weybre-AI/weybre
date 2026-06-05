import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
}

export const useApiKeys = (orgId: string | null) => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, scopes, created_at, last_used_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    
    if (error) toast.error("Failed to load API keys");
    else setKeys(data as ApiKey[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  const createKey = async (name: string, scopes: string[]) => {
    if (!orgId) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "create", name, scopes }
      });

      if (error) throw error;
      if (!data?.key) throw new Error("No key returned");

      toast.success("API key created. COPY IT NOW - it won't be shown again.");
      void load();
      return data.key as string;
    } catch (err) {
      toast.error("Failed to create API key");
      console.error(err);
      return null;
    }
  };

  const revokeKey = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "revoke", id }
      });

      if (error) throw error;
      toast.success("API key revoked");
      void load();
    } catch (err) {
      toast.error("Failed to revoke key");
      console.error(err);
    }
  };

  return { keys, loading, createKey, revokeKey };
};
