

# Fix: Admin Edge Function Authentication

## Problem

The `admin-data` edge function uses `anonClient.auth.getClaims(token)` which is not a valid method in `@supabase/supabase-js@2`. This causes the authentication step to fail silently, resulting in the 403 Forbidden error.

## Solution

Replace the `getClaims` call with `getUser()`, which is the correct method to extract the authenticated user's ID from the JWT token.

## Changes

### File: `supabase/functions/admin-data/index.ts`

Replace lines 27-41 (the user identity verification block):

**Before:**
```typescript
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
```

**After:**
```typescript
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
});

const { data: { user }, error: userError } = await anonClient.auth.getUser();
if (userError || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const userId = user.id;
```

This is the only change needed. After redeploying the edge function, the admin verification and all admin-data actions will work correctly.

