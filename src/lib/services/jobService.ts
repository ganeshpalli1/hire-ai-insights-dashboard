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