const INDEXNOW_KEY = '4804f77a51214d43b2dc68dd0ada6901';
const KEY_LOCATION = `https://newssphere.tech/${INDEXNOW_KEY}.txt`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { urls } = req.body || {};

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls must be a non-empty array' });
  }

  // IndexNow accepts up to 10,000 URLs per request.
  const payload = {
    host: 'newssphere.tech',
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls.slice(0, 10000),
  };

  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    // 200 = accepted, 202 = queued — both mean success.
    if (response.ok || response.status === 202) {
      return res.status(200).json({ submitted: urls.length, status: response.status });
    }

    const text = await response.text();
    console.error('IndexNow error:', response.status, text);
    return res.status(502).json({ error: 'IndexNow rejected the request', status: response.status });
  } catch (err) {
    console.error('IndexNow fetch failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
