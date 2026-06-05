import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Weybre AI - TypeScript SDK (Enterprise)
 * 
 * Usage:
 * const weybre = new WeybreSDK('wyb_...');
 * const result = await weybre.research.search('PMLA bail rules');
 */
export class WeybreSDK {
  private supabase: any;

  constructor(private apiKey: string, supabaseUrl: string) {
    this.supabase = createClient(supabaseUrl, apiKey);
  }

  /**
   * Legal Research API
   */
  public research = {
    search: async (query: string, filters: any = {}) => {
      const { data, error } = await this.supabase.functions.invoke('research', {
        body: { query, filters }
      });
      if (error) throw error;
      return data;
    }
  };

  /**
   * Contract Ingestion API (Async)
   */
  public contracts = {
    analyze: async (contractId: string) => {
      const { data, error } = await this.supabase.functions.invoke('contract-intake', {
        body: { contractId }
      });
      if (error) throw error;
      return data;
    },
    getJobStatus: async (jobId: string) => {
      const { data, error } = await this.supabase
        .from('processing_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      if (error) throw error;
      return data;
    }
  };

  /**
   * Litigation Intelligence API
   */
  public litigation = {
    getAnalytics: async (query: string) => {
      const { data, error } = await this.supabase.functions.invoke('litigation-intel', {
        body: { query }
      });
      if (error) throw error;
      return data;
    }
  };
}
