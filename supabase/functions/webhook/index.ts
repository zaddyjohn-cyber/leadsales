import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLANS: Record<string, { leads: number }> = {
  starter: { leads: 8500  },
  growth:  { leads: 17000 },
  agency:  { leads: 30000 },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = await req.text();

  // Verify Paystack signature
  const sig = req.headers.get('x-paystack-signature');
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')!;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hash = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (hash !== sig) return new Response('Invalid signature', { status: 400 });

  const { event, data } = JSON.parse(body);

  if (event === 'charge.success' || event === 'subscription.create') {
    const email = data.customer?.email;
    const planRaw = (data.plan?.plan_code || data.metadata?.plan || '').toLowerCase();
    const plan = Object.keys(PLANS).find(p => planRaw.includes(p));

    if (!email || !plan) return new Response('OK', { status: 200 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find((u: { email: string }) => u.email === email);
    if (!user) return new Response('OK', { status: 200 });

    await supabase.from('subscriptions').update({ active: false }).eq('user_id', user.id);

    await supabase.from('subscriptions').insert({
      user_id: user.id,
      plan,
      leads_total: PLANS[plan].leads,
      leads_remaining: PLANS[plan].leads,
      active: true,
      paystack_reference: data.reference || null,
    });
  }

  return new Response('OK', { status: 200 });
});
