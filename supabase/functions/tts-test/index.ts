import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SMALLEST_AI_API_KEY = Deno.env.get('SMALLEST_AI_API_KEY');
    if (!SMALLEST_AI_API_KEY) {
      return new Response(JSON.stringify({ error: 'SMALLEST_AI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[tts-test] Calling Lightning v3.1 TTS for text:', text);

    const ttsRes = await fetch('https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SMALLEST_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_id: 'sophia',
        sample_rate: 24000,
        speed: 1,
        add_wav_header: true,
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error('[tts-test] TTS error:', ttsRes.status, errText);
      return new Response(JSON.stringify({ error: 'TTS failed', details: errText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ttsArrayBuffer = await ttsRes.arrayBuffer();
    const ttsBytes = new Uint8Array(ttsArrayBuffer);

    // Extract header bytes (first 44 bytes) as hex for debug
    const headerBytes = Array.from(ttsBytes.slice(0, 44))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Convert to base64
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < ttsBytes.length; i += chunkSize) {
      const chunk = ttsBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const audioBase64 = btoa(binary);

    console.log('[tts-test] TTS audio size:', ttsBytes.length, 'bytes');

    return new Response(JSON.stringify({
      audioBase64,
      audioSizeBytes: ttsBytes.length,
      headerBytes,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[tts-test] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
