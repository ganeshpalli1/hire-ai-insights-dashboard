import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResumeService } from '../lib/services';
import type { ResumeResult, ResumeResultInsert, ResumeResultUpdate, CandidateType, CandidateLevel } from '../types/database';
import { toast } from 'sonner';

// Query keys
export const resumeKeys = {
  all: ['resumes'] as const,
  lists: () => [...resumeKeys.all, 'list'] as const,
  list: (jobId: string) => [...resumeKeys.lists(), jobId] as const,
  details: () => [...resumeKeys.all, 'detail'] as const,
  detail: (id: string) => [...resumeKeys.details(), id] as const,
  filtered: (jobId: string, filters: any) => [...resumeKeys.list(jobId), 'filtered', filters] as const,
  classification: (jobId: string) => [...resumeKeys.list(jobId), 'classification'] as const,
  statistics: (jobId: string) => [...resumeKeys.list(jobId), 'statistics'] as const,
  topCandidates: (jobId: string, limit: number) => [...resumeKeys.list(jobId), 'top', limit] as const,
  search: (jobId: string, term: string) => [...resumeKeys.list(jobId), 'search', term] as const,
};

// Get resume results for a job
export function useResumeResults(jobId: string) {
  return useQuery({
    queryKey: resumeKeys.list(jobId),
    queryFn: () => ResumeService.getResumeResultsByJob(jobId),
    enabled: !!jobId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get resume result by ID
export function useResumeResult(resumeId: string) {
  return useQuery({
    queryKey: resumeKeys.detail(resumeId),
    queryFn: () => ResumeService.getResumeResultById(resumeId),
    enabled: !!resumeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get resume results with filters
export function useFilteredResumeResults(
  jobId: string,
  filters: {
    candidateType?: CandidateType;
    candidateLevel?: CandidateLevel;
    minScore?: number;
    maxScore?: number;
    recommendation?: string;
  }
) {
  return useQuery({
    queryKey: resumeKeys.filtered(jobId, filters),
    queryFn: () => ResumeService.getResumeResultsWithFilters(jobId, filters),
    enabled: !!jobId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get classification summary for a job
export function useClassificationSummary(jobId: string) {
  return useQuery({
    queryKey: resumeKeys.classification(jobId),
    queryFn: () => ResumeService.getClassificationSummary(jobId),
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get job statistics
export function useJobStatistics(jobId: string) {
  return useQuery({
    queryKey: resumeKeys.statistics(jobId),
    queryFn: () => ResumeService.getJobStatistics(jobId),
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get top candidates
export function useTopCandidates(jobId: string, limit: number = 10) {
  return useQuery({
    queryKey: resumeKeys.topCandidates(jobId, limit),
    queryFn: () => ResumeService.getTopCandidates(jobId, limit),
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Search candidates
export function useSearchCandidates(jobId: string, searchTerm: string) {
  return useQuery({
    queryKey: resumeKeys.search(jobId, searchTerm),
    queryFn: () => ResumeService.searchCandidates(jobId, searchTerm),
    enabled: !!jobId && !!searchTerm && searchTerm.length > 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Create resume result mutation
export function useCreateResumeResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resumeData: ResumeResultInsert) => ResumeService.createResumeResult(resumeData),
    onSuccess: (data) => {
      if (data.job_post_id) {
        queryClient.invalidateQueries({ queryKey: resumeKeys.list(data.job_post_id) });
        queryClient.invalidateQueries({ queryKey: resumeKeys.classification(data.job_post_id) });
        queryClient.invalidateQueries({ queryKey: resumeKeys.statistics(data.job_post_id) });
      }
      queryClient.setQueryData(resumeKeys.detail(data.id), data);
      toast.success('Resume result created successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create resume result: ${error.message}`);
    },
  });
}

// Bulk create resume results mutation
export function useBulkCreateResumeResults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resumeDataArray: ResumeResultInsert[]) => 
      ResumeService.createBulkResumeResults(resumeDataArray),
    onSuccess: (data) => {
      // Invalidate queries for all affected job posts
      const jobIds = new Set(data.map(resume => resume.job_post_id).filter(Boolean));
      jobIds.forEach(jobId => {
        if (jobId) {
          queryClient.invalidateQueries({ queryKey: resumeKeys.list(jobId) });
          queryClient.invalidateQueries({ queryKey: resumeKeys.classification(jobId) });
          queryClient.invalidateQueries({ queryKey: resumeKeys.statistics(jobId) });
        }
      });
      toast.success(`${data.length} resume results created successfully!`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create resume results: ${error.message}`);
    },
  });
}

// Update resume result mutation
export function useUpdateResumeResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ resumeId, updates }: { resumeId: string; updates: ResumeResultUpdate }) =>
      ResumeService.updateResumeResult(resumeId, updates),
    onSuccess: (data) => {
      if (data.job_post_id) {
        queryClient.invalidateQueries({ queryKey: resumeKeys.list(data.job_post_id) });
        queryClient.invalidateQueries({ queryKey: resumeKeys.classification(data.job_post_id) });
        queryClient.invalidateQueries({ queryKey: resumeKeys.statistics(data.job_post_id) });
      }
      queryClient.setQueryData(resumeKeys.detail(data.id), data);
      toast.success('Resume result updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update resume result: ${error.message}`);
    },
  });
}

// Delete resume result mutation
export function useDeleteResumeResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resumeId: string) => ResumeService.deleteResumeResult(resumeId),
    onSuccess: (_, resumeId) => {
      // Get the current data to know which job to invalidate
      const currentData = queryClient.getQueryData(resumeKeys.detail(resumeId)) as ResumeResult;
      if (currentData?.job_post_id) {
        queryClient.invalidateQueries({ queryKey: resumeKeys.list(currentData.job_post_id) });
        queryClient.invalidateQueries({ queryKey: resumeKeys.classification(currentData.job_post_id) });
        queryClient.invalidateQueries({ queryKey: resumeKeys.statistics(currentData.job_post_id) });
      }
      queryClient.removeQueries({ queryKey: resumeKeys.detail(resumeId) });
      toast.success('Resume result deleted successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete resume result: ${error.message}`);
    },
  });
}

// Custom hook to get resume results with real-time updates
export function useResumeResultsWithStats(jobId: string) {
  const resumeResults = useResumeResults(jobId);
  const classificationSummary = useClassificationSummary(jobId);
  const statistics = useJobStatistics(jobId);

  return {
    resumeResults: resumeResults.data || [],
    classificationSummary: classificationSummary.data,
    statistics: statistics.data,
    isLoading: resumeResults.isLoading || classificationSummary.isLoading || statistics.isLoading,
    isError: resumeResults.isError || classificationSummary.isError || statistics.isError,
    error: resumeResults.error || classificationSummary.error || statistics.error,
    refetch: () => {
      resumeResults.refetch();
      classificationSummary.refetch();
      statistics.refetch();
    }
  };
} 