// API endpoint for generating ElevenLabs signed URLs
// This should be implemented as a backend route (e.g., Express.js, Next.js API route, etc.)

export async function getSignedUrl(agentId: string): Promise<string> {
  const requestHeaders: HeadersInit = new Headers();
  requestHeaders.set("xi-api-key", process.env.ELEVENLABS_API_KEY || "");

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    {
      method: "GET",
      headers: requestHeaders,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get signed URL: ${response.statusText}`);
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

    const signedUrl = await getSignedUrl(agentId as string);
    res.json({ signed_url: signedUrl });
  } catch (error) {
    console.error("Error getting signed URL:", error);
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

    const signedUrl = await getSignedUrl(agentId);
    return Response.json({ signed_url: signedUrl });
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return new Response('Failed to get signed URL', { status: 500 });
  }
}
*/ 