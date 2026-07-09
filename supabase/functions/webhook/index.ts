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

    // Send payment confirmation email via Resend
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_KEY) {
      const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
      const leads = PLANS[plan].leads.toLocaleString();
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_KEY}`,
        },
        body: JSON.stringify({
          from: 'Freelance LeadsHub <noreply@zaramwebmailer.online>',
          to: email,
          subject: `✅ Payment confirmed — your ${planLabel} plan is active`,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
              <div style="background:#1a1a2e;padding:32px 36px;text-align:center;">
                <h1 style="color:#FF8C72;margin:0;font-size:22px;">Freelance LeadsHub</h1>
              </div>
              <div style="padding:36px;">
                <h2 style="color:#1a1a2e;font-size:22px;margin-bottom:8px;">🎉 Payment confirmed!</h2>
                <p style="color:#4a5568;font-size:15px;margin-bottom:20px;">Your <strong>${planLabel} plan</strong> is now active. You have <strong>${leads} leads</strong> ready to download.</p>

                <div style="background:#fdf4e8;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
                  <p style="margin:0 0 10px;font-weight:700;color:#1a1a2e;">Here's how to get started:</p>
                  <ol style="color:#4a5568;font-size:14px;padding-left:18px;margin:0;line-height:2;">
                    <li>Log in to your dashboard</li>
                    <li>Pick your niche and country (e.g. dentists · USA · Texas)</li>
                    <li>Hit Extract — your CSV downloads instantly</li>
                    <li>Load the CSV into <a href="https://zaramwebmailer.online" style="color:#FF8C72;">Zaram Web Mailer</a> and start pitching</li>
                  </ol>
                </div>

                <a href="https://freelanceleadshub.shop/portal/dashboard.html"
                   style="display:inline-block;background:#FF8C72;color:#fff;padding:14px 32px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;">
                  Go to My Dashboard →
                </a>

                <p style="margin-top:24px;font-size:13px;color:#9ca3af;">
                  Questions? Reply to this email or
                  <a href="https://wa.me/2348025289203" style="color:#FF8C72;">message us on WhatsApp</a>.
                </p>
              </div>
            </div>
          `,
        }),
      }).catch(() => {}); // fail silently — don't break webhook
    }
  }

  return new Response('OK', { status: 200 });
});
