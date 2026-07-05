const { ApifyClient } = require('apify-client');

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function extractLeads({ category, keyword, country, state, maxResults }) {
  const input = {
    maxResults: Math.min(maxResults, 100000),
  };

  if (keyword) {
    input.keyword = keyword;
  } else if (category) {
    input.category = category;
  }

  if (country && country !== 'ALL') {
    input.country = country;
  }

  if (state && state !== 'ALL' && (!country || country === 'US')) {
    input.state = state;
  }

  const run = await client.actor(process.env.APIFY_ACTOR_ID).call(input, {
    // wait up to 5 minutes for the run to finish
    waitSecs: 300,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: maxResults,
  });

  return items;
}

module.exports = { extractLeads };
