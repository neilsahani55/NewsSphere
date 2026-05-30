import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://newssphere.tech';

// Same logic as src/utils/slug.js — must stay in sync.
function slugify(title) {
  if (!title) return 'article';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/-$/, '');
}

const STATIC_PAGES = [
  { path: '/',            changefreq: 'hourly',  priority: '1.0' },
  { path: '/allnews',     changefreq: 'hourly',  priority: '0.9' },
  { path: '/methodology', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy',     changefreq: 'yearly',  priority: '0.2' },
  { path: '/terms',       changefreq: 'yearly',  priority: '0.2' },
  { path: '/grievance',   changefreq: 'yearly',  priority: '0.2' },
];

export default async function handler(_req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
  );

  // Fetch all enriched articles ordered by newest first.
  // No date filter — include everything the frontend can display.
  const { data: articles } = await supabase
    .from('news')
    .select('id, title, published_at_ist, fetched_at_ist')
    .eq('enriched', true)
    .order('published_at_ist', { ascending: false })
    .limit(2000);

  const rows = (articles || []).filter(a => a.id && a.title);
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Static pages
  for (const { path, changefreq, priority } of STATIC_PAGES) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${path}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${changefreq}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;
    xml += '  </url>\n';
  }

  // Article pages
  for (const article of rows) {
    const slug = slugify(article.title);
    const pubDate = article.published_at_ist || article.fetched_at_ist;
    const lastmod = pubDate ? pubDate.slice(0, 10) : today;
    const age = pubDate ? now - new Date(pubDate).getTime() : Infinity;
    const priority = age < 7 * 24 * 60 * 60 * 1000 ? '0.8' : '0.6';

    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/news/${slug}-${article.id}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += '    <changefreq>never</changefreq>\n';
    xml += `    <priority>${priority}</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  res.status(200).send(xml);
}
