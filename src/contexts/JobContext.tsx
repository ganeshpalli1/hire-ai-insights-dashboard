import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ResumeScreeningApi, { 
  Job, 
  JobDescriptionInput, 
  ResumeAnalysisResult, 
  ProcessingStatus,
  JobResultsResponse 
} from '../lib/api';
import { toast } from 'sonner';

interface JobWithId extends Job {
  id: string;
  status: 'Active' | 'Draft' | 'Processing';
  applicants: number;
  dateCreated: string;
}

interface JobContextType {
  jobs: JobWithId[];
  isLoading: boolean;
  isLoadingInitialData: boolean;
  createJob: (jobData: JobDescriptionInput) => Promise<string>;
  deleteJob: (jobId: string) => Promise<void>;
  getJob: (id: string) => JobWithId | undefined;
  getJobResults: (jobId: string, filters?: any) => Promise<JobResultsResponse>;
  uploadResumes: (jobId: string, files: FileList) => Promise<void>;
  getProcessingStatus: (jobId: string) => Promise<ProcessingStatus>;
  pollProcessingStatus: (jobId: string, onUpdate: (status: ProcessingStatus) => void) => Promise<ProcessingStatus>;
  refreshJobs: () => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<JobWithId[]>([]);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const queryClient = useQueryClient();

