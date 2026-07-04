// --- THIS IS THE LITURGICAL AUDIT FUNCTION ---

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
    const systemInstruction = `You are an expert Liturgical Analyst. I will provide a song title and artist. 
Your goal is to categorize it into one of four liturgical movements and explain its theological fit.

CATEGORIES (The Four-Fold Model):
1. PRAISE (Gathering): Focus on awe, glory, and thanks. Posture is gathering the congregation.
2. FAITH (Word): Focus on the story of God, His attributes, and His Word. Posture is learning/grounding.
3. LOVE (Table): Focus on the Gospel, the Cross, and sacrifice. Posture is reflection/communion.
4. HOPE (Sending): Focus on the future, confession, repentance, and commissioning. Posture is being sent out.

OUTPUT FORMAT (JSON ONLY):
{
  "song_title": "String",
  "artist": "String",
  "liturgical_movement": "Praise | Faith | Love | Hope",
  "theological_reasoning": "A 2-3 sentence explanation of why this song fits this specific movement.",
  "scripture_connection": "A brief reference to a relevant verse if applicable."
}`;

    const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    
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
          temperature: 0.2,
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
    return new Response(JSON.stringify({ error: error.message, location: "Deno Try/Catch Boundary" }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});