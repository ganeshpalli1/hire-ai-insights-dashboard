// API endpoint for generating ElevenLabs signed URLs
// This should be implemented as a backend route (e.g., Express.js, Next.js API route, etc.)

export async function getSignedUrl(agentId: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required for signed URL generation');
  }

  const requestHeaders: HeadersInit = new Headers();
  requestHeaders.set("xi-api-key", apiKey);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    {
      method: "GET",
      headers: requestHeaders,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get signed URL: ${response.statusText} - ${errorText}`);
  }

  const body = await response.json();
  return body.signed_url;
}

// Example Express.js route implementation:
/*
app.get("/api/elevenlabs/signed-url", async (req, res) => {
  try {
    const { agentId } = req.query;
    
    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    // Validate agent ID format (should be a string of specific length)
    if (typeof agentId !== 'string' || agentId.length < 10) {
      return res.status(400).json({ error: "Invalid agent ID format" });
    }

    const signedUrl = await getSignedUrl(agentId as string);
    res.json({ signed_url: signedUrl });
  } catch (error) {
    console.error("Error getting signed URL:", error);
    
    // Return specific error messages
    if (error.message.includes('ELEVENLABS_API_KEY')) {
      return res.status(500).json({ error: "Server configuration error: Missing ElevenLabs API key" });
    }
    
    if (error.message.includes('401')) {
      return res.status(401).json({ error: "Invalid ElevenLabs API key" });
    }
    
    if (error.message.includes('404')) {
      return res.status(404).json({ error: "Agent not found. Please check the agent ID." });
    }
    
    res.status(500).json({ error: "Failed to get signed URL" });
  }
});
*/

// Example Next.js API route implementation:
/*
// pages/api/elevenlabs/signed-url.ts or app/api/elevenlabs/signed-url/route.ts

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    if (!agentId) {
      return new Response('Agent ID is required', { status: 400 });
    }

    // Validate agent ID format
    if (typeof agentId !== 'string' || agentId.length < 10) {
      return new Response('Invalid agent ID format', { status: 400 });
    }

    const signedUrl = await getSignedUrl(agentId);
    return Response.json({ signed_url: signedUrl });
  } catch (error) {
    console.error('Error getting signed URL:', error);
    
    // Return specific error messages
    if (error.message.includes('ELEVENLABS_API_KEY')) {
      return new Response('Server configuration error: Missing ElevenLabs API key', { status: 500 });
    }
    
    if (error.message.includes('401')) {
      return new Response('Invalid ElevenLabs API key', { status: 401 });
    }
    
    if (error.message.includes('404')) {
      return new Response('Agent not found. Please check the agent ID.', { status: 404 });
    }
    
    return new Response('Failed to get signed URL', { status: 500 });
  }
}
*/

// Example usage with the @11labs/react hook:
/*
import { useConversation } from '@11labs/react';

const conversation = useConversation({
  onConnect: () => console.log('Connected to ElevenLabs'),
  onDisconnect: () => console.log('Disconnected from ElevenLabs'),
  onMessage: (message) => console.log('Message:', message),
  onError: (error) => console.error('Conversation error:', error)
});

// Method 1: Using signed URL (for private agents)
try {
  const response = await fetch('/api/elevenlabs/signed-url?agentId=your-agent-id');
  const { signed_url } = await response.json();
  await conversation.startSession({ signedUrl: signed_url });
} catch (error) {
  console.error('Failed to get signed URL:', error);
}

// Method 2: Direct agent connection (for public agents)
try {
  await conversation.startSession({ agentId: 'your-agent-id' });
} catch (error) {
  console.error('Failed to connect directly:', error);
}
*/ 