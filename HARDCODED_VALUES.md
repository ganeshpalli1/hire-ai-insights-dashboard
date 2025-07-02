# Hardcoded Configuration Values

## Summary
All environment variables have been hardcoded directly into the source code for simpler deployment.

## Hardcoded Values

### 🔑 ElevenLabs Agent ID
- **Value**: `agent_01jw4mdjgvef2rmm7e3kgnsrzp`
- **Location**: `src/pages/VideoInterview.tsx` (line ~481)
- **Purpose**: Connect to your specific ElevenLabs conversational AI agent

### 🌐 API Base URL
- **Value**: `https://backendb2b.azurewebsites.net`
- **Locations**:
  - `src/lib/api.ts` (line 2)
  - `src/lib/services/interviewService.ts` (line 4)
  - `src/pages/VideoInterview.tsx` (lines 358, 635)
  - `src/components/WebhookSetupGuide.tsx` (line 15)
- **Purpose**: Backend API endpoint for all data operations

### AI Avatar Video URL
- **Value**: `https://pdf1.blob.core.windows.net/pdf/0426.mp4`
- **File**: `src/pages/VideoInterview.tsx`
- **Storage**: Azure Blob Storage
- **Note**: Video is hosted externally to avoid Azure Static Web Apps limitations

## Files Modified

### ✅ Primary Changes
1. **`src/pages/VideoInterview.tsx`**
   - Hardcoded ElevenLabs agent ID
   - Removed environment variable check
   - Hardcoded API URLs for interview operations

2. **`src/lib/api.ts`**
   - Hardcoded API_BASE_URL constant

3. **`src/lib/services/interviewService.ts`**
   - Hardcoded API_BASE_URL constant

4. **`src/components/WebhookSetupGuide.tsx`**
   - Hardcoded backend URL for webhook setup

### 🗑️ Removed Files
- `check-env.js` - No longer needed since values are hardcoded

## Benefits of Hardcoding

✅ **No Environment Variables Required**: Deploy without .env files
✅ **Simplified Deployment**: Just build and deploy dist/ folder
✅ **No Configuration Errors**: Values are guaranteed to be present
✅ **Azure Static Web Apps Compatible**: Works seamlessly with static hosting

## Deployment Instructions

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy the `dist/` folder** to Azure Static Web Apps

3. **Test the complete flow**:
   - Generate interview link ✅
   - Click interview link ✅
   - Video interview page loads ✅
   - Start interview ✅
   - ElevenLabs agent connects ✅
   - AI interview begins ✅

## ElevenLabs Agent Requirements

Make sure your ElevenLabs agent (`agent_01jw4mdjgvef2rmm7e3kgnsrzp`) is:
- ✅ **Active** in your ElevenLabs dashboard
- ✅ **Public** (allows direct connection without signed URLs)
- ✅ **Properly configured** with appropriate conversation settings

## Expected Results

- ❌ No more "demo-agent-id" errors
- ❌ No more environment variable configuration errors  
- ❌ No more 404 routing errors
- ✅ Direct connection to your real ElevenLabs agent
- ✅ Fully functional AI video interviews

---

**Status**: Ready for production deployment! 🚀 

## Future Considerations

If you need to change any of these values:
1. Search for the old value across the codebase
2. Replace with the new value
3. Rebuild the application
4. Deploy the updated build

For production deployments, consider implementing environment variables or a configuration service. 