import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logError } from "./logger.ts";

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type JobStage = 'ingestion' | 'extraction' | 'chunking' | 'analysis' | 'aggregation' | 'storage';

export interface JobUpdate {
  status?: JobStatus;
  stage?: JobStage;
  progress?: number;
  error_message?: string;
  result?: any;
  metadata?: any;
}

/**
 * Update processing_jobs table with current status and progress.
 */
export async function updateJobProgress(
  supabase: SupabaseClient,
  jobId: string,
  updates: JobUpdate
) {
  const payload: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (updates.status === 'processing') {
    payload.started_at = new Date().toISOString();
  }
  if (updates.status === 'completed' || updates.status === 'failed') {
    payload.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("processing_jobs")
    .update(payload)
    .eq("id", jobId);

  if (error) {
    logError(`Failed to update job ${jobId}`, error);
    throw error;
  }
}

/**
 * Create a new processing job.
 */
export async function createJob(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  resourceType: string,
  metadata: any = {}
): Promise<string> {
  const { data, error } = await supabase
    .from("processing_jobs")
    .insert({
      user_id: userId,
      resource_id: resourceId,
      resource_type: resourceType,
      status: 'queued',
      stage: 'ingestion',
      progress: 0,
      metadata
    })
    .select("id")
    .single();

  if (error) {
    logError("Failed to create processing job", error);
    throw error;
  }

  return data.id;
}
