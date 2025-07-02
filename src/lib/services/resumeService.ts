import { supabase } from '../supabase';
import type { ResumeResult, ResumeResultInsert, ResumeResultUpdate, CandidateType, CandidateLevel } from '../../types/database';

export class ResumeService {
  // Create a new resume result
  static async createResumeResult(resumeData: ResumeResultInsert): Promise<ResumeResult> {
    const { data, error } = await supabase
      .from('resume_results')
      .insert(resumeData)
      .select()
      .single();

    if (error) {
      console.error('Error creating resume result:', error);
      throw new Error(`Failed to create resume result: ${error.message}`);
    }

    return data;
  }

  // Get all resume results for a job
  static async getResumeResultsByJob(jobId: string): Promise<ResumeResult[]> {
    const { data, error } = await supabase
      .from('resume_results')
      .select('*')
      .eq('job_post_id', jobId)
      .order('fit_score', { ascending: false });

    if (error) {
      console.error('Error fetching resume results:', error);
      throw new Error(`Failed to fetch resume results: ${error.message}`);
    }

    return data || [];
  }

  // Get resume result by ID
  static async getResumeResultById(resumeId: string): Promise<ResumeResult | null> {
    const { data, error } = await supabase
      .from('resume_results')
      .select('*')
      .eq('id', resumeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Resume result not found
      }
      console.error('Error fetching resume result:', error);
      throw new Error(`Failed to fetch resume result: ${error.message}`);
    }

    return data;
  }

  // Update resume result
  static async updateResumeResult(resumeId: string, updates: ResumeResultUpdate): Promise<ResumeResult> {
    const { data, error } = await supabase
      .from('resume_results')
      .update(updates)
      .eq('id', resumeId)
      .select()
      .single();

    if (error) {
      console.error('Error updating resume result:', error);
      throw new Error(`Failed to update resume result: ${error.message}`);
    }

    return data;
  }

  // Delete resume result
  static async deleteResumeResult(resumeId: string): Promise<void> {
    const { error } = await supabase
      .from('resume_results')
      .delete()
      .eq('id', resumeId);

    if (error) {
      console.error('Error deleting resume result:', error);
      throw new Error(`Failed to delete resume result: ${error.message}`);
    }
  }

  // Get resume results by filters
  static async getResumeResultsWithFilters(
    jobId: string,
    filters: {
      candidateType?: CandidateType;
      candidateLevel?: CandidateLevel;
      minScore?: number;
      maxScore?: number;
      recommendation?: string;
    }
  ): Promise<ResumeResult[]> {
    let query = supabase
      .from('resume_results')
      .select('*')
      .eq('job_post_id', jobId);

    if (filters.candidateType) {
      query = query.eq('candidate_type', filters.candidateType);
    }

    if (filters.candidateLevel) {
      query = query.eq('candidate_level', filters.candidateLevel);
    }

    if (filters.minScore !== undefined) {
      query = query.gte('fit_score', filters.minScore);
    }

    if (filters.maxScore !== undefined) {
      query = query.lte('fit_score', filters.maxScore);
    }

    if (filters.recommendation) {
      query = query.eq('recommendation', filters.recommendation);
    }

    const { data, error } = await query.order('fit_score', { ascending: false });

    if (error) {
      console.error('Error fetching filtered resume results:', error);
      throw new Error(`Failed to fetch filtered resume results: ${error.message}`);
    }

    return data || [];
  }

  // Get classification summary for a job
  static async getClassificationSummary(jobId: string): Promise<{
    [key in CandidateType]: { [level in CandidateLevel]: number }
  }> {
    const { data, error } = await supabase
      .from('resume_results')
      .select('candidate_type, candidate_level')
      .eq('job_post_id', jobId);

    if (error) {
      console.error('Error fetching classification summary:', error);
      throw new Error(`Failed to fetch classification summary: ${error.message}`);
    }

    const summary = {
      'tech': { 'entry': 0, 'mid': 0, 'senior': 0 },
      'non-tech': { 'entry': 0, 'mid': 0, 'senior': 0 },
      'semi-tech': { 'entry': 0, 'mid': 0, 'senior': 0 }
    } as { [key in CandidateType]: { [level in CandidateLevel]: number } };

    data?.forEach(result => {
      const type = result.candidate_type as CandidateType;
      const level = result.candidate_level as CandidateLevel;
      if (summary[type] && summary[type][level] !== undefined) {
        summary[type][level]++;
      }
    });

    return summary;
  }

  // Get statistics for a job
  static async getJobStatistics(jobId: string): Promise<{
    totalCandidates: number;
    averageScore: number;
    topScore: number;
    recommendationCounts: { [key: string]: number };
  }> {
    const { data, error } = await supabase
      .from('resume_results')
      .select('fit_score, recommendation')
      .eq('job_post_id', jobId);

    if (error) {
      console.error('Error fetching job statistics:', error);
      throw new Error(`Failed to fetch job statistics: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        totalCandidates: 0,
        averageScore: 0,
        topScore: 0,
        recommendationCounts: {}
      };
    }

    const scores = data.map(d => d.fit_score || 0);
    const recommendations = data.map(d => d.recommendation || 'UNKNOWN');

    const recommendationCounts: { [key: string]: number } = {};
    recommendations.forEach(rec => {
      recommendationCounts[rec] = (recommendationCounts[rec] || 0) + 1;
    });

    return {
      totalCandidates: data.length,
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      topScore: Math.max(...scores),
      recommendationCounts
    };
  }

  // Search candidates by name
  static async searchCandidates(jobId: string, searchTerm: string): Promise<ResumeResult[]> {
    const { data, error } = await supabase
      .from('resume_results')
      .select('*')
      .eq('job_post_id', jobId)
      .ilike('candidate_name', `%${searchTerm}%`)
      .order('fit_score', { ascending: false });

    if (error) {
      console.error('Error searching candidates:', error);
      throw new Error(`Failed to search candidates: ${error.message}`);
    }

    return data || [];
  }

  // Bulk create resume results
  static async createBulkResumeResults(resumeDataArray: ResumeResultInsert[]): Promise<ResumeResult[]> {
    const { data, error } = await supabase
      .from('resume_results')
      .insert(resumeDataArray)
      .select();

    if (error) {
      console.error('Error creating bulk resume results:', error);
      throw new Error(`Failed to create bulk resume results: ${error.message}`);
    }

    return data || [];
  }

  // Get top candidates for a job
  static async getTopCandidates(jobId: string, limit: number = 10): Promise<ResumeResult[]> {
    const { data, error } = await supabase
      .from('resume_results')
      .select('*')
      .eq('job_post_id', jobId)
      .order('fit_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching top candidates:', error);
      throw new Error(`Failed to fetch top candidates: ${error.message}`);
    }

    return data || [];
  }
} 