-- System-wide Legal Analytics
-- Migration: 20260602000012_system_legal_stats.sql

CREATE OR REPLACE FUNCTION public.get_system_legal_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_judgments INTEGER;
    v_avg_disposal_rate FLOAT;
    v_avg_wait_days INTEGER;
    v_total_judges INTEGER;
BEGIN
    SELECT count(*) INTO v_total_judgments FROM public.judgments;
    SELECT avg(disposal_rate) INTO v_avg_disposal_rate FROM public.judge_stats;
    SELECT avg(avg_duration_days) INTO v_avg_wait_days FROM public.judge_stats;
    SELECT count(*) INTO v_total_judges FROM public.judge_stats;

    RETURN jsonb_build_object(
        'total_judgments', v_total_judgments,
        'avg_disposal_rate', COALESCE(v_avg_disposal_rate, 0),
        'avg_wait_days', COALESCE(v_avg_wait_days, 0),
        'total_judges', v_total_judges
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_legal_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_legal_stats TO service_role;
