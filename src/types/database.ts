export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      interview_sessions: {
        Row: {
          id: string
          resume_result_id: string | null
          job_post_id: string | null
          candidate_name: string
          generated_questions: Json
          interview_prompt: string
          session_url: string
          status: string
          created_at: string | null
          updated_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          resume_result_id?: string | null
          job_post_id?: string | null
          candidate_name: string
          generated_questions: Json
          interview_prompt: string
          session_url: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          resume_result_id?: string | null
          job_post_id?: string | null
          candidate_name?: string
          generated_questions?: Json
          interview_prompt?: string
          session_url?: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_resume_result_id_fkey"
            columns: ["resume_result_id"]
            isOneToOne: false
            referencedRelation: "resume_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_job_post_id_fkey"
            columns: ["job_post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_setup: {
        Row: {
          behavioral_attitude_percentage: number
          communication_percentage: number
          created_at: string | null
          domain_percentage: number
          experience_range: string
          fixed_questions_mode: boolean | null
          id: string
          interview_duration: number | null
          is_active: boolean | null
          level: string
          question_template: string | null
          role_type: string
          screening_percentage: number
          updated_at: string | null
        }
        Insert: {
          behavioral_attitude_percentage: number
          communication_percentage: number
          created_at?: string | null
          domain_percentage: number
          experience_range: string
          fixed_questions_mode?: boolean | null
          id?: string
          interview_duration?: number | null
          is_active?: boolean | null
          level: string
          question_template?: string | null
          role_type: string
          screening_percentage: number
          updated_at?: string | null
        }
        Update: {
          behavioral_attitude_percentage?: number
          communication_percentage?: number
          created_at?: string | null
          domain_percentage?: number
          experience_range?: string
          fixed_questions_mode?: boolean | null
          id?: string
          interview_duration?: number | null
          is_active?: boolean | null
          level?: string
          question_template?: string | null
          role_type?: string
          screening_percentage?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      job_posts: {
        Row: {
          created_at: string | null
          id: string
          job_description: string
          job_description_analysis: Json | null
          job_role: string
          required_experience: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_description: string
          job_description_analysis?: Json | null
          job_role: string
          required_experience: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_description?: string
          job_description_analysis?: Json | null
          job_role?: string
          required_experience?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      resume_results: {
        Row: {
          candidate_level: string
          candidate_name: string
          candidate_type: string
          created_at: string | null
          detailed_feedback: string | null
          fit_score: number | null
          id: string
          job_post_id: string | null
          matching_skills: string[] | null
          missing_skills: string[] | null
          recommendation: string | null
          resume_analysis_data: Json
          resume_file_name: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_level: string
          candidate_name: string
          candidate_type: string
          created_at?: string | null
          detailed_feedback?: string | null
          fit_score?: number | null
          id?: string
          job_post_id?: string | null
          matching_skills?: string[] | null
          missing_skills?: string[] | null
          recommendation?: string | null
          resume_analysis_data: Json
          resume_file_name?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_level?: string
          candidate_name?: string
          candidate_type?: string
          created_at?: string | null
          detailed_feedback?: string | null
          fit_score?: number | null
          id?: string
          job_post_id?: string | null
          matching_skills?: string[] | null
          missing_skills?: string[] | null
          recommendation?: string | null
          resume_analysis_data?: Json
          resume_file_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resume_results_job_post_id_fkey"
            columns: ["job_post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      },
      interview_results: {
        Row: {
          id: string
          interview_session_id: string | null
          job_post_id: string | null
          resume_result_id: string | null
          conversation_id: string | null
          transcript: string | null
          started_at: string | null
          ended_at: string | null
          duration_seconds: number | null
          domain_score: number | null
          behavioral_score: number | null
          communication_score: number | null
          overall_score: number | null
          confidence_level: string | null
          cheating_detected: boolean | null
          body_language: string | null
          speech_pattern: string | null
          areas_of_improvement: string[] | null
          system_recommendation: string | null
          raw_analysis: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          interview_session_id?: string | null
          job_post_id?: string | null
          resume_result_id?: string | null
          conversation_id?: string | null
          transcript?: string | null
          started_at?: string | null
          ended_at?: string | null
          duration_seconds?: number | null
          domain_score?: number | null
          behavioral_score?: number | null
          communication_score?: number | null
          overall_score?: number | null
          confidence_level?: string | null
          cheating_detected?: boolean | null
          body_language?: string | null
          speech_pattern?: string | null
          areas_of_improvement?: string[] | null
          system_recommendation?: string | null
          raw_analysis?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          interview_session_id?: string | null
          job_post_id?: string | null
          resume_result_id?: string | null
          conversation_id?: string | null
          transcript?: string | null
          started_at?: string | null
          ended_at?: string | null
          duration_seconds?: number | null
          domain_score?: number | null
          behavioral_score?: number | null
          communication_score?: number | null
          overall_score?: number | null
          confidence_level?: string | null
          cheating_detected?: boolean | null
          body_language?: string | null
          speech_pattern?: string | null
          areas_of_improvement?: string[] | null
          system_recommendation?: string | null
          raw_analysis?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_results_interview_session_id_fkey",
            columns: ["interview_session_id"],
            isOneToOne: false,
            referencedRelation: "interview_sessions",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_results_job_post_id_fkey",
            columns: ["job_post_id"],
            isOneToOne: false,
            referencedRelation: "job_posts",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_results_resume_result_id_fkey",
            columns: ["resume_result_id"],
            isOneToOne: false,
            referencedRelation: "resume_results",
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// Additional type definitions for our application
export type JobPost = Tables<'job_posts'>
export type JobPostInsert = TablesInsert<'job_posts'>
export type JobPostUpdate = TablesUpdate<'job_posts'>

export type ResumeResult = Tables<'resume_results'>
export type ResumeResultInsert = TablesInsert<'resume_results'>
export type ResumeResultUpdate = TablesUpdate<'resume_results'>

export type InterviewSetup = Tables<'interview_setup'>
export type InterviewSetupInsert = TablesInsert<'interview_setup'>
export type InterviewSetupUpdate = TablesUpdate<'interview_setup'>

export type InterviewSession = Tables<'interview_sessions'>
export type InterviewSessionInsert = TablesInsert<'interview_sessions'>
export type InterviewSessionUpdate = TablesUpdate<'interview_sessions'>

export type InterviewResult = Tables<'interview_results'>
export type InterviewResultInsert = TablesInsert<'interview_results'>
export type InterviewResultUpdate = TablesUpdate<'interview_results'>

// Enums for candidate types and levels
export type CandidateType = 'tech' | 'non-tech' | 'semi-tech'
export type CandidateLevel = 'entry' | 'mid' | 'senior'
export type RecommendationType = 'STRONG_FIT' | 'GOOD_FIT' | 'MODERATE_FIT' | 'WEAK_FIT' | 'MANUAL_REVIEW' 