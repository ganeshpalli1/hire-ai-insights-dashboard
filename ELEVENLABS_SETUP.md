# ElevenLabs Integration Setup Guide

## Issues Fixed
✅ **Routing Issue**: Video interview links now work (solved with `staticwebapp.config.json`)
✅ **ElevenLabs Configuration**: Added proper error handling and configuration validation

## Current Errors Explained

### 1. Demo Agent ID Error
```
Using ElevenLabs Agent ID: demo-agent-id
/api/elevenlabs/signed-url?agentId=demo-agent-id: 404
Backend not available, trying direct agent ID: Error: Backend endpoint not available
Failed to start interview: CloseEvent
```

**Root Cause**: The app is using a placeholder `demo-agent-id` instead of a real ElevenLabs agent.

## 🚀 How to Fix

### Step 1: Get ElevenLabs Agent ID
1. **Sign up/Login** to [ElevenLabs](https://elevenlabs.io/)
2. **Go to Conversational AI**: https://elevenlabs.io/app/conversational-ai
3. **Create a new agent** or select an existing one
4. **Copy the Agent ID** (it looks like: `21m00Tcm4TlvDq8ikWAM`)

### Step 2: Configure Environment Variables

Create a `.env` file in your project root:

```env
# Backend API Configuration
VITE_API_BASE_URL=https://backendb2b.azurewebsites.net

# ElevenLabs Configuration
VITE_ELEVENLABS_AGENT_ID=your_real_agent_id_here

# Optional: ElevenLabs API Key (for backend signed URLs)
VITE_ELEVENLABS_API_KEY=your_api_key_here
```

### Step 3: Make Agent Public (Recommended for Direct Access)
1. In your ElevenLabs agent settings
2. Enable **"Public Agent"** option
3. This allows direct connection without signed URLs

### Step 4: Rebuild and Deploy
```bash
npm run build
# Deploy the dist/ folder to Azure Static Web Apps
```

## 📋 Two Connection Methods

### Method 1: Direct Agent Connection (Recommended)
- **Pros**: Simple, no backend required
- **Cons**: Agent must be public
- **Setup**: Just set `VITE_ELEVENLABS_AGENT_ID`

### Method 2: Signed URL (Advanced)
- **Pros**: More secure, private agents
- **Cons**: Requires backend API endpoint
- **Setup**: Need backend endpoint + API key

## 🔧 Backend Signed URL Endpoint (Optional)

If you want to use private agents, create this API endpoint:

```javascript
// For Express.js backend
app.get("/api/elevenlabs/signed-url", async (req, res) => {
  try {
    const { agentId } = req.query;
    
    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const { signed_url } = await response.json();
    res.json({ signed_url });
  } catch (error) {
    console.error("Error getting signed URL:", error);
    res.status(500).json({ error: "Failed to get signed URL" });
  }
});
```

## 🧪 Testing the Fix

1. **Configure Agent ID**: Set `VITE_ELEVENLABS_AGENT_ID` in `.env`
2. **Build**: `npm run build`
3. **Deploy**: Upload `dist/` contents to Azure Static Web Apps
4. **Test**: Generate interview link and click it
5. **Verify**: Should load interview page and connect to ElevenLabs

## 🐛 Troubleshooting

### Error: "Please configure VITE_ELEVENLABS_AGENT_ID"
- **Solution**: Add real agent ID to environment variables

### Error: "Failed to connect to ElevenLabs agent"
- **Check**: Agent ID is correct
- **Check**: Agent is public (or use signed URL method)
- **Check**: Agent is active in ElevenLabs dashboard

### Error: "Backend endpoint not available"
- **Normal**: This is expected if you don't have the backend endpoint
- **Fallback**: App will try direct agent connection
- **Action**: Ensure agent is public for direct connection

## 🎯 Expected Flow After Fix

1. ✅ User clicks interview link
2. ✅ Video interview page loads (routing fixed)
3. ✅ User clicks "Start Interview"
4. ✅ App connects to ElevenLabs agent
5. ✅ AI interviewer starts conversation
6. ✅ Interview proceeds normally

## 🔗 Useful Links

- [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
- [ElevenLabs API Documentation](https://elevenlabs.io/docs)
- [ElevenLabs Agent Creation Guide](https://elevenlabs.io/docs/conversational-ai/overview) 