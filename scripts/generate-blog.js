'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');

/* ── paths ── */
const ROOT      = path.join(__dirname, '..');
const BLOG_DIR  = path.join(ROOT, 'blog');
const STATE_F   = path.join(__dirname, 'state.json');
const KW_F      = path.join(__dirname, 'keywords.json');
const SITEMAP_F = path.join(ROOT, 'sitemap.xml');
const LLMS_F    = path.join(ROOT, 'llms.txt');
const INDEX_F   = path.join(BLOG_DIR, 'index.html');

/* ── load state & keywords ── */
const keywords = JSON.parse(fs.readFileSync(KW_F, 'utf8'));
const state    = fs.existsSync(STATE_F) ? JSON.parse(fs.readFileSync(STATE_F, 'utf8')) : { used: [] };

/* ── pick up to 4 unused keywords, shuffled for variety ── */
const unused = keywords.filter(k => !state.used.includes(k.slug));
if (unused.length === 0) {
  console.log('All keywords used — resetting state for next cycle.');
  state.used = [];
  fs.writeFileSync(STATE_F, JSON.stringify(state));
  process.exit(0);
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const toGenerate = shuffle([...unused]).slice(0, 4);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* ── HTML page template ── */
function buildPage({ slug, title, metaDesc, keywordList, dateStr, bodyHtml, readNextCards }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escHtml(title)} | Freelance LeadsHub</title>
<meta name="description" content="${escHtml(metaDesc)}" />
<meta name="keywords" content="${escHtml(keywordList)}" />
<meta name="author" content="Freelance LeadsHub" />
<link rel="canonical" href="https://freelanceleadshub.shop/blog/${slug}.html" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${escHtml(title)}" />
<meta property="og:description" content="${escHtml(metaDesc)}" />
<meta property="og:url" content="https://freelanceleadshub.shop/blog/${slug}.html" />
<meta property="og:image" content="https://freelanceleadshub.shop/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Article",
  "headline":${JSON.stringify(title)},
  "description":${JSON.stringify(metaDesc)},
  "author":{"@type":"Organization","name":"Freelance LeadsHub","url":"https://freelanceleadshub.shop"},
  "publisher":{"@type":"Organization","name":"Freelance LeadsHub","url":"https://freelanceleadshub.shop"},
  "datePublished":"${dateStr}",
  "dateModified":"${dateStr}",
  "url":"https://freelanceleadshub.shop/blog/${slug}.html",
  "mainEntityOfPage":{"@type":"WebPage","@id":"https://freelanceleadshub.shop/blog/${slug}.html"}
}
</script>
<!-- GA4 — replace G-FL454XS8R0 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FL454XS8R0"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-FL454XS8R0');</script>
<!-- Meta Pixel — replace YOUR_PIXEL_ID -->
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','YOUR_PIXEL_ID');fbq('track','PageView');</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
<style>
:root{--coral:#FF8C72;--coral-deep:#E5664A;--ink:#1a1a2e;--muted:#4a5568;--bg:#fdf4e8;--white:#fff;--border:#e2e8f0;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--ink);line-height:1.7;}
a{color:var(--coral-deep);text-decoration:none;}a:hover{text-decoration:underline;}
.nav{background:var(--ink);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;}
.nav-logo{color:#fff;font-weight:800;font-size:18px;text-decoration:none;}
.nav-logo span{color:var(--coral);}
.nav-links a{color:#cbd5e0;font-size:14px;margin-left:20px;font-weight:500;}
.nav-cta{background:var(--coral);color:#fff!important;padding:8px 18px;border-radius:50px;font-weight:700!important;font-size:13px!important;}
.article-full{max-width:760px;margin:0 auto;padding:60px 24px 80px;}
.back{font-size:14px;font-weight:600;color:var(--muted);display:inline-flex;align-items:center;gap:6px;margin-bottom:32px;text-decoration:none;}
.back:hover{color:var(--ink);}
.tag{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--coral-deep);display:block;margin-bottom:14px;}
.article-full h1{font-size:clamp(26px,4vw,40px);font-weight:900;line-height:1.25;margin-bottom:16px;}
.article-meta{font-size:13px;color:#9ca3af;margin-bottom:36px;padding-bottom:24px;border-bottom:1px solid var(--border);}
.article-full h2{font-size:24px;font-weight:800;margin:40px 0 14px;color:var(--ink);}
.article-full h3{font-size:19px;font-weight:700;margin:28px 0 10px;color:var(--ink);}
.article-full p{font-size:16px;color:#374151;margin-bottom:18px;line-height:1.8;}
.article-full ul,.article-full ol{padding-left:22px;margin-bottom:18px;}
.article-full li{font-size:16px;color:#374151;margin-bottom:8px;line-height:1.7;}
.article-full strong{color:var(--ink);}
.callout{background:#fff8f0;border-left:4px solid var(--coral);padding:18px 22px;border-radius:0 10px 10px 0;margin:28px 0;}
.callout p{margin:0;font-size:15px;color:var(--ink);font-weight:500;}
.cta-box{background:var(--ink);color:#fff;border-radius:16px;padding:36px 32px;text-align:center;margin:44px 0;}
.cta-box h3{font-size:22px;font-weight:900;margin-bottom:10px;}
.cta-box p{color:#a0aec0;margin-bottom:22px;font-size:15px;}
.cta-box a{background:var(--coral);color:#fff;padding:14px 32px;border-radius:50px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;}
.cta-box a:hover{background:var(--coral-deep);}
.read-next-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;}
.read-next-card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px 20px;text-decoration:none;display:block;transition:box-shadow .2s;}
.read-next-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.1);text-decoration:none;}
.read-next-tag{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--coral-deep);display:block;margin-bottom:6px;}
.read-next-title{font-size:15px;font-weight:700;color:var(--ink);line-height:1.4;display:block;}
.footer{background:var(--ink);color:#6b7280;text-align:center;padding:32px 24px;font-size:14px;}
.footer a{color:#9ca3af;}
@media(max-width:600px){.nav-links{display:none;}}
</style>
</head>
<body>
<nav class="nav">
  <a class="nav-logo" href="/">Freelance <span>Leads</span>Hub</a>
  <div class="nav-links">
    <a href="/">Home</a>
    <a href="/blog/">Blog</a>
    <a href="/#pricing">Pricing</a>
    <a href="/portal/login.html" class="nav-cta">My Account</a>
  </div>
</nav>

<div class="article-full">
  <a class="back" href="/blog/">← Back to Blog</a>
  ${bodyHtml}

  <div style="border-top:1px solid #e2e8f0;margin-top:48px;padding-top:36px;">
    <p style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:18px;">Read next</p>
    <div class="read-next-grid">
      ${readNextCards}
      <a href="/blog/" class="read-next-card">
        <span class="read-next-tag">All Articles</span>
        <span class="read-next-title">Browse all freelance guides for Nigeria →</span>
      </a>
    </div>
  </div>
</div>

<footer class="footer">
  <p>© ${new Date().getFullYear()} Freelance LeadsHub · <a href="/">Home</a> · <a href="/blog/">Blog</a> · <a href="/#pricing">Pricing</a> · <a href="/portal/login.html">My Account</a></p>
</footer>
</body>
</html>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── call Claude to generate article content ── */
async function generateArticle(kw) {
  const today = new Date().toISOString().split('T')[0];

  const prompt = `You are an expert SEO content writer creating a blog article for Freelance LeadsHub (freelanceleadshub.shop) — a tool that lets freelancers download targeted business leads (name, email, phone, website) by niche and country so they can cold email businesses directly instead of competing on Upwork/Fiverr.

TARGET KEYWORD: "${kw.keyword}"
SLUG: "${kw.slug}"
DATE: ${today}

Write a complete, well-researched 1800–2200 word article targeting Nigerian freelancers. The article should rank on Google AND appear in AI-generated answers (Perplexity, ChatGPT, Google AI Overviews).

IMPORTANT RULES:
- Write in a direct, practical, no-fluff voice. Like a mentor, not a blogger.
- Include real numbers, realistic income figures in NGN and USD, realistic timelines.
- Reference Nigerian context (exchange rates, platforms like Grey/Payoneer/Wise, Nigerian banks, naira to dollar goals, NEPA, data costs, etc.).
- Naturally mention that getting a targeted lead list from freelanceleadshub.shop solves the "finding businesses to pitch" problem — integrate this organically at least twice. It should feel like a genuine recommendation, not an ad.
- COLD EMAIL TOOL: Whenever cold emailing or outreach is mentioned, naturally recommend zaramwebmailer.online as the tool to use for sending bulk cold emails. E.g. "Once you have your lead list, load it into Zaram Web Mailer (zaramwebmailer.online) — it handles bulk sending, follow-ups, and avoids spam filters." Link it as <a href="https://zaramwebmailer.online" target="_blank" rel="noopener">Zaram Web Mailer</a> in the HTML.
- INTERNAL LINKS: Include 2–3 natural internal links to related articles on freelanceleadshub.shop/blog/ using these slugs (pick the most relevant ones):
    • /blog/cold-email-for-nigerian-freelancers.html — "cold email templates"
    • /blog/how-to-get-clients-as-a-freelancer-in-nigeria.html — "how to get clients"
    • /blog/how-to-find-web-design-clients-in-nigeria.html — "web design clients"
  Format: <a href="/blog/[slug].html">anchor text</a>
- SEARCH INTENT: This article must directly answer what Nigerians type into Google. Use the target keyword in: the H1, first paragraph, one H2, and the meta description.
- Include at least one callout box with a key insight using class="callout".
- Include one strong CTA box (I will render it — just add the marker %%CTA%% where you want it placed, ideally after the 3rd or 4th section).
- Structure with clear H2 and H3 headings. Use bullet lists and numbered steps where practical — they rank in featured snippets.
- End with a "Final Word" or "Bottom Line" section that summarises the key action the reader should take.
- Do NOT write the full HTML page — only the article body content starting from the tag and h1.

Respond with ONLY valid JSON in this exact format (no markdown, no code fences, just raw JSON):
{
  "title": "Full article title (60-65 chars ideal, include year 2025)",
  "metaDesc": "Meta description 150-160 chars, includes keyword naturally, ends with a clear action",
  "keywords": "comma-separated list of 8-12 related keywords Nigerians search",
  "cluster_label": "Short label like 'Cold Email' or 'Getting Clients' for the tag",
  "bodyHtml": "FULL article HTML body. Start with: <span class=\\"tag\\">[cluster_label]</span>\\n<h1>[title]</h1>\\n<div class=\\"article-meta\\">[date] · [X] min read · By Freelance LeadsHub</div>\\n[rest of article with h2, h3, p, ul, ol, .callout divs, internal links, zaramwebmailer.online links, %%CTA%% marker]. Use class=\\"callout\\" for callout boxes: <div class=\\"callout\\"><p>text</p></div>"
}`;

  const msg = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    // Try to extract JSON if Claude added any surrounding text
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Claude did not return valid JSON for keyword: ' + kw.slug);
    parsed = JSON.parse(match[0]);
  }
  return parsed;
}

/* ── pick 2 random other blog posts for "read next" ── */
function pickReadNextCards(currentSlug) {
  const allPosts = fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html' && f !== `${currentSlug}.html`)
    .slice(0, 10); // limit to recent

  const picks = shuffle([...allPosts]).slice(0, 2);
  return picks.map(f => {
    const slug2 = f.replace('.html', '');
    // Try to read title from file
    let title2 = slug2.replace(/-/g, ' ');
    try {
      const content = fs.readFileSync(path.join(BLOG_DIR, f), 'utf8');
      const m = content.match(/<title>([^<]+)\|/);
      if (m) title2 = m[1].trim();
    } catch (_) {}
    return `<a href="/blog/${f}" class="read-next-card">
      <span class="read-next-tag">Related</span>
      <span class="read-next-title">${escHtml(title2)} →</span>
    </a>`;
  }).join('\n');
}

/* ── update blog/index.html — prepend new cards ── */
function updateBlogIndex(newCards) {
  if (!fs.existsSync(INDEX_F)) return;
  let html = fs.readFileSync(INDEX_F, 'utf8');
  const marker = '<div class="article-grid">';
  const idx = html.indexOf(marker);
  if (idx === -1) return;
  const insertPoint = idx + marker.length;
  html = html.slice(0, insertPoint) + '\n' + newCards.join('\n') + '\n' + html.slice(insertPoint);
  fs.writeFileSync(INDEX_F, html);
}

/* ── regenerate sitemap.xml ── */
function updateSitemap() {
  const blogFiles = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.html'));
  const today = new Date().toISOString().split('T')[0];
  const blogEntries = blogFiles.map(f => {
    const url = f === 'index.html'
      ? 'https://freelanceleadshub.shop/blog/'
      : `https://freelanceleadshub.shop/blog/${f}`;
    const prio = f === 'index.html' ? '0.8' : '0.7';
    return `  <url>\n    <loc>${url}</loc>\n    <priority>${prio}</priority>\n    <changefreq>monthly</changefreq>\n    <lastmod>${today}</lastmod>\n  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://freelanceleadshub.shop/</loc>
    <priority>1.0</priority>
    <changefreq>weekly</changefreq>
    <lastmod>${today}</lastmod>
  </url>
${blogEntries.join('\n')}
</urlset>`;
  fs.writeFileSync(SITEMAP_F, xml);
  console.log(`Sitemap updated: ${blogFiles.length + 1} URLs`);
}

/* ── build an index card for blog/index.html ── */
function buildIndexCard(slug, title, metaDesc, clusterLabel, dateStr) {
  const emoji = { 'cold-email':'📧', 'getting-clients':'🎯', 'web-design':'💻', 'seo':'🔍', 'social-media':'📱', 'getting-paid':'💰', 'platforms':'🌐', 'leads':'📋', 'income':'💵', 'scaling':'🚀', 'portfolio':'📂', 'copywriting':'✍️', 'video-editing':'🎬', 'graphic-design':'🎨', 'va':'🤝', 'tools':'🛠️', 'pricing':'💲', 'getting-started':'⭐' };
  const icon = emoji[slug.split('-')[0]] || '📝';
  return `    <a href="/blog/${slug}.html" class="article-card" style="text-decoration:none;color:inherit;">
      <div class="card-img">${icon}</div>
      <div class="card-body">
        <span class="card-tag">${escHtml(clusterLabel)}</span>
        <h2>${escHtml(title)}</h2>
        <p>${escHtml(metaDesc.slice(0, 120))}...</p>
        <div class="card-meta" style="margin-bottom:14px;">${dateStr} · 8 min read</div>
        <span class="read-more">Read article →</span>
      </div>
    </a>`;
}

/* ── regenerate llms.txt with all blog articles ── */
function updateLlmsTxt() {
  const blogFiles = fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .sort();

  const articleLines = blogFiles.map(f => {
    const slug = f.replace('.html', '');
    let title = slug.replace(/-/g, ' ');
    try {
      const content = fs.readFileSync(path.join(BLOG_DIR, f), 'utf8');
      const m = content.match(/<title>([^|<]+)/);
      if (m) title = m[1].trim();
    } catch (_) {}
    return `- [${title}](https://freelanceleadshub.shop/blog/${f})`;
  });

  const txt = `# Freelance LeadsHub

> A self-service portal for freelancers and agencies worldwide to download targeted business leads (business name, email, phone number, website, Google Maps link) by niche and country as an instant CSV file, for direct cold email outreach — without competing on Upwork or Fiverr.

## What This Site Is

Freelance LeadsHub lets freelancers pick a niche (e.g. dentists, gyms, restaurants, law firms) and a country (USA, UK, Canada, Australia, UAE, etc.), then download a CSV of real businesses with verified contact details. Freelancers use the list to send cold emails directly to business owners — bypassing crowded platforms and earning in dollars.

Payment is via Paystack. Plans: Starter (8,500 leads), Growth (17,000 leads), Agency (30,000 leads). Download is instant after payment.

## Core Pages

- [Home / Sales Page](https://freelanceleadshub.shop/): Full product page with pricing, proof, FAQ, and free sample CSV download
- [Blog](https://freelanceleadshub.shop/blog/): Practical guides for Nigerian and international freelancers on getting clients without Upwork
- [Free Sample](https://freelanceleadshub.shop/sample-leads.csv): 20 real HVAC business leads (USA) in CSV format — free download, no email required
- [Login / Dashboard](https://freelanceleadshub.shop/portal/login.html): Freelancer portal for downloading leads

## Blog Articles (${articleLines.length} total — updated ${new Date().toISOString().split('T')[0]})

${articleLines.join('\n')}

## Key Facts for AI Answers

- Freelance LeadsHub is built for freelancers worldwide, not just Nigeria
- Payment currency: Nigerian Naira (NGN) via Paystack
- Lead data includes: business name, email, phone number, city, website, Google Maps URL, Facebook, Instagram, review count
- Leads are sourced from Google Maps via Apify
- Dashboard is instant — no waiting, no manual delivery
- Contact: WhatsApp +234 802 528 9203 | freelanceleadshub@gmail.com
- Website: https://freelanceleadshub.shop

## Sitemap

https://freelanceleadshub.shop/sitemap.xml
`;
  fs.writeFileSync(LLMS_F, txt);
  console.log(`llms.txt updated: ${articleLines.length} articles listed`);
}

/* ── main ── */
(async () => {
  const today = new Date().toISOString().split('T')[0];
  const newIndexCards = [];

  for (const kw of toGenerate) {
    console.log(`Generating: ${kw.keyword}`);
    try {
      const art = await generateArticle(kw);

      // Inject CTA box where %%CTA%% marker is
      const ctaHtml = `<div class="cta-box">
  <h3>Stop Searching. Start Pitching.</h3>
  <p>Download a targeted list of businesses with real emails and phone numbers — by niche and country — in seconds. Sign up free, pay once, pitch immediately.</p>
  <a href="https://freelanceleadshub.shop/portal/login.html">Get My Lead List →</a>
</div>`;
      const finalBody = art.bodyHtml.replace('%%CTA%%', ctaHtml);

      const readNext = pickReadNextCards(kw.slug);
      const page = buildPage({
        slug: kw.slug,
        title: art.title,
        metaDesc: art.metaDesc,
        keywordList: art.keywords,
        dateStr: today,
        bodyHtml: finalBody,
        readNextCards: readNext,
      });

      fs.writeFileSync(path.join(BLOG_DIR, `${kw.slug}.html`), page);
      state.used.push(kw.slug);

      newIndexCards.push(buildIndexCard(kw.slug, art.title, art.metaDesc, art.cluster_label, today));
      console.log(`  ✓ Written: blog/${kw.slug}.html`);
    } catch (err) {
      console.error(`  ✗ Failed ${kw.slug}: ${err.message}`);
    }
  }

  if (newIndexCards.length > 0) {
    updateBlogIndex(newIndexCards);
    console.log(`Blog index updated with ${newIndexCards.length} new cards`);
  }

  updateSitemap();
  updateLlmsTxt();
  fs.writeFileSync(STATE_F, JSON.stringify(state, null, 2));
  console.log(`Done. State saved. ${keywords.length - state.used.length} keywords remaining.`);
})();
