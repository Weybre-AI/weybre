import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type OrgRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_by: string;
  created_at: string;
}

export interface OrgMembership extends Organization {
  role: OrgRole;
}

interface Ctx {
  loading: boolean;
  orgs: OrgMembership[];
  currentOrg: OrgMembership | null;
  setCurrentOrgId: (id: string | null) => void;
  refresh: () => Promise<void>;
  createOrg: (name: string) => Promise<OrgMembership | null>;
}

const OrgCtx = createContext<Ctx>({
  loading: true,
  orgs: [],
  currentOrg: null,
  setCurrentOrgId: () => {},
  refresh: async () => {},
  createOrg: async () => null,
});

const LS_KEY = "weybre.currentOrgId";

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "org";
}

export const OrganizationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null)
  );

  const refresh = useCallback(async () => {
    if (!user) { setOrgs([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("organization_members")
      .select("role, organization:organizations(id,name,slug,plan,created_by,created_at)")
      .eq("user_id", user.id);
    if (error) { console.error(error); setOrgs([]); setLoading(false); return; }
    const list: OrgMembership[] = (data ?? [])
      .filter((r: any) => r.organization)
      .map((r: any) => ({ ...r.organization, role: r.role as OrgRole }));
    setOrgs(list);
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const setCurrentOrgId = useCallback((id: string | null) => {
    setCurrentOrgIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(LS_KEY, id);
      else localStorage.removeItem(LS_KEY);
    }
  }, []);

  useEffect(() => {
    if (!loading && orgs.length && !orgs.find(o => o.id === currentOrgId)) {
      setCurrentOrgId(orgs[0].id);
    }
  }, [loading, orgs, currentOrgId, setCurrentOrgId]);

  const createOrg = useCallback(async (name: string) => {
    if (!user) return null;
    const base = slugify(name);
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const { data, error } = await (supabase as any)
      .from("organizations")
      .insert({ name: name.trim(), slug, created_by: user.id })
      .select("id,name,slug,plan,created_by,created_at")
      .single();
    if (error) { console.error(error); return null; }
    const newOrg: OrgMembership = { ...data, role: "owner" };
    setOrgs(prev => [...prev, newOrg]);
    setCurrentOrgId(newOrg.id);
    return newOrg;
  }, [user, setCurrentOrgId]);

  const currentOrg = useMemo(
    () => orgs.find(o => o.id === currentOrgId) ?? null,
    [orgs, currentOrgId]
  );

  return (
    <OrgCtx.Provider value={{ loading, orgs, currentOrg, setCurrentOrgId, refresh, createOrg }}>
      {children}
    </OrgCtx.Provider>
  );
};

export const useOrganizations = () => useContext(OrgCtx);
