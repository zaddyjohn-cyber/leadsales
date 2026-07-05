import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 401, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders });

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, leads_total, leads_remaining, created_at')
    .eq('user_id', user.id)
    .eq('active', true)
    .single();

  if (!sub) return new Response(JSON.stringify({ active: false, leads_remaining: 0 }), { headers: corsHeaders });

  return new Response(JSON.stringify({ active: true, ...sub }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
