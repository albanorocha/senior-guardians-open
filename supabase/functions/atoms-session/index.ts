import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId, variables, userId } = await req.json();

    if (!agentId) {
      return new Response(JSON.stringify({ error: 'agentId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('SMALLEST_AI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save context to pre_call_context table if userId and variables are provided
    if (userId && variables) {
      console.log('[atoms-session] Saving pre-call context for user:', userId);
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { error: upsertError } = await supabase
        .from('pre_call_context')
        .upsert(
          { user_id: userId, variables, created_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (upsertError) {
        console.error('[atoms-session] Error saving context:', upsertError.message);
      } else {
        console.log('[atoms-session] Context saved successfully');
      }
    }

    // Create webcall without variables (the Pre Call API webhook will provide them)
    console.log('[atoms-session] Creating webcall for agent:', agentId);
    const response = await fetch('https://atoms-api.smallest.ai/api/v1/conversation/webcall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ agentId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.message || 'Failed to create session' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[atoms-session] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
