import { supabase } from '../supabase';
import type { JobPost, JobPostInsert, JobPostUpdate } from '../../types/database';

export class JobService {
  // Create a new job post
  static async createJob(jobData: JobPostInsert): Promise<JobPost> {
    const { data, error } = await supabase
      .from('job_posts')
      .insert(jobData)
      .select()
      .single();

    if (error) {
      console.error('Error creating job:', error);
      throw new Error(`Failed to create job: ${error.message}`);
    }

    return data;
  }

  // Get all jobs
  static async getAllJobs(): Promise<JobPost[]> {
    const { data, error } = await supabase
      .from('job_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching jobs:', error);
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }

    return data || [];
  }

  // Get job by ID
  static async getJobById(jobId: string): Promise<JobPost | null> {
    const { data, error } = await supabase
      .from('job_posts')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Job not found
      }
      console.error('Error fetching job:', error);
      throw new Error(`Failed to fetch job: ${error.message}`);
    }

    return data;
  }

  // Update job
  static async updateJob(jobId: string, updates: JobPostUpdate): Promise<JobPost> {
    const { data, error } = await supabase
      .from('job_posts')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      console.error('Error updating job:', error);
      throw new Error(`Failed to update job: ${error.message}`);
    }

    return data;
  }

  // Update job analysis
  static async updateJobAnalysis(jobId: string, analysis: any): Promise<JobPost> {
    return this.updateJob(jobId, { job_description_analysis: analysis });
  }

  // Delete job
  static async deleteJob(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('job_posts')
      .delete()
      .eq('id', jobId);

    if (error) {
      console.error('Error deleting job:', error);
      throw new Error(`Failed to delete job: ${error.message}`);
    }
  }

  // Get jobs by status
  static async getJobsByStatus(status: string): Promise<JobPost[]> {
    const { data, error } = await supabase
      .from('job_posts')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching jobs by status:', error);
      throw new Error(`Failed to fetch jobs by status: ${error.message}`);
    }

    return data || [];
  }

  // Update job status
  static async updateJobStatus(jobId: string, status: string): Promise<JobPost> {
    return this.updateJob(jobId, { status });
  }

  // Search jobs
  static async searchJobs(searchTerm: string): Promise<JobPost[]> {
    const { data, error } = await supabase
      .from('job_posts')
      .select('*')
      .or(`job_role.ilike.%${searchTerm}%,job_description.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching jobs:', error);
      throw new Error(`Failed to search jobs: ${error.message}`);
    }

    return data || [];
  }
} 

export interface JobWithApplicantCount {
  id: string;
  job_role: string;
  required_experience: string;
  job_description: string;
  job_description_analysis: any;
  status: string;
  created_at: string;
  updated_at: string;
  applicant_count: number;
}

/**
 * Get all jobs with their applicant counts
 */
export const getJobsWithApplicantCounts = async (): Promise<JobWithApplicantCount[]> => {
  try {
    console.log('🔍 Fetching jobs with applicant counts from Supabase...');
    
    // First, get all jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('job_posts')
      .select(`
        id,
        job_role,
        required_experience,
        job_description,
        job_description_analysis,
        status,
        created_at,
        updated_at
      `);

    if (jobsError) {
      console.error('❌ Error fetching jobs:', jobsError);
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      console.log('📝 No jobs found in database');
      return [];
    }

    console.log(`📋 Found ${jobs.length} jobs, now counting applicants...`);

    // Get applicant counts for each job
    const jobsWithCounts: JobWithApplicantCount[] = await Promise.all(
      jobs.map(async (job) => {
        const applicantCount = await getJobApplicantCount(job.id);
        return {
          id: job.id,
          job_role: job.job_role,
          required_experience: job.required_experience,
          job_description: job.job_description,
          job_description_analysis: job.job_description_analysis,
          status: job.status || 'active',
          created_at: job.created_at,
          updated_at: job.updated_at,
          applicant_count: applicantCount
        };
      })
    );

    console.log('✅ Successfully fetched jobs with applicant counts:', jobsWithCounts);
    return jobsWithCounts;

  } catch (error) {
    console.error('❌ Failed to fetch jobs with applicant counts:', error);
    throw error;
  }
};

/**
 * Get applicant count for a specific job
 */
export const getJobApplicantCount = async (jobId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('resume_results')
      .select('*', { count: 'exact', head: true })
      .eq('job_post_id', jobId);

    if (error) {
      console.error('❌ Error fetching applicant count for job:', jobId, error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Failed to fetch applicant count for job:', jobId, error);
    return 0;
  }
};

/**
 * Get detailed applicant statistics for all jobs
 */
export const getJobApplicantStats = async () => {
  try {
    console.log('📊 Fetching detailed applicant statistics...');
    
    const { data, error } = await supabase.rpc('get_job_applicant_stats');
    
    if (error) {
      console.error('❌ Error fetching applicant stats:', error);
      // Fallback to basic count query
      return await getJobsWithApplicantCounts();
    }

    return data || [];
  } catch (error) {
    console.error('❌ Failed to fetch applicant stats:', error);
    // Fallback to basic count query
    return await getJobsWithApplicantCounts();
  }
}; 