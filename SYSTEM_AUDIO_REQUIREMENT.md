# System Audio Requirement Documentation

## Overview
As of the latest update, **system audio is now REQUIRED** for all video interviews. The interview cannot proceed without enabling the "Share audio" option during screen sharing.

## Changes Implemented

### 1. **Mandatory Audio Check**
- The system now detects if the "Share audio" checkbox was selected during screen sharing
- If system audio is not detected, the interview is **blocked** from proceeding
- Users must retry and enable audio to continue

### 2. **User Experience Flow**

#### Permission Request Sequence:
1. **Camera Permission** - For video recording
2. **Microphone Permission** - For candidate's voice
3. **Screen Recording with Audio** - For AI interviewer's voice (REQUIRED)

#### If Audio Not Detected:
- A non-dismissable warning dialog appears
- Users cannot proceed to the interview
- Only option is to retry with audio enabled

### 3. **Warning Dialog Features**
- **Title**: "🚫 System Audio Required - Cannot Proceed"
- **Clear explanation** of why audio is required
- **Step-by-step instructions** on how to enable audio
- **Single action button**: "🔄 Retry Screen Sharing with Audio"

### 4. **Technical Implementation**

#### Detection Method:
```typescript
const screenStream = (screenRecorder as any).screenStream;
const hasSystemAudio = screenStream && screenStream.getAudioTracks().length > 0;
```

#### Files Modified:
- `src/pages/InterviewInstructions.tsx` - Main permission flow and audio validation
- `src/lib/services/screenRecordingService.ts` - Made screenStream public for audio track detection

## Rationale
System audio is essential for:
- Recording the AI interviewer's questions
- Creating complete interview recordings
- Proper evaluation of the interview session
- Maintaining interview integrity

## User Instructions
When the screen sharing dialog appears:
1. Select your screen or browser window
2. **CHECK ✓ the "Share audio" checkbox**
3. Click "Share" to continue

## Browser Compatibility
- Chrome/Edge: "Share audio" checkbox available
- Firefox: May have different audio sharing options
- Safari: Limited screen recording support

---
**Last Updated:** January 2025
**Status:** System audio is now mandatory for all interviews 