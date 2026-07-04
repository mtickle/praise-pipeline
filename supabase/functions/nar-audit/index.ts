const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // 1. BULLETPROOF PREFLIGHT: Return 204 No Content
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 2. EXTRACT PAYLOAD & KEYS
    const { songTitle, artistName } = await req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY secret in Supabase." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!songTitle || !artistName) {
      return new Response(
        JSON.stringify({ error: "Song Title and Artist Name are required parameters." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. DEFINE THE URL & SYSTEM INSTRUCTION
    const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    
    const systemInstruction = `You are a theological research assistant for Berean Sync. 
Perform a high-precision theological audit on the provided song and artist.

Your objective is to identify if this song or its corporate origin links back to the New Apostolic Reformation (NAR), Word of Faith, or related structural movements.

Evaluate based on:
1. Known theological issues, phrasing, or scriptural distortion present within this track's official recording.
2. The direct publishing alignment, church origin (e.g., Bethel, Hillsong, Elevation, Jesus Culture), and known collaborative networking circles of the artist.

CRITICAL: RETURN ONLY A PURE JSON OBJECT.
Structure:
{
  "verdict": "Green" | "Amber" | "Red",
  "confidence_score": 85,
  "association_notes": { "details": ["Detail 1", "Detail 2"] },
  "doctrinal_notes": { "details": ["Detail 1", "Detail 2"] },
  "summary": "A concise theological summary detailing why this score was designated.",
  "sources": ["Source 1", "Source 2"]
}`;

    // 4. EXECUTE THE FETCH
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: `Analyze this song: "${songTitle}" by ${artistName}` }] }],
        generationConfig: {
          temperature: 0.2, // Low temp for analytical consistency
          responseMimeType: "application/json" 
        }
      })
    });

    const data = await response.json();
    
    // 5. GRACEFUL ERROR CHECKING
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content?.parts?.[0]?.text) {
       return new Response(
         JSON.stringify({ 
           error: "Google API did not return text. Check your billing dashboard or safety configurations.", 
           raw_response: data 
         }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    const geminiText = data.candidates[0].content.parts[0].text;
    
    // 6. PARSE AND RETURN
    let parsedData;
    try {
      parsedData = JSON.parse(geminiText);
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: "Failed to parse Gemini response as JSON.", raw_text: geminiText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(parsedData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // We return status 200 here purely to stop Supabase from swallowing our custom messages behind a generic 500 error page
    return new Response(JSON.stringify({ error: error.message, location: "Deno Try/Catch Boundary" }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});