// API Service for Resume Screening Backend Integration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backendb2b.azurewebsites.net';

// Types matching the backend models
export interface JobDescriptionInput {
  job_role: string;
  required_experience: string;
  description: string;
}

export interface ResumeClassification {
  category: 'tech' | 'non-tech' | 'semi-tech';
  level: 'entry' | 'mid' | 'senior';
  confidence: number;
}

// Interview Setup Types
export interface InterviewSetupInput {
  role_type: 'tech' | 'non-tech' | 'semi-tech';
  level: 'entry' | 'mid' | 'senior';
  experience_range: string;
  screening_percentage: number;
  domain_percentage: number;
  behavioral_attitude_percentage: number;
  communication_percentage?: number; // Optional, defaults to 0 - not used for questions but required for DB compatibility
  number_of_questions?: number;
  estimated_duration?: number;
  interview_duration?: number;
  fixed_questions_mode?: boolean;
  question_template?: string; // Optional template or prompt for question generation
}

export interface MultipleInterviewSetupInput {
  configurations: InterviewSetupInput[];
  replace_all?: boolean;
}

export interface InterviewSetupResponse {
  id: string;
  job_post_id: string;
  role_type: string;
  level: string;
  experience_range: string;
  screening_percentage: number;
  domain_percentage: number;
  behavioral_attitude_percentage: number;
  communication_percentage: number;
  number_of_questions: number;
  estimated_duration: number;
  interview_duration?: number;
  fixed_questions_mode: boolean;
  question_template?: string; // Optional template or prompt for question generation
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InterviewSetupMatrixResponse {
  status: string;
  data: {
    matrix: {
      [roleType: string]: {
        [level: string]: InterviewSetupResponse | null;
      };
    };
    configurations: InterviewSetupResponse[];
    total_configurations: number;
  };
}

export interface ResumeAnalysisResult {
  resume_id: string;
  filename: string;
  classification: ResumeClassification;
  fit_score: number;
  matching_skills: string[];
  missing_skills: string[];
  recommendation: 'STRONG_FIT' | 'GOOD_FIT' | 'MODERATE_FIT' | 'WEAK_FIT';
  detailed_analysis: {
    classification_fit: {
      category_match: boolean;
      level_match: boolean;
      fit_explanation: string;
    };
    matching_skills: {
      technical: string[];
      soft: string[];
      domain: string[];
    };
    missing_skills: {
      critical: string[];
      important: string[];
    };
    experience_match: {
      years_of_experience: string;
      relevant_experience: string;
      experience_score: number;
    };
    education_match: {
      meets_requirements: boolean;
      details: string;
    };
    project_relevance: {
      relevant_projects: string[];
      technologies_used: string[];
      relevance_score: number;
    };
    strengths: string[];
    weaknesses: string[];
    detailed_feedback: string;
  };
}

export interface JobAnalysis {
  required_skills: {
    technical: string[];
    soft: string[];
    domain: string[];
  };
  nice_to_have_skills: string[];
  key_responsibilities: string[];
  required_qualifications: string[];
  experience_requirements: {
    years: string;
    type: string;
  };
  technology_stack: string[];
  industry_domain: string;
  job_category: string;
}

export interface Job {
  id?: string;
  job_role: string;
  required_experience: string;
  description: string;
  created_at: string;
  analysis: JobAnalysis | null;
}

export interface ProcessingStatus {
  job_id: string;
  total_resumes: number;
  processed_resumes: number;
  pending_resumes: number;
  completion_percentage: number;
}

export interface JobResultsResponse {
  job_id: string;
  total_results: number;
  offset: number;
  limit: number;
  classification_summary: Record<string, Record<string, number>>;
  results: ResumeAnalysisResult[];
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// API Helper functions
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, errorText || response.statusText);
  }

  return response.json();
}

async function uploadFiles(endpoint: string, files: FileList): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  const formData = new FormData();
  
  Array.from(files).forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, errorText || response.statusText);
  }

  return response.json();
}

