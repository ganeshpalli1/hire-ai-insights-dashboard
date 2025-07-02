import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InterviewService } from '../lib/services';
import type { InterviewSetup, InterviewSetupInsert, InterviewSetupUpdate, CandidateType, CandidateLevel } from '../types/database';
import { toast } from 'sonner';

// Query keys
export const interviewKeys = {
  all: ['interviews'] as const,
  lists: () => [...interviewKeys.all, 'list'] as const,
  details: () => [...interviewKeys.all, 'detail'] as const,
  detail: (id: string) => [...interviewKeys.details(), id] as const,
  setup: (roleType: CandidateType, level: CandidateLevel) => [...interviewKeys.all, 'setup', roleType, level] as const,
  roleType: (roleType: CandidateType) => [...interviewKeys.all, 'roleType', roleType] as const,
  level: (level: CandidateLevel) => [...interviewKeys.all, 'level', level] as const,
  matrix: () => [...interviewKeys.all, 'matrix'] as const,
  criteria: (candidateType: CandidateType, candidateLevel: CandidateLevel) => [...interviewKeys.all, 'criteria', candidateType, candidateLevel] as const,
};

// Get all interview setups
export function useInterviewSetups() {
  return useQuery({
    queryKey: interviewKeys.lists(),
    queryFn: () => InterviewService.getAllInterviewSetups(),
    staleTime: 10 * 60 * 1000, // 10 minutes - interview setups don't change often
  });
}

// Get interview setup by role type and level
export function useInterviewSetup(roleType: CandidateType, level: CandidateLevel) {
  return useQuery({
    queryKey: interviewKeys.setup(roleType, level),
    queryFn: () => InterviewService.getInterviewSetup(roleType, level),
    enabled: !!roleType && !!level,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get interview setup by ID
export function useInterviewSetupById(setupId: string) {
  return useQuery({
    queryKey: interviewKeys.detail(setupId),
    queryFn: () => InterviewService.getInterviewSetupById(setupId),
    enabled: !!setupId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get interview setups by role type
export function useInterviewSetupsByRoleType(roleType: CandidateType) {
  return useQuery({
    queryKey: interviewKeys.roleType(roleType),
    queryFn: () => InterviewService.getInterviewSetupsByRoleType(roleType),
    enabled: !!roleType,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get interview setups by level
export function useInterviewSetupsByLevel(level: CandidateLevel) {
  return useQuery({
    queryKey: interviewKeys.level(level),
    queryFn: () => InterviewService.getInterviewSetupsByLevel(level),
    enabled: !!level,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get interview setup matrix
export function useInterviewSetupMatrix() {
  return useQuery({
    queryKey: interviewKeys.matrix(),
    queryFn: () => InterviewService.getInterviewSetupMatrix(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get interview criteria for candidate
export function useInterviewCriteriaForCandidate(candidateType: CandidateType, candidateLevel: CandidateLevel) {
  return useQuery({
    queryKey: interviewKeys.criteria(candidateType, candidateLevel),
    queryFn: () => InterviewService.getInterviewCriteriaForCandidate(candidateType, candidateLevel),
    enabled: !!candidateType && !!candidateLevel,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Create interview setup mutation
export function useCreateInterviewSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (setupData: InterviewSetupInsert) => InterviewService.createInterviewSetup(setupData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interviewKeys.matrix() });
      queryClient.invalidateQueries({ queryKey: interviewKeys.roleType(data.role_type as CandidateType) });
      queryClient.invalidateQueries({ queryKey: interviewKeys.level(data.level as CandidateLevel) });
      queryClient.setQueryData(interviewKeys.detail(data.id), data);
      toast.success('Interview setup created successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create interview setup: ${error.message}`);
    },
  });
}

// Update interview setup mutation
export function useUpdateInterviewSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ setupId, updates }: { setupId: string; updates: InterviewSetupUpdate }) =>
      InterviewService.updateInterviewSetup(setupId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interviewKeys.matrix() });
      queryClient.invalidateQueries({ queryKey: interviewKeys.roleType(data.role_type as CandidateType) });
      queryClient.invalidateQueries({ queryKey: interviewKeys.level(data.level as CandidateLevel) });
      queryClient.setQueryData(interviewKeys.detail(data.id), data);
      queryClient.setQueryData(interviewKeys.setup(data.role_type as CandidateType, data.level as CandidateLevel), data);
      toast.success('Interview setup updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update interview setup: ${error.message}`);
    },
  });
}

// Update interview percentages mutation
export function useUpdateInterviewPercentages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleType,
      level,
      percentages
    }: {
      roleType: CandidateType;
      level: CandidateLevel;
      percentages: {
        screening_percentage: number;
        domain_percentage: number;
        behavioral_attitude_percentage: number;
      };
    }) => InterviewService.updateInterviewPercentages(roleType, level, percentages),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interviewKeys.matrix() });
      queryClient.invalidateQueries({ queryKey: interviewKeys.roleType(data.role_type as CandidateType) });
      queryClient.invalidateQueries({ queryKey: interviewKeys.level(data.level as CandidateLevel) });
      queryClient.setQueryData(interviewKeys.setup(data.role_type as CandidateType, data.level as CandidateLevel), data);
      toast.success('Interview percentages updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update interview percentages: ${error.message}`);
    },
  });
}

// Update interview duration mutation
export function useUpdateInterviewDuration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleType, level, duration }: { roleType: CandidateType; level: CandidateLevel; duration: number }) =>
      InterviewService.updateInterviewDuration(roleType, level, duration),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interviewKeys.matrix() });
      queryClient.setQueryData(interviewKeys.setup(data.role_type as CandidateType, data.level as CandidateLevel), data);
      toast.success('Interview duration updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update interview duration: ${error.message}`);
    },
  });
}

