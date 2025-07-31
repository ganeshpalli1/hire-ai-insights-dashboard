import { supabase } from '../supabase';
import type { InterviewSetup, InterviewSetupInsert, InterviewSetupUpdate, CandidateType, CandidateLevel, InterviewSession, InterviewSessionInsert } from '../../types/database';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://chandanbackend-gbh6bdgzepaxd9fn.canadacentral-01.azurewebsites.net'; // Use environment variable or fallback to Azure backend

export class InterviewService {
  // Create a new interview setup
  static async createInterviewSetup(setupData: InterviewSetupInsert): Promise<InterviewSetup> {
    const { data, error } = await supabase
      .from('interview_setup')
      .insert(setupData)
      .select()
      .single();

    if (error) {
      console.error('Error creating interview setup:', error);
      throw new Error(`Failed to create interview setup: ${error.message}`);
    }

    return data;
  }

  // Get all interview setups
  static async getAllInterviewSetups(): Promise<InterviewSetup[]> {
    const { data, error } = await supabase
      .from('interview_setup')
      .select('*')
      .eq('is_active', true)
      .order('role_type', { ascending: true })
      .order('level', { ascending: true });

    if (error) {
      console.error('Error fetching interview setups:', error);
      throw new Error(`Failed to fetch interview setups: ${error.message}`);
    }

    return data || [];
  }

