import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { JobService } from '../lib/services';
import type { JobPost, JobPostInsert, JobPostUpdate } from '../types/database';
import { toast } from 'sonner';

// Query keys
export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (filters: string) => [...jobKeys.lists(), { filters }] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
  search: (term: string) => [...jobKeys.all, 'search', term] as const,
  status: (status: string) => [...jobKeys.all, 'status', status] as const,
};

// Get all jobs
export function useJobs() {
  return useQuery({
    queryKey: jobKeys.lists(),
    queryFn: () => JobService.getAllJobs(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get job by ID
export function useJob(jobId: string) {
  return useQuery({
    queryKey: jobKeys.detail(jobId),
    queryFn: () => JobService.getJobById(jobId),
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get jobs by status
export function useJobsByStatus(status: string) {
  return useQuery({
    queryKey: jobKeys.status(status),
    queryFn: () => JobService.getJobsByStatus(status),
    enabled: !!status,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Search jobs
export function useSearchJobs(searchTerm: string) {
  return useQuery({
    queryKey: jobKeys.search(searchTerm),
    queryFn: () => JobService.searchJobs(searchTerm),
    enabled: !!searchTerm && searchTerm.length > 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Create job mutation
export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobData: JobPostInsert) => JobService.createJob(jobData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.setQueryData(jobKeys.detail(data.id), data);
      toast.success('Job created successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create job: ${error.message}`);
    },
  });
}

// Update job mutation
export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, updates }: { jobId: string; updates: JobPostUpdate }) =>
      JobService.updateJob(jobId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.setQueryData(jobKeys.detail(data.id), data);
      toast.success('Job updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update job: ${error.message}`);
    },
  });
}

// Update job analysis mutation
export function useUpdateJobAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, analysis }: { jobId: string; analysis: any }) =>
      JobService.updateJobAnalysis(jobId, analysis),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.setQueryData(jobKeys.detail(data.id), data);
      toast.success('Job analysis updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update job analysis: ${error.message}`);
    },
  });
}

// Update job status mutation
export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: string }) =>
      JobService.updateJobStatus(jobId, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.status(data.status || '') });
      queryClient.setQueryData(jobKeys.detail(data.id), data);
      toast.success('Job status updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update job status: ${error.message}`);
    },
  });
}

// Delete job mutation
export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => JobService.deleteJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.removeQueries({ queryKey: jobKeys.detail(jobId) });
      toast.success('Job deleted successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete job: ${error.message}`);
    },
  });
} 