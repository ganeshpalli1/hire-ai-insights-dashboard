-- Create interview_sessions table for storing personalized interview sessions
CREATE TABLE IF NOT EXISTS interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_result_id UUID REFERENCES resume_results(id) ON DELETE CASCADE,
    job_post_id UUID REFERENCES job_posts(id) ON DELETE CASCADE,
    candidate_name TEXT NOT NULL,
    generated_questions JSONB NOT NULL,
    interview_prompt TEXT NOT NULL,
    session_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_interview_sessions_resume_result_id ON interview_sessions(resume_result_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_job_post_id ON interview_sessions(job_post_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_expires_at ON interview_sessions(expires_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view interview sessions
CREATE POLICY "Users can view interview sessions" ON interview_sessions
    FOR SELECT USING (true);

-- Policy to allow users to insert interview sessions
CREATE POLICY "Users can insert interview sessions" ON interview_sessions
    FOR INSERT WITH CHECK (true);

-- Policy to allow users to update interview sessions
CREATE POLICY "Users can update interview sessions" ON interview_sessions
    FOR UPDATE USING (true);

-- Trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_interview_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER interview_sessions_updated_at
    BEFORE UPDATE ON interview_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_interview_sessions_updated_at();

-- Comment on table and columns
COMMENT ON TABLE interview_sessions IS 'Stores personalized interview sessions with generated questions and prompts';
COMMENT ON COLUMN interview_sessions.generated_questions IS 'JSON containing the 7 personalized questions generated for this candidate';
COMMENT ON COLUMN interview_sessions.interview_prompt IS 'The complete AI interviewer prompt with personalized questions';
COMMENT ON COLUMN interview_sessions.session_url IS 'The unique URL path for this interview session';
COMMENT ON COLUMN interview_sessions.status IS 'Current status of the interview session';
COMMENT ON COLUMN interview_sessions.expires_at IS 'When this interview session expires (typically 24 hours after creation)'; 