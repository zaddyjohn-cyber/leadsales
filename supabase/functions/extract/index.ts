import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateLeadId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return 'FLH-' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function transformLead(raw: Record<string, unknown>): Record<string, string> {
  return {
    'name':            String(raw.name || ''),
    'email':           String(raw.email || ''),
    'phone number':    String(raw.phone_number || ''),
    'city':            String(raw.city || ''),
    'website':         String(raw.url || ''),
    'google maps url': String(raw.google_maps_url || ''),
    'facebook':        String(raw.facebook || ''),
    'instagram':       String(raw.instagram || ''),
    'reviews number':  String(raw.reviews_number || ''),
  };
}

function toCSV(data: Record<string, string>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = data.map(row => headers.map(h => esc(row[h] || '')).join(','));
  return [headers.map(esc).join(','), ...rows].join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders });

    const { category: rawCategory, keyword, country, state, quantity } = await req.json();
    // Convert "Law Firm" → "law_firm" to match Apify's required format
    const category = rawCategory ? rawCategory.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : rawCategory;

    if (!category && !keyword) return new Response(JSON.stringify({ error: 'category or keyword required' }), { status: 400, headers: corsHeaders });
    if (!quantity || quantity < 1) return new Response(JSON.stringify({ error: 'quantity required' }), { status: 400, headers: corsHeaders });

    // Check quota
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .single();

    if (!sub) return new Response(JSON.stringify({ error: 'No active subscription. Please purchase a plan.' }), { status: 403, headers: corsHeaders });

    if (sub.leads_remaining < quantity) {
      return new Response(JSON.stringify({
        error: `Only ${sub.leads_remaining.toLocaleString()} leads left. Lower the number or upgrade.`,
        leads_remaining: sub.leads_remaining,
      }), { status: 403, headers: corsHeaders });
    }

    // Build Apify input
    const actorInput: Record<string, unknown> = {
      maxResults: Math.min(quantity, 50000),
    };
    if (keyword) actorInput.keyword = keyword;
    else if (category) actorInput.category = category;
    if (country && country !== 'ALL') actorInput.country = country;
    if (state && state !== 'ALL' && (!country || country === 'US')) actorInput.state = state;

    // Call Apify — sync run + get dataset items in one request
    const actorId = Deno.env.get('APIFY_ACTOR_ID')!.replace('/', '~');
    const apifyToken = Deno.env.get('APIFY_TOKEN')!;

    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyToken}&format=json&clean=true`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput),
      }
    );

    if (!apifyRes.ok) {
      const err = await apifyRes.text();
      console.error('Apify error:', err);
      return new Response(JSON.stringify({ error: 'Extraction failed. Please try again.' }), { status: 500, headers: corsHeaders });
    }

    const raw: Record<string, unknown>[] = await apifyRes.json();

    // Transform + filter — only leads with email or phone
    const leads = raw
      .filter(r => r.email || r.phone_number || r.phone)
      .slice(0, quantity)
      .map(transformLead);

    const actualCount = leads.length;

    // Deduct quota
    await supabase
      .from('subscriptions')
      .update({ leads_remaining: sub.leads_remaining - actualCount })
      .eq('id', sub.id);

    // Log
    await supabase.from('extraction_logs').insert({
      user_id: user.id,
      subscription_id: sub.id,
      category: keyword || category,
      country: country || 'ALL',
      state: state || 'ALL',
      quantity_requested: quantity,
      leads_returned: actualCount,
    });

    const csv = toCSV(leads);
    const filename = `FLH_${(keyword || category || 'leads').replace(/\s+/g, '_')}_${country || 'ALL'}_${Date.now()}.csv`;

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Leads-Returned': String(actualCount),
        'X-Leads-Remaining': String(sub.leads_remaining - actualCount),
      },
    });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Server error. Please try again.' }), { status: 500, headers: corsHeaders });
  }
});
