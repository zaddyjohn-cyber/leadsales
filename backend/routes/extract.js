const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { extractLeads } = require('../lib/apify');
const { transformLeads } = require('../lib/transform');
const supabase = require('../lib/supabase');
const { Parser } = require('json2csv');

// POST /api/extract
router.post('/', requireAuth, async (req, res) => {
  const { category, keyword, country, state, quantity } = req.body;
  const userId = req.user.id;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'quantity is required' });
  }

  if (!category && !keyword) {
    return res.status(400).json({ error: 'category or keyword is required' });
  }

  // Check subscription quota
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .single();

  if (subErr || !sub) {
    return res.status(403).json({ error: 'No active subscription. Please purchase a plan.' });
  }

  if (sub.leads_remaining < quantity) {
    return res.status(403).json({
      error: `Not enough leads remaining. You have ${sub.leads_remaining} left. Upgrade or renew to continue.`,
      leads_remaining: sub.leads_remaining,
    });
  }

  try {
    // Pull from Apify
    const raw = await extractLeads({ category, keyword, country, state, maxResults: quantity });
    const leads = transformLeads(raw);
    const actualCount = leads.length;

    // Deduct from quota
    const { error: deductErr } = await supabase
      .from('subscriptions')
      .update({ leads_remaining: sub.leads_remaining - actualCount })
      .eq('id', sub.id);

    if (deductErr) {
      console.error('Quota deduct error:', deductErr);
    }

    // Log the extraction
    await supabase.from('extraction_logs').insert({
      user_id: userId,
      subscription_id: sub.id,
      category: category || keyword,
      country: country || 'ALL',
      state: state || 'ALL',
      quantity_requested: quantity,
      leads_returned: actualCount,
    });

    // Return as CSV download
    const parser = new Parser({ fields: Object.keys(leads[0] || {}) });
    const csv = parser.parse(leads);

    const filename = `leads_${(category || keyword || 'export').replace(/\s+/g, '_')}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Leads-Returned', actualCount);
    res.setHeader('X-Leads-Remaining', sub.leads_remaining - actualCount);
    res.send(csv);

  } catch (err) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: 'Extraction failed. Please try again.' });
  }
});

// GET /api/extract/history — recent extractions
router.get('/history', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('extraction_logs')
    .select('category, country, state, quantity_requested, leads_returned, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/extract/quota — check remaining leads
router.get('/quota', requireAuth, async (req, res) => {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, leads_total, leads_remaining, created_at')
    .eq('user_id', req.user.id)
    .eq('active', true)
    .single();

  if (!sub) {
    return res.json({ active: false, leads_remaining: 0 });
  }

  res.json({ active: true, ...sub });
});

module.exports = router;
