<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">

  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <meta name="robots" content="noindex, follow"/>
        <title>NewsSphere — Sitemap</title>
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f4f6fa;
            color: #1a1a2e;
            min-height: 100vh;
          }
          header {
            background: #1a3c6e;
            color: #fff;
            padding: 2rem 2.5rem;
          }
          header a { color: #fff; text-decoration: none; }
          header a:hover { text-decoration: underline; }
          .brand { font-size: 1.5rem; font-weight: 700; letter-spacing: -.5px; }
          .brand span { color: #60a5fa; }
          header p { margin-top: .5rem; font-size: .9rem; opacity: .85; }
          .stat { display: inline-block; margin-top: .75rem; background: rgba(255,255,255,.15);
                  padding: .25rem .75rem; border-radius: 20px; font-size: .8rem; }
          main { max-width: 1100px; margin: 2rem auto; padding: 0 1.5rem 4rem; }
          .section-hd { font-size: .7rem; font-weight: 700; letter-spacing: 1px;
                        text-transform: uppercase; color: #64748b; margin: 2rem 0 .75rem; }
          table { width: 100%; border-collapse: collapse; background: #fff;
                  border-radius: 10px; overflow: hidden;
                  box-shadow: 0 1px 4px rgba(0,0,0,.08); }
          thead { background: #1a3c6e; color: #fff; }
          th { padding: .85rem 1rem; text-align: left; font-size: .78rem;
               font-weight: 600; letter-spacing: .4px; white-space: nowrap; }
          td { padding: .7rem 1rem; font-size: .82rem; border-bottom: 1px solid #f1f5f9;
               vertical-align: top; }
          tr:last-child td { border-bottom: none; }
          tr:hover td { background: #f8faff; }
          td a { color: #1a3c6e; text-decoration: none; word-break: break-all; }
          td a:hover { text-decoration: underline; color: #2563eb; }
          .pill { display: inline-block; padding: .15rem .55rem; border-radius: 12px;
                  font-size: .72rem; font-weight: 600; }
          .freq-hourly  { background: #dbeafe; color: #1e40af; }
          .freq-daily   { background: #d1fae5; color: #065f46; }
          .freq-weekly  { background: #fef3c7; color: #92400e; }
          .freq-monthly { background: #f3f4f6; color: #374151; }
          .freq-never   { background: #f3f4f6; color: #9ca3af; }
          .freq-yearly  { background: #fce7f3; color: #831843; }
          .pri-hi { color: #16a34a; font-weight: 700; }
          .pri-md { color: #d97706; font-weight: 600; }
          .pri-lo { color: #9ca3af; }
          footer { text-align: center; padding: 2rem; font-size: .78rem; color: #94a3b8; }
          footer a { color: #1a3c6e; text-decoration: none; }
          @media(max-width:640px) {
            th:nth-child(3), td:nth-child(3),
            th:nth-child(4), td:nth-child(4) { display: none; }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="brand"><a href="/">News<span>Sphere</span></a></div>
          <p>XML Sitemap — all indexable URLs for this site</p>
          <div class="stat">
            <xsl:value-of select="count(sm:urlset/sm:url)"/>&#160;URLs
          </div>
        </header>

        <main>
          <!-- Static pages section -->
          <div class="section-hd">Static pages</div>
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Last modified</th>
                <th>Frequency</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sm:urlset/sm:url[not(contains(sm:loc,'/news/'))]">
                <xsl:sort select="sm:priority" data-type="number" order="descending"/>
                <tr>
                  <td>
                    <a href="{sm:loc}" target="_blank" rel="noopener">
                      <xsl:value-of select="sm:loc"/>
                    </a>
                  </td>
                  <td><xsl:value-of select="sm:lastmod"/></td>
                  <td>
                    <span>
                      <xsl:attribute name="class">
                        pill freq-<xsl:value-of select="sm:changefreq"/>
                      </xsl:attribute>
                      <xsl:value-of select="sm:changefreq"/>
                    </span>
                  </td>
                  <td>
                    <span>
                      <xsl:attribute name="class">
                        <xsl:choose>
                          <xsl:when test="sm:priority >= 0.8">pri-hi</xsl:when>
                          <xsl:when test="sm:priority >= 0.5">pri-md</xsl:when>
                          <xsl:otherwise>pri-lo</xsl:otherwise>
                        </xsl:choose>
                      </xsl:attribute>
                      <xsl:value-of select="sm:priority"/>
                    </span>
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>

          <!-- Article pages section -->
          <div class="section-hd">
            News articles (
            <xsl:value-of select="count(sm:urlset/sm:url[contains(sm:loc,'/news/')])"/>
            )
          </div>
          <table>
            <thead>
              <tr>
                <th>Article URL</th>
                <th>Published</th>
                <th>Frequency</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sm:urlset/sm:url[contains(sm:loc,'/news/')]">
                <tr>
                  <td>
                    <a href="{sm:loc}" target="_blank" rel="noopener">
                      <xsl:value-of select="sm:loc"/>
                    </a>
                  </td>
                  <td><xsl:value-of select="sm:lastmod"/></td>
                  <td>
                    <span>
                      <xsl:attribute name="class">
                        pill freq-<xsl:value-of select="sm:changefreq"/>
                      </xsl:attribute>
                      <xsl:value-of select="sm:changefreq"/>
                    </span>
                  </td>
                  <td>
                    <span>
                      <xsl:attribute name="class">
                        <xsl:choose>
                          <xsl:when test="sm:priority >= 0.8">pri-hi</xsl:when>
                          <xsl:when test="sm:priority >= 0.5">pri-md</xsl:when>
                          <xsl:otherwise>pri-lo</xsl:otherwise>
                        </xsl:choose>
                      </xsl:attribute>
                      <xsl:value-of select="sm:priority"/>
                    </span>
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </main>

        <footer>
          <a href="/">← Back to NewsSphere</a>
          &#160;·&#160; Generated fresh on every request
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
