import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user identity
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Use service role client to check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse action
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "list_patients") {
      // Get all profiles
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!profiles || profiles.length === 0) {
        return new Response(
          JSON.stringify({ patients: [], metrics: { total: 0, checkInsToday: 0, activeAlerts: 0 } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const profileIds = profiles.map((p: any) => p.id);

      // Fetch aggregated data
      const [checkInsRes, alertsRes, medsRes] = await Promise.all([
        adminClient.from("check_ins").select("id, user_id, scheduled_at, status").in("user_id", profileIds),
        adminClient.from("alerts").select("id, user_id, acknowledged").in("user_id", profileIds),
        adminClient.from("medications").select("id, user_id, active").in("user_id", profileIds),
      ]);

      const checkIns = checkInsRes.data || [];
      const alerts = alertsRes.data || [];
      const meds = medsRes.data || [];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const patients = profiles.map((p: any) => {
        const pCheckIns = checkIns.filter((c: any) => c.user_id === p.id);
        const pAlerts = alerts.filter((a: any) => a.user_id === p.id);
        const pMeds = meds.filter((m: any) => m.user_id === p.id);
        const lastCheckIn = pCheckIns
          .sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];
        const completedCheckIns = pCheckIns.filter((c: any) => c.status === "completed").length;

        return {
          id: p.id,
          full_name: p.full_name,
          age: p.age,
          role: p.role,
          phone: p.phone,
          created_at: p.created_at,
          total_check_ins: pCheckIns.length,
          completed_check_ins: completedCheckIns,
          adherence: pCheckIns.length > 0 ? Math.round((completedCheckIns / pCheckIns.length) * 100) : 0,
          last_check_in: lastCheckIn?.scheduled_at || null,
          active_alerts: pAlerts.filter((a: any) => !a.acknowledged).length,
          total_alerts: pAlerts.length,
          active_medications: pMeds.filter((m: any) => m.active).length,
        };
      });

      const metrics = {
        total: profiles.length,
        checkInsToday: checkIns.filter(
          (c: any) => new Date(c.scheduled_at) >= todayStart
        ).length,
        activeAlerts: alerts.filter((a: any) => !a.acknowledged).length,
      };

      return new Response(JSON.stringify({ patients, metrics }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "patient_detail") {
      const patientId = url.searchParams.get("patient_id");
      if (!patientId) {
        return new Response(JSON.stringify({ error: "patient_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [profileRes, checkInsRes, alertsRes, medsRes, healthRes] = await Promise.all([
        adminClient.from("profiles").select("*").eq("id", patientId).single(),
        adminClient.from("check_ins").select("*").eq("user_id", patientId).order("scheduled_at", { ascending: false }).limit(50),
        adminClient.from("alerts").select("*").eq("user_id", patientId).order("created_at", { ascending: false }),
        adminClient.from("medications").select("*").eq("user_id", patientId),
        adminClient.from("health_logs").select("*").eq("user_id", patientId).order("created_at", { ascending: false }).limit(50),
      ]);

      return new Response(
        JSON.stringify({
          profile: profileRes.data,
          check_ins: checkInsRes.data || [],
          alerts: alertsRes.data || [],
          medications: medsRes.data || [],
          health_logs: healthRes.data || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin status endpoint
    if (action === "verify") {
      return new Response(JSON.stringify({ isAdmin: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-data error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