  // Load existing jobs from backend on component mount
  useEffect(() => {
    const loadExistingJobs = async () => {
      try {
        setIsLoadingInitialData(true);
        console.log('Loading existing jobs from database...');
        
        const jobsData = await ResumeScreeningApi.getAllJobs();
        console.log('Loaded existing jobs:', jobsData);
        
        // Transform API data to match our JobWithId interface
        const transformedJobs: JobWithId[] = jobsData.map(job => ({
          id: job.id || '',
          job_role: job.job_role,
          required_experience: job.required_experience,
          description: job.description,
          created_at: job.created_at,
          analysis: job.analysis,
          dateCreated: new Date(job.created_at).toISOString().split('T')[0],
          status: job.analysis ? 'Active' : 'Processing',
          applicants: 0, // TODO: Get actual count from resume results
        }));
        
        setJobs(transformedJobs);
        setJobIds(transformedJobs.map(job => job.id));
        
        if (transformedJobs.length > 0) {
          toast.success(`Loaded ${transformedJobs.length} existing jobs from database`);
        }
        
      } catch (error) {
        console.error('Error loading existing jobs:', error);
        toast.error('Failed to load existing jobs from database');
      } finally {
        setIsLoadingInitialData(false);
      }
    };

    loadExistingJobs();
  }, []);

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (jobData: JobDescriptionInput) => {
      return await ResumeScreeningApi.createJob(jobData);
    },
    onSuccess: (data, variables) => {
      // Add the new job to our local state
      const newJob: JobWithId = {
        id: data.job_id,
        job_role: variables.job_role,
        required_experience: variables.required_experience,
        description: variables.description,
        created_at: new Date().toISOString(),
        dateCreated: new Date().toISOString().split('T')[0],
        status: 'Processing',
        applicants: 0,
        analysis: null,
      };
      
      setJobs(prev => [...prev, newJob]);
      setJobIds(prev => [...prev, data.job_id]);
      
      // Start polling for job analysis completion
      pollJobAnalysis(data.job_id);
      
      toast.success('Job created successfully!', {
        description: `${variables.job_role} is being analyzed by AI.`,
      });
    },
    onError: (error) => {
      console.error('Error creating job:', error);
      toast.error('Failed to create job', {
        description: 'Please try again later.',
      });
    },
  });

  // Poll for job analysis completion
  const pollJobAnalysis = useCallback(async (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts = 1 minute with 2s intervals
    
    const poll = async () => {
      try {
        const jobData = await ResumeScreeningApi.getJob(jobId);
        
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { 
                ...job, 
                analysis: jobData.analysis,
                status: jobData.analysis ? 'Active' : 'Processing'
              }
            : job
        ));
        
        if (jobData.analysis) {
          toast.success('Job analysis complete!', {
            description: 'You can now upload resumes for screening.',
          });
          return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          // Timeout - mark as active anyway
          setJobs(prev => prev.map(job => 
            job.id === jobId ? { ...job, status: 'Active' } : job
          ));
          toast.warning('Job analysis is taking longer than expected', {
            description: 'You can still proceed with resume uploads.',
          });
        }
      } catch (error) {
        console.error('Error polling job analysis:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        }
      }
    };
    
    poll();
  }, []);

  // Upload resumes mutation
  const uploadResumesMutation = useMutation({
    mutationFn: async ({ jobId, files }: { jobId: string; files: FileList }) => {
      return await ResumeScreeningApi.uploadResumes(jobId, files);
    },
    onSuccess: (data) => {
      toast.success('Resumes uploaded successfully!', {
        description: `${data.resumes_uploaded} resumes are being processed.`,
      });
    },
    onError: (error) => {
      console.error('Error uploading resumes:', error);
      toast.error('Failed to upload resumes', {
        description: 'Please try again later.',
      });
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await ResumeScreeningApi.deleteJob(jobId);
    },
    onSuccess: (data, jobId) => {
      // Remove the job from local state
      setJobs(prev => prev.filter(job => job.id !== jobId));
      setJobIds(prev => prev.filter(id => id !== jobId));
      
      toast.success('Job deleted successfully!', {
        description: `Job and all associated data have been removed.`,
      });
    },
    onError: (error) => {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job', {
        description: 'Please try again later.',
      });
    },
  });

  // API functions
  const createJob = useCallback(async (jobData: JobDescriptionInput): Promise<string> => {
    const result = await createJobMutation.mutateAsync(jobData);
    return result.job_id;
  }, [createJobMutation]);

  const deleteJob = useCallback(async (jobId: string): Promise<void> => {
    await deleteJobMutation.mutateAsync(jobId);
  }, [deleteJobMutation]);

  const getJob = useCallback((id: string) => {
    return jobs.find(job => job.id === id);
  }, [jobs]);

  const getJobResults = useCallback(async (jobId: string, filters?: any) => {
    return await ResumeScreeningApi.getJobResults(jobId, filters);
  }, []);

  const uploadResumes = useCallback(async (jobId: string, files: FileList) => {
    await uploadResumesMutation.mutateAsync({ jobId, files });
  }, [uploadResumesMutation]);

  const getProcessingStatus = useCallback(async (jobId: string) => {
    return await ResumeScreeningApi.getProcessingStatus(jobId);
  }, []);

  const pollProcessingStatus = useCallback(async (
    jobId: string, 
    onUpdate: (status: ProcessingStatus) => void
  ) => {
    return await ResumeScreeningApi.pollProcessingStatus(jobId, onUpdate);
  }, []);

  const refreshJobs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    // Reload jobs from backend
    const loadExistingJobs = async () => {
      try {
        setIsLoadingInitialData(true);
        const jobsData = await ResumeScreeningApi.getAllJobs();
        
        const transformedJobs: JobWithId[] = jobsData.map(job => ({
          id: job.id || '',
          job_role: job.job_role,
          required_experience: job.required_experience,
          description: job.description,
          created_at: job.created_at,
          analysis: job.analysis,
          dateCreated: new Date(job.created_at).toISOString().split('T')[0],
          status: job.analysis ? 'Active' : 'Processing',
          applicants: 0,
        }));
        
        setJobs(transformedJobs);
        setJobIds(transformedJobs.map(job => job.id));
        
      } catch (error) {
        console.error('Error refreshing jobs:', error);
        toast.error('Failed to refresh jobs');
      } finally {
        setIsLoadingInitialData(false);
      }
    };
    loadExistingJobs();
  }, [queryClient]);

  const value: JobContextType = {
    jobs,
    isLoading: createJobMutation.isPending || uploadResumesMutation.isPending || deleteJobMutation.isPending,
    isLoadingInitialData,
    createJob,
    deleteJob,
    getJob,
    getJobResults,
    uploadResumes,
    getProcessingStatus,
    pollProcessingStatus,
    refreshJobs,
  };

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};
