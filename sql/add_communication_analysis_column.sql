-- Add communication_analysis column to interview_results table
ALTER TABLE interview_results
ADD COLUMN IF NOT EXISTS communication_analysis JSONB;
 
-- Add a comment to describe the column
COMMENT ON COLUMN interview_results.communication_analysis IS 'Stores detailed communication analysis including clarity, articulation, and professionalism scores'; 