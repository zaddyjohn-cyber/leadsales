const crypto = require('crypto');

function generateLeadId() {
  return 'FLH-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// Rename + clean a single Apify result row into branded output
function transformLead(raw) {
  return {
    'Lead ID':       generateLeadId(),
    'Business Name': raw.title || raw.name || '',
    'Industry':      Array.isArray(raw.categories) ? raw.categories[0] : (raw.categoryName || ''),
    'Address':       raw.street || raw.address || '',
    'City':          raw.city || '',
    'State':         raw.state || '',
    'Country':       raw.country || 'United States',
    'Phone':         raw.phone || raw.phoneUnformatted || '',
    'Email':         raw.email || '',
    'Website':       raw.website || '',
    'Facebook':      raw.facebook || '',
    'Instagram':     raw.instagram || '',
    'LinkedIn':      raw.linkedin || '',
    'Reviews':       raw.reviewsCount || raw.totalScore ? `${raw.reviewsCount || 0} reviews` : '',
    'Date Sourced':  today(),
    'Status':        'New',
  };
}

function transformLeads(rawList) {
  return rawList
    .filter(r => r.email || r.phone) // only leads with at least one contact method
    .map(transformLead);
}

module.exports = { transformLeads };