  // Get interview setup by role type and level
  static async getInterviewSetup(roleType: CandidateType, level: CandidateLevel): Promise<InterviewSetup | null> {
    const { data, error } = await supabase
      .from('interview_setup')
      .select('*')
      .eq('role_type', roleType)
      .eq('level', level)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Multiple rows found - this happens when there are multiple job posts
        console.warn(`Multiple interview setups found for ${roleType}/${level}. This is expected when you have multiple job posts.`);
        return null; // Return null instead of throwing error
      }
      console.error('Error fetching interview setup:', error);
      throw new Error(`Failed to fetch interview setup: ${error.message}`);
    }

    return data;
  }

  // Get interview setup by ID
  static async getInterviewSetupById(setupId: string): Promise<InterviewSetup | null> {
    const { data, error } = await supabase
      .from('interview_setup')
      .select('*')
      .eq('id', setupId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Interview setup not found
      }
      console.error('Error fetching interview setup:', error);
      throw new Error(`Failed to fetch interview setup: ${error.message}`);
    }

    return data;
  }

  // Update interview setup
  static async updateInterviewSetup(setupId: string, updates: InterviewSetupUpdate): Promise<InterviewSetup> {
    const { data, error } = await supabase
      .from('interview_setup')
      .update(updates)
      .eq('id', setupId)
      .select()
      .single();

    if (error) {
      console.error('Error updating interview setup:', error);
      throw new Error(`Failed to update interview setup: ${error.message}`);
    }

    return data;
  }

  // Delete interview setup (soft delete by setting is_active to false)
  static async deleteInterviewSetup(setupId: string): Promise<void> {
    const { error } = await supabase
      .from('interview_setup')
      .update({ is_active: false })
      .eq('id', setupId);

    if (error) {
      console.error('Error deleting interview setup:', error);
      throw new Error(`Failed to delete interview setup: ${error.message}`);
    }
  }

  // Hard delete interview setup
  static async hardDeleteInterviewSetup(setupId: string): Promise<void> {
    const { error } = await supabase
      .from('interview_setup')
      .delete()
      .eq('id', setupId);

    if (error) {
      console.error('Error hard deleting interview setup:', error);
      throw new Error(`Failed to hard delete interview setup: ${error.message}`);
    }
  }

  // Get interview setups by role type
  static async getInterviewSetupsByRoleType(roleType: CandidateType): Promise<InterviewSetup[]> {
    const { data, error } = await supabase
      .from('interview_setup')
      .select('*')
      .eq('role_type', roleType)
      .eq('is_active', true)
      .order('level', { ascending: true });

    if (error) {
      console.error('Error fetching interview setups by role type:', error);
      throw new Error(`Failed to fetch interview setups by role type: ${error.message}`);
    }

    return data || [];
  }

  // Get interview setups by level
  static async getInterviewSetupsByLevel(level: CandidateLevel): Promise<InterviewSetup[]> {
    const { data, error } = await supabase
      .from('interview_setup')
      .select('*')
      .eq('level', level)
      .eq('is_active', true)
      .order('role_type', { ascending: true });

    if (error) {
      console.error('Error fetching interview setups by level:', error);
      throw new Error(`Failed to fetch interview setups by level: ${error.message}`);
    }

    return data || [];
  }

  // Get interview criteria for candidate
  static async getInterviewCriteriaForCandidate(candidateType: CandidateType, candidateLevel: CandidateLevel): Promise<{
    screening_percentage: number;
    domain_percentage: number;
    behavioral_attitude_percentage: number;
    interview_duration: number;
    experience_range: string;
    fixed_questions_mode: boolean;
  } | null> {
    const setup = await this.getInterviewSetup(candidateType, candidateLevel);
    
    if (!setup) {
      return null;
    }

    return {
      screening_percentage: setup.screening_percentage,
      domain_percentage: setup.domain_percentage,
      behavioral_attitude_percentage: setup.behavioral_attitude_percentage,
      interview_duration: setup.interview_duration || 60,
      experience_range: setup.experience_range,
      fixed_questions_mode: setup.fixed_questions_mode || true
    };
  }

  // Update interview duration
  static async updateInterviewDuration(roleType: CandidateType, level: CandidateLevel, duration: number): Promise<InterviewSetup> {
    const { data, error } = await supabase
      .from('interview_setup')
      .update({ interview_duration: duration })
      .eq('role_type', roleType)
      .eq('level', level)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Multiple interview setups found for ${roleType}/${level}. Cannot update without specifying job_post_id.`);
      }
      console.error('Error updating interview duration:', error);
      throw new Error(`Failed to update interview duration: ${error.message}`);
    }

    return data;
  }

  // Toggle fixed questions mode
  static async toggleFixedQuestionsMode(roleType: CandidateType, level: CandidateLevel): Promise<InterviewSetup> {
    const currentSetup = await this.getInterviewSetup(roleType, level);
    if (!currentSetup) {
      throw new Error('Interview setup not found');
    }

    const { data, error } = await supabase
      .from('interview_setup')
      .update({ fixed_questions_mode: !currentSetup.fixed_questions_mode })
      .eq('role_type', roleType)
      .eq('level', level)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Multiple interview setups found for ${roleType}/${level}. Cannot update without specifying job_post_id.`);
      }
      console.error('Error toggling fixed questions mode:', error);
      throw new Error(`Failed to toggle fixed questions mode: ${error.message}`);
    }

    return data;
  }

  // Get interview setup matrix (all combinations of role types and levels)
  static async getInterviewSetupMatrix(): Promise<{
    [key in CandidateType]: { [level in CandidateLevel]: InterviewSetup | null }
  }> {
    const allSetups = await this.getAllInterviewSetups();
    
    const matrix = {
      'tech': { 'entry': null, 'mid': null, 'senior': null },
      'non-tech': { 'entry': null, 'mid': null, 'senior': null },
      'semi-tech': { 'entry': null, 'mid': null, 'senior': null }
    } as { [key in CandidateType]: { [level in CandidateLevel]: InterviewSetup | null } };

    allSetups.forEach(setup => {
      const roleType = setup.role_type as CandidateType;
      const level = setup.level as CandidateLevel;
      if (matrix[roleType] && !matrix[roleType][level]) {
        // Only set if not already set (handles multiple job posts)
        matrix[roleType][level] = setup;
      }
    });

    return matrix;
  }

  // Validate interview percentages (should sum to 100)
  static validateInterviewPercentages(
    screening: number,
    domain: number,
    behavioral: number
  ): boolean {
    const total = screening + domain + behavioral;
    return total === 100;
  }

  // Update interview percentages
  static async updateInterviewPercentages(
    roleType: CandidateType,
    level: CandidateLevel,
    percentages: {
      screening_percentage: number;
      domain_percentage: number;
      behavioral_attitude_percentage: number;
    }
  ): Promise<InterviewSetup> {
    // Validate percentages sum to 100
    if (!this.validateInterviewPercentages(
      percentages.screening_percentage,
      percentages.domain_percentage,
      percentages.behavioral_attitude_percentage
    )) {
      throw new Error('Interview percentages must sum to 100');
    }

    const { data, error } = await supabase
      .from('interview_setup')
      .update(percentages)
      .eq('role_type', roleType)
      .eq('level', level)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Multiple interview setups found for ${roleType}/${level}. Cannot update without specifying job_post_id.`);
      }
      console.error('Error updating interview percentages:', error);
      throw new Error(`Failed to update interview percentages: ${error.message}`);
    }

    return data;
  }

  // Generate interview link for a candidate
  static async generateInterviewLink(candidateId: string): Promise<{
    session_id: string;
    session_url: string;
    candidate_name: string;
    job_role: string;
    questions_count: number;
    expires_at: string;
    interview_focus: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/generate-interview-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.text();
          if (errorBody) {
            errorMessage += ` - ${errorBody}`;
          }
        } catch (textError) {
          // Ignore if reading text body fails
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.status === 'error') {
        throw new Error(result.error);
      }

      return result.data;
    } catch (error) {
      console.error('Error generating interview link:', error);
      throw new Error(`Failed to generate interview link: ${error.message}`);
    }
  }

  // Get interview session data
  static async getInterviewSession(sessionId: string): Promise<{
    session_id: string;
    candidate_name: string;
    interview_prompt: string;
    generated_questions: any;
    status: string;
    created_at: string;
    expires_at: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}`);
      if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.text();
          if (errorBody) {
            errorMessage += ` - ${errorBody}`;
          }
        } catch (textError) {
          // Ignore if reading text body fails
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.status === 'error') {
        throw new Error(result.error);
      }

      return result.data;
    } catch (error) {
      console.error('Error fetching interview session:', error);
      throw new Error(`Failed to fetch interview session: ${error.message}`);
    }
  }

  // Update interview session status
  static async updateInterviewSessionStatus(sessionId: string, status: string): Promise<InterviewSession> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.text();
          if (errorBody) {
            errorMessage += ` - ${errorBody}`;
          }
        } catch (textError) {
          // Ignore if reading text body fails
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.status === 'error') {
        throw new Error(result.error);
      }

      return result.data;
    } catch (error) {
      console.error('Error updating interview session status:', error);
      throw new Error(`Failed to update interview session status: ${error.message}`);
    }
  }

  // Mark interview as completed, fetch transcript & analysis
  static async completeInterview(sessionId: string, conversationId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete interview');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error completing interview:', error);
      throw error;
    }
  }

  static async completeInterviewWithTranscript(
    sessionId: string, 
    transcript: string,
    transcriptEntries: any[],
    startedAt: Date,
    endedAt: Date,
    durationSeconds: number,
    cheatingFlags: string[],
    fullscreenExitCount: number
  ): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}/complete-with-transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          transcript_entries: transcriptEntries,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          duration_seconds: durationSeconds,
          cheating_flags: cheatingFlags,
          fullscreen_exit_count: fullscreenExitCount,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.error || 'Failed to complete interview with transcript');
      }
      
      const result = await response.json();
      
      // Check if the backend returned an error status in the response body
      if (result.status === 'error') {
        throw new Error(result.error || 'Failed to save interview results to database');
      }
      return result.data;
    } catch (error) {
      console.error('Error completing interview with transcript:', error);
      throw error;
    }
  }

  static async getStoredTranscript(sessionId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}/transcript`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get transcript');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error getting transcript:', error);
      throw error;
    }
  }

  static async analyzeStoredTranscript(sessionId: string, reason?: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/interviews/analyze-stored-transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          reason: reason || 'Manual re-analysis',
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze stored transcript');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error analyzing stored transcript:', error);
      throw error;
    }
  }

  static async getInterviewResults(sessionId: string): Promise<any> {
    const resp = await fetch(`${API_BASE_URL}/api/interviews/${sessionId}/results`);
    const data = await resp.json();
    if (!resp.ok || data.status === 'error') {
      throw new Error(data.error || resp.statusText);
    }
    return data.data;
  }

  // Get all interview results for a job
  static async getJobInterviewResults(jobId: string): Promise<any[]> {
    const resp = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/interview-results`);
    const data = await resp.json();
    if (!resp.ok || data.status === 'error') {
      throw new Error(data.error || resp.statusText);
    }
    return data.results;
  }
} 