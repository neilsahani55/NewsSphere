// Parse the gviz date format "Date(yyyy,m,d,H,M,S)" or any ISO/standard string.
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;

  if (typeof value === 'string') {
    const m = value.match(/^Date\((\d+),(\d+),(\d+),?(\d*),?(\d*),?(\d*)\)$/);
    if (m) {
      const [, y, mo, d, h = 0, mi = 0, s = 0] = m;
      return new Date(+y, +mo, +d, +h || 0, +mi || 0, +s || 0);
    }
    const dt = new Date(value);
    return isNaN(dt) ? null : dt;
  }
  return null;
}

export function formatDate(value) {
  const d = parseDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(value) {
  const d = parseDate(value);
  if (!d) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n).trimEnd() + '…' : str;
}

export function stripHtml(str) {
  if (!str) return '';
  return String(str).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Splits the raw key_points cell into individual bullet strings. Handles
// newline, bullet glyph, and semicolon separators, and trims leading list
// markers ("-", "*", "•") so the UI can render its own bullets.
export function parseKeyPoints(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(/\r?\n|•|·|;/)
    .map((s) => s.replace(/^[-*\s]+/, '').trim())
    .filter(Boolean);
}

// True when the row has both `content` and `key_points` populated. The Apps
// Script fills these asynchronously, so half-finished rows arrive in the sheet
// — we use this to keep the feed focused on fully-enriched articles.
// Whitespace-only and HTML-only values count as missing.
export function hasFullArticle(article) {
  if (!article) return false;
  const content    = stripHtml(article.content);
  const keyPoints  = String(article.key_points || '').trim();
  return content.length > 0 && keyPoints.length > 0;
}

export function formatRelativeUpdate(date) {
  if (!date) return 'never';
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 10) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
