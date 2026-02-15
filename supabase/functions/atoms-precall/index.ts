import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Log request details
  console.log('[atoms-precall] ========== NEW REQUEST ==========');
  console.log('[atoms-precall] Method:', req.method);
  console.log('[atoms-precall] URL:', req.url);
  
  // Log all headers
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObj[key] = key.toLowerCase().includes('authorization') || key.toLowerCase().includes('apikey') 
      ? value.substring(0, 20) + '...' 
      : value;
  });
  console.log('[atoms-precall] Headers:', JSON.stringify(headersObj));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    console.log('[atoms-precall] Received body:', body);
    console.log('[atoms-precall] Body length:', body.length);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the most recent pre_call_context entry
    console.log('[atoms-precall] Querying pre_call_context table...');
    const { data, error } = await supabase
      .from('pre_call_context')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('[atoms-precall] No context found. Error:', error?.message);
      const emptyResponse = { variables: {} };
      console.log('[atoms-precall] Returning empty:', JSON.stringify(emptyResponse));
      return new Response(JSON.stringify(emptyResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[atoms-precall] DB row found - id:', data.id, 'user_id:', data.user_id, 'created_at:', data.created_at);
    console.log('[atoms-precall] DB variables:', JSON.stringify(data.variables));

    const responsePayload = { variables: data.variables };
    console.log('[atoms-precall] Full response payload:', JSON.stringify(responsePayload));
    console.log('[atoms-precall] ========== END REQUEST ==========');

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[atoms-precall] Error:', error.message);
    return new Response(JSON.stringify({ variables: {} }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
