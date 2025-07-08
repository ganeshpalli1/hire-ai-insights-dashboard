# System Audio Recording Guide

## Overview
The screen recording feature can capture both system audio (desktop sounds) and microphone audio. However, capturing system audio requires specific user actions and browser support.

## How to Enable System Audio Recording

### When Starting an Interview:

1. **Click "Start Interview"**
   - The browser will show a screen sharing dialog

2. **In the Screen Sharing Dialog:**
   - Select what to share (entire screen, window, or tab)
   - **IMPORTANT**: Look for the **"Share audio"** checkbox
   - ✅ **Check the "Share audio" checkbox**
   - Click "Share"

### Visual Guide:

#### Chrome/Edge:
```
┌─────────────────────────────────────┐
│ Choose what to share                │
│                                     │
│ [Entire Screen] [Window] [Tab]      │
│                                     │
│ ☑ Share audio  ← CHECK THIS!       │
│                                     │
│ [Cancel]              [Share]       │
└─────────────────────────────────────┘
```

#### Firefox:
- Firefox may show "Share audio" as a dropdown
- Select "Share audio" option if available

## What Gets Recorded

### With "Share audio" CHECKED ✅:
- 🎤 Your microphone (your voice)
- 🔊 System audio (AI interviewer's voice, any system sounds)
- 🖥️ Screen video

### Without "Share audio" ❌:
- 🎤 Your microphone only
- ❌ No system audio
- 🖥️ Screen video

## Browser Compatibility

| Browser | System Audio Support | Notes |
|---------|---------------------|-------|
| Chrome | ✅ Full support | Must check "Share audio" |
| Edge | ✅ Full support | Must check "Share audio" |
| Firefox | ⚠️ Limited | Tab audio only, not full system |
| Safari | ❌ No support | Microphone only |

## Troubleshooting

### "Share audio" option not visible?
1. Make sure you're using Chrome or Edge
2. Update your browser to the latest version
3. On Windows, system audio capture requires Windows 10/11

### System audio still not recording?
1. Check the browser console for:
   - `🔊 System audio capture: YES ✅` (audio is being captured)
   - `🔊 System audio capture: NO ❌` (audio NOT captured)

2. Try sharing a specific tab instead of entire screen:
   - Tab sharing often has better audio support
   - The "Share audio" option is more likely to appear

### Best Practices:
1. **Always use Chrome or Edge** for interviews
2. **Always check "Share audio"** when prompted
3. **Test before important interviews** to ensure audio is working
4. **Check console logs** to verify audio capture status

## Alternative Solutions

If system audio capture isn't working:
1. Use headphones to prevent echo
2. Ensure the AI interviewer's voice is audible through your microphone
3. Position your microphone to pick up speaker output (not recommended)

## Verification

After starting recording, check the browser console (F12) for:
```
🔊 System audio capture: YES ✅
📊 Audio sources: System (Active), Microphone (Active)
```

This confirms both audio sources are being recorded. 