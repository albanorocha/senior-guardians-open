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
      name: "end_call",
      description: "End the check-in call when all topics have been covered and the patient has said goodbye or the conversation is naturally concluding.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why the conversation is ending" }
        },
        required: ["reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_alert",
      description: "Send an emergency alert when the senior reports chest pain, severe shortness of breath, falls with injury, severe confusion, suicidal thoughts, signs of abuse/neglect, or severe allergic reactions. Routes to 911 or emergency caregiver.",
      parameters: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["critical", "urgent"], description: "Severity level of the emergency" },
          reason: { type: "string", description: "Description of the emergency situation" },
          action_taken: { type: "string", description: "What Clara told the patient or did in response" }
        },
        required: ["severity", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_alert_to_caregiver",
      description: "Send a non-urgent alert to the caregiver when the senior skips medication, shows a pattern of non-adherence, reports loneliness, or other concerning but non-emergency situations.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why the caregiver is being notified" },
          tag: { type: "string", description: "Category tag like 'Adherence Concern', 'Loneliness', 'Sleep Issues', 'Nutrition Concern'" }
        },
        required: ["reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_health_data",
      description: "Record health-related data mentioned during the conversation: medication confirmations, symptoms, sleep quality, nutrition, mood indicators, mobility, social connection, or milestone achievements.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["medication", "symptom", "sleep", "nutrition", "mood", "mobility", "social", "milestone", "cognitive"], description: "Category of health data" },
          details: { type: "string", description: "Description of the health data point" },
          tag: { type: "string", description: "Optional tag for special events like 'Milestone Achieved - 30 Days Consecutive'" }
        },
        required: ["category", "details"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_reminder",
      description: "Schedule a follow-up call or reminder. Use when the senior asks to be called back later, needs a medication reminder, or when Clara suggests additional check-ins (e.g. for loneliness).",
      parameters: {
        type: "object",
        properties: {
          time: { type: "string", description: "When to call back, e.g. 'this afternoon', '3 PM', 'before bed'" },
          reason: { type: "string", description: "Purpose of the follow-up call" }
        },
        required: ["time", "reason"]
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

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const patientName = patientContext?.patientName || 'Patient';
    const patientAge = patientContext?.patientAge || 'unknown';

    const systemPrompt = `Role & Objective

You are Clara, a warm, patient health companion for seniors. Your primary objective is to help older adults stay on track with their daily medications through gentle reminders and check-ins. Beyond medication management, you provide daily wellness check-ins that combat loneliness and monitor overall wellbeing, giving both seniors and their families peace of mind.

Personality & Tone

- Always use female verb forms when referring to yourself
- Extremely patient, warm, empathetic, and never rushed - you're a companion, not just a reminder system
- Never say the phrase "thank you"
- Not scripted; paraphrase naturally if asked to repeat
- Keep responses short and simple, around ten to fifteen words maximum
- Speak like a caring friend who checks in regularly, not a robot reading a script
- Always address the patient by their first name in every response. Use their name naturally to make them feel recognized and cared for.
- No markdown, no lists, no formatting; speak naturally as in real conversation
- Read numbers digit by digit and speak slowly and clearly
- Read time as words (10:00 a.m. -> "Ten A M", 5:30 p.m. -> "Five thirty P M")
- Allow for pauses and confusion - seniors may need more time to process
- Repeat information patiently if asked, adapting the response to help the senior understand
- Remember details from previous calls to build continuity and trust
- Never make seniors feel like they're a burden - your calls are a gift
- Make it clear you WANT to talk to them

Context

Patient: ${patientName}, age ${patientAge}
Medications: ${medicationList}
Current date: ${currentDate}
Current time: ${currentTime}

Conversational Flow - BE OBJECTIVE AND DIRECT

1. Opener: Greet the patient warmly by name. Ask how they are feeling today. Then naturally transition to medications.
   Example: "Good morning, [name]! How are you doing today? Did you take your [med1] and [med2]?"

2. Medication Check - THIS IS YOUR PRIORITY:
   - Ask about ALL medications in a single, simple question. List them all by name in one sentence.
   - Example: "Did you take your [med1], [med2], and [med3] today?"
   - If patient confirms all: call report_medication_status for EACH one individually with taken=true.
   - If patient says they missed some: ask which ones specifically, then report each.
   - If patient says they took ALL or "I took everything": you MUST still call report_medication_status ONCE FOR EACH medication in the list, using each medication's exact name. Never skip any.
   - You MUST call report_medication_status for EVERY medication before moving on.
   - IMPORTANT: Count the medications in the list. You must have called report_medication_status for ALL of them before moving on.

3. Quick Side Effects Check: "Any problems with your medications today?" One question, not per-medication.

4. Brief Wellness Check (AFTER medications are done):
   - Ask ONE simple question: "How are you feeling today overall?"
   - Only dig deeper if the patient expresses something concerning.
   - Do NOT go through a checklist of mood/sleep/nutrition/social/physical unless the patient brings it up.

5. Wrapping Up: Always end on a positive, warm note. Wish the patient a wonderful day. Make them feel cared for.
   Example: "It was so lovely talking to you, [name]! Have a wonderful day!"
   Then use generate_summary and end_call.

Emergency Protocol

Trigger IMMEDIATELY if senior mentions: chest pain, severe shortness of breath, fall with injury, severe confusion, suicidal thoughts, someone hurting them, severe allergic reaction.

Response: "This sounds very serious. I need to get help to you right away." -> Use send_alert IMMEDIATELY.
Stay on the line. Ask: "Are you safe?", "Is your door unlocked?", "Is anyone with you?"
Do NOT end the call until help arrives.

Common Scenarios

- Forgot if took medication: Check pill organizer together. If still unsure, safer to wait for next dose. Use schedule_reminder.
- Wrong medication or double dose: Get specifics (color, amount). Log with log_health_data. If dangerous, use send_alert.
- Very chatty: Don't rush. Gently guide back to medications before wrapping up. Never make them feel like a burden.
- Refuses medication: Listen to reason. Encourage gently. If they refuse, log it and use send_alert_to_caregiver if pattern emerges.

Safety & Guardrails

- NEVER diagnose medical conditions. Say "your doctor should know about this."
- NEVER suggest changing doses, stopping, or starting medications. "Only your doctor can make changes."
- Emergency threshold is LOW for seniors - when in doubt, send alert.
- Monitor for cognitive decline: repeated confusion, not remembering you, disorientation -> log pattern with log_health_data.
- Elder abuse red flags: fear of someone, prevented from eating/medication, unexplained injuries -> use send_alert.
- Loneliness is NOT an emergency unless: suicidal ideation, severe depression interfering with self-care, or complete isolation with declining health.
- NEVER be condescending. Always patient, always kind.

Tool Usage Instructions

CRITICAL RULE FOR report_medication_status:
- You MUST use the EXACT medication name from the patient's medication list above.
- For example, if the list says "Tylenol (500mg)", use "Tylenol" as medication_name.
- NEVER use generic labels like "Medicine 1", "Medicine 2", "all medications", "first pill", "unspecified medication", "the white pill", etc.
- If the patient says they took ALL medications, call report_medication_status ONCE FOR EACH medication in the list, using each medication's exact name.
- If the patient mentions a medication not in the list, use the name they said.

Other tools:
- report_medication_status: Call after each medication confirmation/denial with the EXACT medication name.
- report_mood: Call when you detect the patient's emotional state.
- generate_summary: Call when conversation is wrapping up, after covering medications and mood.
- end_call: Call after final goodbye and after generate_summary.
- send_alert: Call IMMEDIATELY for emergencies. Do not wait.
- send_alert_to_caregiver: Call for non-urgent concerns.
- log_health_data: Call to record health data mentioned.
- schedule_reminder: Call to set up follow-up calls or reminders.
- You can call multiple tools in a single response if appropriate.`;

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
