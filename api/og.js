import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://newssphere.tech';

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripHtml(str) {
  return (str || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Cache the built index.html for the lifetime of a warm function instance.
// This avoids a filesystem read on every invocation.
let _baseHtml = null;

function getBaseHtml() {
  if (_baseHtml) return _baseHtml;
  try {
    _baseHtml = fs.readFileSync(
      path.join(process.cwd(), 'dist', 'index.html'),
      'utf-8',
    );
  } catch {
    _baseHtml = null;
  }
  return _baseHtml;
}

export default async function handler(req, res) {
  // Vercel passes the matched :slug path parameter as a query string value.
  // e.g. /news/my-article-123  →  req.query.slug = "my-article-123"
  const slug = req.query.slug || '';
  const match = slug.match(/^(.+)-(\d+)$/);
  const articleId = match ? parseInt(match[2], 10) : null;
  const canonicalUrl = `${BASE}/news/${slug}`;

  let html = getBaseHtml();

  // Fallback: fetch the base HTML from the CDN if dist/index.html isn't
  // accessible (e.g. during local development).
  if (!html) {
    try {
      const r = await fetch(`${BASE}/`);
      html = await r.text();
      _baseHtml = html;
    } catch (err) {
      console.error('base HTML fetch failed:', err.message);
      res.status(500).send('Internal server error');
      return;
    }
  }

  if (articleId) {
    try {
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_ANON_KEY,
      );

      const { data: article } = await supabase
        .from('news')
        .select('id, title, description, image_url, source_name, published_at_ist')
        .eq('id', articleId)
        .single();

      if (article) {
        const pageTitle = esc(`${article.title} — NewsSphere`);
        const desc = esc(stripHtml(article.description).slice(0, 200) || 'Read this story on NewsSphere.');
        const img = article.image_url ? esc(article.image_url) : null;

        html = html
          // <title>
          .replace(/<title>[^<]*<\/title>/, `<title>${pageTitle}</title>`)
          // canonical
          .replace(
            /(<link rel="canonical" href=")[^"]*(")/,
            `$1${canonicalUrl}$2`,
          )
          // description
          .replace(
            /(<meta name="description" content=")[^"]*(")/,
            `$1${desc}$2`,
          )
          // og:url
          .replace(
            /(<meta property="og:url" content=")[^"]*(")/,
            `$1${esc(canonicalUrl)}$2`,
          )
          // og:title
          .replace(
            /(<meta property="og:title" content=")[^"]*(")/,
            `$1${pageTitle}$2`,
          )
          // og:description
          .replace(
            /(<meta property="og:description" content=")[^"]*(")/,
            `$1${desc}$2`,
          )
          // twitter:title
          .replace(
            /(<meta name="twitter:title" content=")[^"]*(")/,
            `$1${pageTitle}$2`,
          )
          // twitter:description
          .replace(
            /(<meta name="twitter:description" content=")[^"]*(")/,
            `$1${desc}$2`,
          );

        // Inject og:image + switch to summary_large_image card when available
        if (img) {
          const imgBlock = [
            `<meta property="og:image" content="${img}" />`,
            `<meta property="og:image:width" content="1200" />`,
            `<meta property="og:image:height" content="630" />`,
            `<meta name="twitter:image" content="${img}" />`,
            `<meta name="twitter:card" content="summary_large_image" />`,
            '',
          ].join('\n    ');
          html = html.replace(
            '<meta property="og:url"',
            imgBlock + '<meta property="og:url"',
          );
        }
      }
    } catch (err) {
      // If Supabase lookup fails, serve the unmodified base HTML — the SPA
      // will still load correctly, just without article-specific OG tags.
      console.error('OG injection failed:', err.message);
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache on Vercel's CDN for 1 hour — article content doesn't change.
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  res.status(200).send(html);
}
