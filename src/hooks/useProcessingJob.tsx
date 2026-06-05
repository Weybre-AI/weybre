import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type JobStage = 'ingestion' | 'extraction' | 'chunking' | 'analysis' | 'aggregation' | 'storage';

export interface ProcessingJob {
  id: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  error_message: string | null;
  result: any;
  resource_id: string;
  resource_type: string;
}

/**
 * Hook to subscribe to real-time updates for a document processing job.
 */
export const useProcessingJob = (jobId: string | null) => {
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    setLoading(true);
    
    // 1. Initial fetch of current state
    const fetchJob = async () => {
      const { data, error } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      
      if (!error && data) {
        setJob(data as unknown as ProcessingJob);
      }
      setLoading(false);
    };

    void fetchJob();

    // 2. Realtime subscription for live progress
    const channel = supabase
      .channel(`processing_job:${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "processing_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          setJob(payload.new as unknown as ProcessingJob);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [jobId]);

  return { job, loading };
};