// API Service class
export class ResumeScreeningApi {
  // Create a new job
  static async createJob(jobData: JobDescriptionInput): Promise<{ job_id: string; status: string }> {
    return apiRequest('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  // Get job details
  static async getJob(jobId: string): Promise<Job> {
    return apiRequest(`/api/jobs/${jobId}`);
  }

  // Delete job
  static async deleteJob(jobId: string): Promise<{ status: string; message: string; job_id: string }> {
    return apiRequest(`/api/jobs/${jobId}`, {
      method: 'DELETE',
    });
  }

  // Get all jobs
  static async getAllJobs(): Promise<Job[]> {
    const response = await apiRequest<{ status: string; data: Job[] }>('/api/jobs');
    if (response.status === 'success') {
      return response.data || [];
    }
    throw new Error('Failed to fetch jobs');
  }

  // Upload resumes for a job
  static async uploadResumes(jobId: string, files: FileList): Promise<{
    job_id: string;
    resumes_uploaded: number;
    status: string;
  }> {
    return uploadFiles(`/api/jobs/${jobId}/resumes`, files);
  }

  // Get job results with filtering
  static async getJobResults(
    jobId: string,
    options: {
      min_score?: number;
      category?: string;
      level?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<JobResultsResponse> {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const queryString = params.toString();
    const endpoint = `/api/jobs/${jobId}/results${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest(endpoint);
  }

  // Get processing status
  static async getProcessingStatus(jobId: string): Promise<ProcessingStatus> {
    return apiRequest(`/api/jobs/${jobId}/status`);
  }

  // Health check
  static async healthCheck(): Promise<{ status: string; timestamp: string; active_jobs: number }> {
    return apiRequest('/api/health');
  }

  // Poll processing status until complete
  static async pollProcessingStatus(
    jobId: string,
    onUpdate: (status: ProcessingStatus) => void,
    intervalMs: number = 2000
  ): Promise<ProcessingStatus> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getProcessingStatus(jobId);
          onUpdate(status);
          
          if (status.completion_percentage >= 100) {
            resolve(status);
          } else {
            setTimeout(poll, intervalMs);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  }

  // Interview Setup API methods
  
  // Create or update interview setup for a job
  static async createInterviewSetup(
    jobId: string,
    setupData: InterviewSetupInput
  ): Promise<{ status: string; data: InterviewSetupResponse }> {
    return apiRequest(`/api/jobs/${jobId}/interview-setup`, {
      method: 'POST',
      body: JSON.stringify(setupData),
    });
  }

  // Get interview setup for a job
  static async getInterviewSetup(
    jobId: string
  ): Promise<{ status: string; data: InterviewSetupResponse[] }> {
    return apiRequest(`/api/jobs/${jobId}/interview-setup`);
  }

  // Update interview setup
  static async updateInterviewSetup(
    jobId: string,
    setupId: string,
    setupData: Partial<InterviewSetupInput>
  ): Promise<{ status: string; data: InterviewSetupResponse }> {
    return apiRequest(`/api/jobs/${jobId}/interview-setup/${setupId}`, {
      method: 'PUT',
      body: JSON.stringify(setupData),
    });
  }

  // Delete interview setup
  static async deleteInterviewSetup(
    jobId: string,
    setupId: string
  ): Promise<{ status: string; message: string }> {
    return apiRequest(`/api/jobs/${jobId}/interview-setup/${setupId}`, {
      method: 'DELETE',
    });
  }

  // Create multiple interview setups for a job
  static async createMultipleInterviewSetups(
    jobId: string,
    setupData: MultipleInterviewSetupInput
  ): Promise<{ status: string; data: InterviewSetupResponse[]; message: string }> {
    return apiRequest(`/api/jobs/${jobId}/interview-setup/bulk`, {
      method: 'POST',
      body: JSON.stringify(setupData),
    });
  }

  // Get interview setup matrix for a job (all role_type/level combinations)
  static async getInterviewSetupMatrix(
    jobId: string
  ): Promise<InterviewSetupMatrixResponse> {
    return apiRequest(`/api/jobs/${jobId}/interview-setup/matrix`);
  }

  // Create interview setup with multiple configurations (alternative to bulk method)
  static async createInterviewSetupWithConfigurations(
    jobId: string,
    configurations: InterviewSetupInput[],
    replaceAll: boolean = true
  ): Promise<{ status: string; data: InterviewSetupResponse[]; message: string }> {
    return apiRequest(`/api/jobs/${jobId}/interview-setup`, {
      method: 'POST',
      body: JSON.stringify({
        configurations,
        replace_all: replaceAll
      }),
    });
  }
}

export default ResumeScreeningApi; 