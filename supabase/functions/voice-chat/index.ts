import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const tools = [
  {
    type: "function",
    function: {
      name: "report_medication_status",
      description: "Report whether a patient has taken a specific medication and any side effects. Call this whenever the patient confirms or denies taking a medication.",
      parameters: {
        type: "object",
        properties: {
          medication_name: { type: "string", description: "Name of the medication" },
          taken: { type: "boolean", description: "Whether the patient took it" },
          side_effects: { type: "string", description: "Any reported side effects, empty string if none" }
        },
        required: ["medication_name", "taken"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "report_mood",
      description: "Report the detected mood of the patient based on the conversation.",
      parameters: {
        type: "object",
        properties: {
          mood: { type: "string", enum: ["happy", "neutral", "confused", "distressed"] },
          details: { type: "string", description: "Brief context about mood detection" }
        },
        required: ["mood"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_summary",
      description: "Generate a brief check-in summary when the conversation is wrapping up. Call this after covering medications and mood.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Brief summary of the check-in" },
          overall_status: { type: "string", enum: ["good", "concerning", "needs_attention"] }
        },
        required: ["summary"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "end_conversation",
      description: "End the check-in call when all topics have been covered and the patient has said goodbye or the conversation is naturally concluding.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why the conversation is ending" }
        },
        required: ["reason"]
      }
    }
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, textInput, history, patientContext } = await req.json();

    if (!audioBase64 && !textInput) {
      return new Response(JSON.stringify({ error: 'audioBase64 or textInput is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SMALLEST_AI_API_KEY = Deno.env.get('SMALLEST_AI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!SMALLEST_AI_API_KEY || !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'API keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === STEP 1: STT — Pulse transcription (skip if textInput provided) ===
    let userText = '';

    if (textInput) {
      userText = textInput;
      console.log('[voice-chat] Using text input directly:', userText);
    } else {
      console.log('[voice-chat] Step 1: Transcribing audio with Pulse STT...');
      const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      console.log('[voice-chat] Audio bytes length:', audioBytes.length);

      const sttRes = await fetch('https://waves-api.smallest.ai/api/v1/pulse/get_text?model=pulse&language=en', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SMALLEST_AI_API_KEY}`,
          'Content-Type': 'audio/webm;codecs=opus',
        },
        body: audioBytes.buffer,
      });

      if (!sttRes.ok) {
        const errText = await sttRes.text();
        console.error('[voice-chat] STT error:', sttRes.status, errText);
        return new Response(JSON.stringify({ error: 'Speech-to-text failed', details: errText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const sttData = await sttRes.json();
      userText = sttData.transcript || sttData.text || sttData.transcription || '';
      console.log('[voice-chat] Transcribed text:', userText);

      if (!userText.trim()) {
        return new Response(JSON.stringify({ userText: '', agentText: '', audioBase64: null, empty: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // === STEP 2: LLM — Generate Clara's response with tool calling ===
    console.log('[voice-chat] Step 2: Generating LLM response with tools...');

    const medicationList = patientContext?.medications?.map((m: any) => `${m.name} (${m.dosage})`).join(', ') || 'none registered';

    const systemPrompt = `You are Clara, a warm, patient, and caring health companion for elderly patients. You speak in a calm, clear, and reassuring tone. Keep your responses concise (2-3 sentences max) since they will be spoken aloud.

Patient context:
- Name: ${patientContext?.patientName || 'Patient'}
- Age: ${patientContext?.patientAge || 'unknown'}
- Medications: ${medicationList}

Your goals during check-ins:
1. Ask about how they're feeling today
2. Check if they've taken their medications
3. Ask about any side effects or concerns
4. Be empathetic and supportive
5. Keep the conversation natural and friendly

IMPORTANT TOOL USAGE INSTRUCTIONS:
- When the patient confirms or denies taking a medication, call report_medication_status with the medication name and whether they took it.
- When you detect the patient's emotional state from the conversation, call report_mood.
- When the conversation is wrapping up and you've covered medications and mood, call generate_summary with a brief overview.
- After the final goodbye and once you've generated a summary, call end_conversation to terminate the call.
- You can call multiple tools in a single response if appropriate.

Always address the patient by name. Never use markdown or formatting — speak naturally as in a phone call.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: userText },
    ];

    const llmRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        tools,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error('[voice-chat] LLM error:', llmRes.status, errText);
      
      if (llmRes.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (llmRes.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Failed to generate response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const llmData = await llmRes.json();
    const firstChoice = llmData.choices?.[0]?.message;
    
    let agentText = firstChoice?.content || '';
    const extractedData: { tool: string; args: any }[] = [];

    // Process tool calls if present
    if (firstChoice?.tool_calls && firstChoice.tool_calls.length > 0) {
      console.log('[voice-chat] Processing tool calls:', firstChoice.tool_calls.length);

      // Extract data from each tool call
      for (const toolCall of firstChoice.tool_calls) {
        const fnName = toolCall.function?.name;
        let fnArgs: any = {};
        try {
          fnArgs = JSON.parse(toolCall.function?.arguments || '{}');
        } catch {
          console.error('[voice-chat] Failed to parse tool args:', toolCall.function?.arguments);
          continue;
        }
        
        console.log(`[voice-chat] Tool call: ${fnName}`, fnArgs);
        extractedData.push({ tool: fnName, args: fnArgs });
      }

      // If there's no text content, do a second LLM call with tool results
      if (!agentText) {
        const toolResultMessages = [
          ...messages,
          firstChoice, // assistant message with tool_calls
          ...firstChoice.tool_calls.map((tc: any) => ({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ success: true }),
          })),
        ];

        const llmRes2 = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: toolResultMessages,
          }),
        });

        if (llmRes2.ok) {
          const llmData2 = await llmRes2.json();
          agentText = llmData2.choices?.[0]?.message?.content || '';
        }
      }
    }

    if (!agentText) {
      agentText = "I'm sorry, I didn't catch that. Could you say it again?";
    }

    console.log('[voice-chat] Agent response:', agentText);
    if (extractedData.length > 0) {
      console.log('[voice-chat] Extracted data:', JSON.stringify(extractedData));
    }

    // === STEP 3: TTS — Lightning v3.1 speech synthesis ===
    console.log('[voice-chat] Step 3: Synthesizing speech with Lightning v3.1...');

    const ttsRes = await fetch('https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SMALLEST_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: agentText,
        voice_id: 'sophia',
        sample_rate: 24000,
        speed: 1,
        output_format: 'mp3',
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error('[voice-chat] TTS error:', ttsRes.status, errText);
      return new Response(JSON.stringify({ userText, agentText, audioBase64: null, extractedData: extractedData.length > 0 ? extractedData : undefined }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ttsArrayBuffer = await ttsRes.arrayBuffer();
    const ttsBytes = new Uint8Array(ttsArrayBuffer);
    
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < ttsBytes.length; i += chunkSize) {
      const chunk = ttsBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const responseAudioBase64 = btoa(binary);
    
    console.log('[voice-chat] TTS audio size:', ttsBytes.length, 'bytes');

    return new Response(JSON.stringify({
      userText,
      agentText,
      audioBase64: responseAudioBase64,
      extractedData: extractedData.length > 0 ? extractedData : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[voice-chat] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
