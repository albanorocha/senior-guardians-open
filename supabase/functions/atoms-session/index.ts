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
    const rawBody = await req.text();
    console.log('[atoms-session] Raw body received:', rawBody);
    
    const { agentId, variables, userId } = JSON.parse(rawBody);
    console.log('[atoms-session] Parsed - agentId:', agentId, 'userId:', userId);
    console.log('[atoms-session] Parsed - variables:', JSON.stringify(variables));

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

    // Create webcall (variables not supported in webcall endpoint)
    // Context is now saved separately via atoms-save-context
    const webcallBody = JSON.stringify({ agentId });
    console.log('[atoms-session] Creating webcall - URL: https://atoms-api.smallest.ai/api/v1/conversation/webcall');
    console.log('[atoms-session] Creating webcall - body:', webcallBody);
    
    const response = await fetch('https://atoms-api.smallest.ai/api/v1/conversation/webcall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: webcallBody,
    });

    const responseText = await response.text();
    console.log('[atoms-session] Atoms API response status:', response.status);
    console.log('[atoms-session] Atoms API response body:', responseText);

    const data = JSON.parse(responseText);

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
