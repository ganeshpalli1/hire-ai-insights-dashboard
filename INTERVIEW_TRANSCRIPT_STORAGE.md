# Interview Transcript Storage System

## Overview

This document describes the updated interview transcript storage system that captures and stores interview conversations directly from the frontend, eliminating the dependency on ElevenLabs API for transcript retrieval.

## Database Schema Updates

### interview_results Table Enhancements

The following columns have been added to better support transcript storage:

1. **transcript_entries** (JSONB)
   - Stores an array of transcript entries with speaker, text, and timestamp
   - Format: `[{id, speaker, text, timestamp, isFinal}]`

2. **transcript_source** (TEXT)
   - Indicates the source of transcript data
   - Values: `'elevenlabs_api'`, `'frontend_capture'`, `'webhook'`

3. **security_violations** (JSONB)
   - Stores security-related events during the interview
   - Includes: `cheating_flags`, `fullscreen_exit_count`, `security_score`

4. **candidate_name** (TEXT)
   - Quick reference to candidate name without joining tables

## API Endpoints

### 1. Complete Interview with Transcript
```
POST /api/interviews/{session_id}/complete-with-transcript
```

**Request Body:**
```json
{
  "transcript": "Full text transcript",
  "transcript_entries": [
    {
      "id": "unique-id",
      "speaker": "user" | "agent",
      "text": "Message text",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ],
  "started_at": "2024-01-01T12:00:00Z",
  "ended_at": "2024-01-01T12:30:00Z",
  "duration_seconds": 1800,
  "cheating_flags": ["flag1", "flag2"],
  "fullscreen_exit_count": 0
}
```

### 2. Get Stored Transcript
```
GET /api/interviews/{session_id}/transcript
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "transcript": "Full text transcript",
    "transcript_entries": [...],
    "transcript_source": "frontend_capture",
    "duration_seconds": 1800,
    "started_at": "2024-01-01T12:00:00Z",
    "ended_at": "2024-01-01T12:30:00Z",
    "security_violations": {...},
    "candidate_name": "John Doe"
  }
}
```

### 3. Re-analyze Stored Transcript
```
POST /api/interviews/analyze-stored-transcript
```

**Request Body:**
```json
{
  "session_id": "uuid",
  "reason": "Manual re-analysis"
}
```

## Frontend Implementation

### Using the Interview Transcript Hook

```typescript
import { useInterviewTranscript } from '@/hooks/useInterviewTranscript';

// In your component
const { 
  storeTranscript, 
  retrieveTranscript, 
  reanalyzeTranscript 
} = useInterviewTranscript(transcript, transcriptEntries);

// Store transcript after interview
await storeTranscript(sessionId, {
  startedAt: new Date(startTime),
  endedAt: new Date(),
  durationSeconds: Math.floor((Date.now() - startTime) / 1000),
  cheatingFlags: [],
  fullscreenExitCount: 0
});
```

## Data Flow

1. **During Interview**
   - Frontend captures all messages exchanged between user and AI
   - Messages are stored in the `transcript` state with duplicate prevention
   - Security events (fullscreen exits) are tracked

2. **After Interview**
   - Frontend sends complete transcript to backend
   - Backend analyzes transcript using Azure OpenAI
   - Results are stored in `interview_results` table
   - Session status is updated to 'completed'

3. **Analysis Results**
   - Domain knowledge score
   - Behavioral/attitude score
   - Communication score
   - Overall recommendation
   - Areas of improvement
   - Security violations (if any)

## Security Considerations

- **Fullscreen Exit Tracking**: Deducts 10 points per exit from security score
- **Cheating Detection**: Multiple fullscreen exits (>2) trigger cheating flag
- **Transcript Integrity**: All messages are timestamped and ordered

## Benefits

1. **Reliability**: No dependency on external API for transcript retrieval
2. **Performance**: Immediate transcript availability
3. **Flexibility**: Can re-analyze transcripts with different parameters
4. **Security**: Better tracking of candidate behavior during interview
5. **Data Ownership**: Complete control over interview data 