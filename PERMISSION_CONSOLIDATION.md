# Permission Consolidation Documentation

## Overview
This document describes the permission consolidation feature that prevents duplicate permission requests across the interview flow.

## Problem Solved
Previously, users had to grant permissions twice:
1. Once on the InterviewInstructions page
2. Again on the VideoInterview page

This created a poor user experience and confusion.

## Solution Implemented

### 1. **InterviewInstructions Page**
- Requests all permissions upfront (camera, microphone, screen recording with audio)
- Keeps streams active and passes them to the VideoInterview page
- Requires system audio to be enabled before proceeding
- Provides clear retry mechanism if audio is not detected

### 2. **VideoInterview Page**
- Detects if permissions were pre-granted via navigation state
- Reuses existing streams instead of requesting new ones
- Only verifies that recording is still active
- If recording was stopped, directs user back to instructions page

### 3. **Key Changes Made**

#### InterviewInstructions.tsx:
```javascript
// Stores camera stream for reuse
(window as any).cameraStream = cameraStream;

// Keeps screen recording active
// Does not stop recording when navigating to interview

// Passes permission state
navigate(interviewPath, { state: { permissionsGranted: true } });
```

#### VideoInterview.tsx:
```javascript
// Checks for pre-granted permissions
const { state } = useLocation();
const permissionsPreGranted = state?.permissionsGranted || false;

// Reuses camera stream
if (permissionsPreGranted && (window as any).cameraStream) {
  setCameraStream((window as any).cameraStream);
}

// Skips new permission requests
if (!permissionsPreGranted) {
  // Request permissions...
} else {
  // Just verify recording is active
  if (!currentState.isRecording) {
    // Error: recording was stopped
    navigate(-1); // Go back to instructions
  }
}
```

## User Flow

### Normal Flow (Permissions Granted with Audio):
1. User clicks "Start Interview" on Instructions page
2. Grants camera, microphone, and screen recording with audio
3. **Automatically proceeds to VideoInterview page**
4. Interview starts immediately with no additional permission requests

### Audio Missing Flow:
1. User clicks "Start Interview" on Instructions page
2. Grants permissions but forgets to check "Share audio"
3. Warning dialog appears - cannot proceed without audio
4. User clicks "Retry" and enables audio
5. **Automatically proceeds to VideoInterview page**

### Returning User Flow:
1. User already on VideoInterview page with permissions
2. Clicks "Start Interview" button
3. No new permission requests - interview starts immediately

## Technical Details

### Permission State Management:
- Camera stream stored in `window.cameraStream`
- Screen recording kept active using `screenRecorder` singleton
- Permission state passed via React Router navigation state

### Error Handling:
- If screen recording stops unexpectedly, user is redirected back
- Clear error messages guide users on what to do
- System audio is mandatory - no workarounds

### Browser Compatibility:
- Works in Chrome, Edge, and other Chromium browsers
- Firefox may have different audio sharing UI
- Safari has limited screen recording support

## Benefits
1. **Better UX**: Single permission flow instead of duplicate requests
2. **Faster Start**: Interview begins immediately after permissions
3. **Clear Requirements**: System audio requirement enforced upfront
4. **Error Prevention**: Can't start interview without proper setup

---
**Last Updated:** January 2025
**Status:** Implemented and tested 