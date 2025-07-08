// Export all services
export { JobService } from './jobService';
export { ResumeService } from './resumeService';
export { InterviewService } from './interviewService';

// Export new job service functions
export { 
  getJobsWithApplicantCounts, 
  getJobApplicantCount, 
  getJobApplicantStats,
  type JobWithApplicantCount 
} from './jobService';

// Export all types
export type {
  JobPost,
  JobPostInsert,
  JobPostUpdate,
  ResumeResult,
  ResumeResultInsert,
  ResumeResultUpdate,
  InterviewSetup,
  InterviewSetupInsert,
  InterviewSetupUpdate,
  CandidateType,
  CandidateLevel,
  RecommendationType
} from '../../types/database';

// Re-export supabase client
export { supabase, testSupabaseConnection } from '../supabase'; 