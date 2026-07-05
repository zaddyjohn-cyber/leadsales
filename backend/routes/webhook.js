const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../lib/supabase');

const PLANS = {
  starter:  { leads: 2000  },
  pro:      { leads: 8500  },
  agency:   { leads: 20000 },
};

function verifyPaystackSignature(req) {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return hash === req.headers['x-paystack-signature'];
}

// POST /api/webhook/paystack
router.post('/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  // Paystack sends raw body — parse it
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  if (!verifyPaystackSignature({ body, headers: req.headers })) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const { event, data } = body;

  // Successful charge / subscription renewal
  if (event === 'charge.success' || event === 'subscription.create') {
    const email = data.customer?.email;
    const planCode = data.plan?.plan_code || data.metadata?.plan;
    const plan = planCode?.toLowerCase();

    if (!email || !PLANS[plan]) {
      return res.status(200).send('OK'); // unknown plan, ignore gracefully
    }

    // Find Supabase user by email
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(200).send('OK');
    }

    // Deactivate any existing subscription
    await supabase
      .from('subscriptions')
      .update({ active: false })
      .eq('user_id', user.id);

    // Create new subscription
    await supabase.from('subscriptions').insert({
      user_id: user.id,
      plan,
      leads_total: PLANS[plan].leads,
      leads_remaining: PLANS[plan].leads,
      active: true,
      paystack_reference: data.reference || null,
    });
  }

  res.status(200).send('OK');
});

module.exports = router;