// Toggle fixed questions mode mutation
export function useToggleFixedQuestionsMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleType, level }: { roleType: CandidateType; level: CandidateLevel }) =>
      InterviewService.toggleFixedQuestionsMode(roleType, level),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interviewKeys.matrix() });
      queryClient.setQueryData(interviewKeys.setup(data.role_type as CandidateType, data.level as CandidateLevel), data);
      toast.success(`Fixed questions mode ${data.fixed_questions_mode ? 'enabled' : 'disabled'} successfully!`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to toggle fixed questions mode: ${error.message}`);
    },
  });
}

// Delete interview setup mutation (soft delete)
export function useDeleteInterviewSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (setupId: string) => InterviewService.deleteInterviewSetup(setupId),
    onSuccess: (_, setupId) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interviewKeys.matrix() });
      queryClient.removeQueries({ queryKey: interviewKeys.detail(setupId) });
      toast.success('Interview setup deleted successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete interview setup: ${error.message}`);
    },
  });
}

// Hard delete interview setup mutation
export function useHardDeleteInterviewSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (setupId: string) => InterviewService.hardDeleteInterviewSetup(setupId),
    onSuccess: (_, setupId) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interviewKeys.matrix() });
      queryClient.removeQueries({ queryKey: interviewKeys.detail(setupId) });
      toast.success('Interview setup permanently deleted!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to permanently delete interview setup: ${error.message}`);
    },
  });
}

// Custom hook to validate interview percentages
export function useValidateInterviewPercentages() {
  return {
    validatePercentages: (
      screening: number,
      domain: number,
      behavioral: number,
      communication: number
    ): { isValid: boolean; total: number; error?: string } => {
      const total = screening + domain + behavioral + communication;
      
      if (total !== 100) {
        return {
          isValid: false,
          total,
          error: `Percentages must sum to 100% (current total: ${total}%)`
        };
      }

      if ([screening, domain, behavioral, communication].some(p => p < 0 || p > 100)) {
        return {
          isValid: false,
          total,
          error: 'Each percentage must be between 0 and 100'
        };
      }

      return { isValid: true, total };
    }
  };
}

// Custom hook to get interview setup with criteria for candidate
export function useInterviewSetupForCandidate(candidateType: CandidateType, candidateLevel: CandidateLevel) {
  const interviewSetup = useInterviewSetup(candidateType, candidateLevel);
  const criteria = useInterviewCriteriaForCandidate(candidateType, candidateLevel);

  return {
    setup: interviewSetup.data,
    criteria: criteria.data,
    isLoading: interviewSetup.isLoading || criteria.isLoading,
    isError: interviewSetup.isError || criteria.isError,
    error: interviewSetup.error || criteria.error,
    refetch: () => {
      interviewSetup.refetch();
      criteria.refetch();
    }
  };
} 