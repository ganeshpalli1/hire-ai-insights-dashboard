import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface InterviewResult {
  id: string;
  interview_session_id: string;
  job_post_id: string;
  resume_result_id: string;
  candidate_name: string;
  conversation_id: string;
  transcript: string;
  transcript_entries: any;
  transcript_source: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  domain_score: number;
  behavioral_score: number;
  communication_score: number;
  overall_score: number;
  confidence_level: string;
  cheating_detected: boolean;
  body_language: string;
  speech_pattern: string;
  areas_of_improvement: string[];
  system_recommendation: string;
  raw_analysis: any;
  security_violations: any;
  created_at: string;
  updated_at: string;
}

export interface JobWithResults {
  id: string;
  job_role: string;
  required_experience: string;
  job_description: string;
  job_description_analysis: any;
  status: string;
  created_at: string;
  updated_at: string;
  interview_results: InterviewResult[];
  total_interviews: number;
  avg_score: number;
}

export function useInterviewResults() {
  return useQuery({
    queryKey: ['interviewResults'],
    queryFn: async (): Promise<JobWithResults[]> => {
      // First, fetch all jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('job_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
        throw jobsError;
      }

      if (!jobs || jobs.length === 0) {
        return [];
      }

      // Then fetch interview results for all jobs
      const { data: results, error: resultsError } = await supabase
        .from('interview_results')
        .select('*')
        .in('job_post_id', jobs.map(job => job.id))
        .order('created_at', { ascending: false });

      if (resultsError) {
        console.error('Error fetching interview results:', resultsError);
        throw resultsError;
      }

      // Combine jobs with their interview results
      const jobsWithResults: JobWithResults[] = jobs.map(job => {
        const jobResults = results?.filter(result => result.job_post_id === job.id) || [];
        const totalScore = jobResults.reduce((sum, result) => sum + (result.overall_score || 0), 0);
        
        return {
          ...job,
          interview_results: jobResults,
          total_interviews: jobResults.length,
          avg_score: jobResults.length > 0 ? Math.round(totalScore / jobResults.length) : 0
        };
      });

      return jobsWithResults;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
  });
}

export function useInterviewResult(resultId: string) {
  return useQuery({
    queryKey: ['interviewResult', resultId],
    queryFn: async (): Promise<InterviewResult | null> => {
      const { data, error } = await supabase
        .from('interview_results')
        .select('*')
        .eq('id', resultId)
        .single();

      if (error) {
        console.error('Error fetching interview result:', error);
        throw error;
      }

      return data;
    },
    enabled: !!resultId,
  });
} 