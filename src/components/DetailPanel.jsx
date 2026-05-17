import { useEffect, useMemo, useRef, useState } from 'react';
import { sentimentLabel, toneFor, topicsOf } from '../utils/categories.js';
import { formatDate, parseKeyPoints, stripHtml } from '../utils/format.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { useSwipe } from '../hooks/useSwipe.js';
import { slugify } from '../utils/slug.js';
import OsintPanel from './OsintPanel.jsx';
import { fetchArticleContent } from '../services/supabaseService.js';

// BCP-47 language tags for Web Speech API
const LANG_BCP47 = {
  'en': 'en-US', 'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN',
  'bn': 'bn-IN', 'mr': 'mr-IN', 'gu': 'gu-IN', 'kn': 'kn-IN',
  'ml': 'ml-IN', 'pa': 'pa-IN', 'ur': 'ur-PK', 'ar': 'ar-SA',
  'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE', 'zh-CN': 'zh-CN',
};

// 2-letter prefix used to filter voices list (e.g. 'hi' matches 'hi-IN')
const LANG_PREFIX = {
  'en': 'en', 'hi': 'hi', 'ta': 'ta', 'te': 'te',
  'bn': 'bn', 'mr': 'mr', 'gu': 'gu', 'kn': 'kn',
  'ml': 'ml', 'pa': 'pa', 'ur': 'ur', 'ar': 'ar',
  'es': 'es', 'fr': 'fr', 'de': 'de', 'zh-CN': 'zh',
};

function getWordRange(boundary, offset, textLen) {
  if (!boundary) return null;
  const s = boundary.start - offset;
  const e = boundary.end - offset;
  if (e <= 0 || s >= textLen) return null;
  return { start: Math.max(0, s), end: Math.min(textLen, e) };
}

function HighlightedText({ text, range }) {
  if (!range) return <>{text}</>;
  return (
    <>
      {text.slice(0, range.start)}
      <mark className="tts-hl">{text.slice(range.start, range.end)}</mark>
      {text.slice(range.end)}
    </>
  );
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export default function DetailPanel({
  article,
  bookmarked,
  onToggleBookmark,
  target,
  allArticles,
  onSelectArticle,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  position,
}) {
  const [imgFailed, setImgFailed]           = useState(false);
  const [copied, setCopied]                 = useState(false);
  const [speaking, setSpeaking]             = useState(false);
  const [wordBoundary, setWordBoundary]     = useState(null);
  const [rate, setRate]                     = useState(1);
  const [voices, setVoices]                 = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [showTTSCtrl, setShowTTSCtrl]       = useState(false);

  const panelRef     = useRef(null);
  const timerRef     = useRef(null);   // fallback word-advance timer
  // Cache fetched content so re-opening the same article is instant
  const contentCache = useRef(new Map()); // id → content string
  const [fetchedContent, setFetchedContent] = useState(null);

  // Merge lazily-fetched content so useTranslation sees it
  const articleWithContent = useMemo(() => {
    if (!article) return null;
    if (article.content) return article;
    const cached = contentCache.current.get(article.id);
    if (cached) return { ...article, content: cached };
    if (fetchedContent) return { ...article, content: fetchedContent };
    return article;
  }, [article, fetchedContent]);

  const { translated, loading, error } = useTranslation(articleWithContent, target);

  useSwipe(panelRef, {
    onLeft:  hasNext ? onNext : undefined,
    onRight: hasPrev ? onPrev : undefined,
  });

  // Load available voices (async in most browsers)
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis?.getVoices() ?? []);
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  // Stop speech + timer when article or language changes
  useEffect(() => {
    window.speechSynthesis?.cancel();
    clearTimeout(timerRef.current);
    setSpeaking(false);
    setWordBoundary(null);
  }, [article?.article_url, target]);

  useEffect(() => { setImgFailed(false); }, [article?.article_url]);

  // Lazy-fetch content the first time an article is opened.
  // Content was excluded from the initial bulk fetch to keep payload small.
  useEffect(() => {
    if (!article?.id || article.content) { setFetchedContent(null); return; }
    if (contentCache.current.has(article.id)) { setFetchedContent(contentCache.current.get(article.id)); return; }
    let cancelled = false;
    fetchArticleContent(article.id).then(text => {
      if (cancelled) return;
      contentCache.current.set(article.id, text);
      setFetchedContent(text);
    });
    return () => { cancelled = true; };
  }, [article?.id, article?.content]);

  // Cancel speech + timer on unmount
  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    clearTimeout(timerRef.current);
  }, []);

  // ── Build view ──────────────────────────────────────────────────────────
  const view = articleWithContent ? {
    title:       translated?.title       || articleWithContent.title       || '',
    description: stripHtml(translated?.description || articleWithContent.description || ''),
    content:     stripHtml(translated?.content     || articleWithContent.content     || ''),
    keyPoints:   parseKeyPoints(translated?.key_points || articleWithContent.key_points),
  } : { title: '', description: '', content: '', keyPoints: [] };

  const contentText = (view.content && view.content !== view.description) ? view.content : '';

  // Build TTS parts with character offsets for per-section highlighting
  const ttsParts = [];
  let off = 0;
  if (view.title)    { ttsParts.push({ key: 'title',   text: view.title,    offset: off }); off += view.title.length + 2; }
  if (view.description) { ttsParts.push({ key: 'desc', text: view.description, offset: off }); off += view.description.length + 2; }
  if (contentText)   { ttsParts.push({ key: 'content', text: contentText,   offset: off }); }
  const ttsText = ttsParts.map(p => p.text).join('. ').slice(0, 4000);

  // Voices for current language
  const prefix = LANG_PREFIX[target] || 'en';
  const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(prefix));
  const chosenVoice = langVoices.find(v => v.voiceURI === selectedVoiceURI) || langVoices[0] || null;

  // TTS is unavailable if the API doesn't exist, OR voices have loaded but
  // none match the current language (some devices lack non-English voices).
  const ttsUnavailable = !window.speechSynthesis
    || (voices.length > 0 && langVoices.length === 0 && target !== 'en');

  // Highlight range per section
  const getRange = (key) => {
    const part = ttsParts.find(p => p.key === key);
    return part ? getWordRange(wordBoundary, part.offset, part.text.length) : null;
  };

  // ── TTS toggle ─────────────────────────────────────────────────────────
  const toggleSpeak = () => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      clearTimeout(timerRef.current);
      setSpeaking(false);
      setWordBoundary(null);
      return;
    }

    // Snapshot the text used for this utterance so closure is stable
    const text = ttsText;

    // Build word position list for the timer-based fallback
    const words = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      words.push({ start: m.index, end: m.index + m[0].length });
    }

    // Timer-based fallback: advances one word at a time using estimated
    // character rate. onboundary overrides this when the browser supports it.
    let usingNativeBoundary = false;
    let wordIdx = 0;
    // ~13 chars/sec at 1× rate (avg ~150 wpm, ~5 chars/word)
    const charsPerMs = (13 * rate) / 1000;

    const advanceWord = () => {
      if (usingNativeBoundary || wordIdx >= words.length) return;
      setWordBoundary(words[wordIdx]);
      wordIdx++;
      if (wordIdx < words.length) {
        const gap = words[wordIdx].start - words[wordIdx - 1].start;
        timerRef.current = setTimeout(advanceWord, Math.max(80, gap / charsPerMs));
      }
    };
    // Short lead-in delay then start advancing
    timerRef.current = setTimeout(advanceWord, 250);

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = rate;
    utt.lang = LANG_BCP47[target] || 'en-US';
    if (chosenVoice) utt.voice = chosenVoice;

    utt.onboundary = (e) => {
      if (e.name !== 'word') return;
      // Native boundary works — cancel the timer fallback
      if (!usingNativeBoundary) {
        usingNativeBoundary = true;
        clearTimeout(timerRef.current);
      }
      const start = e.charIndex;
      const rest  = text.slice(start);
      const spaceAt = rest.search(/[\s.,!?;:\n]/);
      const len = (e.charLength > 0 ? e.charLength : null)
               ?? (spaceAt >= 0 ? spaceAt : rest.length);
      setWordBoundary({ start, end: start + len });
    };
    const finish = () => {
      clearTimeout(timerRef.current);
      setSpeaking(false);
      setWordBoundary(null);
    };
    utt.onend   = finish;
    utt.onerror = finish;

    window.speechSynthesis.speak(utt);
    setSpeaking(true);
  };

  const handleRateChange = (r) => {
    if (speaking) { window.speechSynthesis.cancel(); clearTimeout(timerRef.current); setSpeaking(false); setWordBoundary(null); }
    setRate(r);
  };

  const handleVoiceChange = (uri) => {
    if (speaking) { window.speechSynthesis.cancel(); clearTimeout(timerRef.current); setSpeaking(false); setWordBoundary(null); }
    setSelectedVoiceURI(uri);
  };

  // ── Share ───────────────────────────────────────────────────────────────
  const shareArticle = async () => {
    if (!article) return;
    const url = `${window.location.origin}/news/${slugify(article.title || '')}-${article.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: article.title, url }); return; }
      catch (_) { /* dismissed — fall through */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const topics    = article ? topicsOf(article.category) : [];
  const sentiment = article ? sentimentLabel(article.sentiment) : null;
  const showImage = article?.image_url && !imgFailed;

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!article) {
    return (
      <aside className="dcol" ref={panelRef}>
        <div className="dpanel">
          <div className="dphdr"><h3>Reader</h3></div>
          <div className="dph">
            <span className="big" aria-hidden>📰</span>
            Select any story from the feed to read the full analysis here.
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="dcol" ref={panelRef}>
      <div className="dpanel">

        {/* ── Header ── */}
        <div className="dphdr">
          <h3>
            Reader
            {loading && <span className="reader-busy">· translating…</span>}
            {error   && <span className="reader-err" title={error}>· translation failed</span>}
          </h3>

          <div className="dphdr-btns">
            {/* TTS settings toggle */}
            <button
              type="button"
              className={`tts-cog${showTTSCtrl ? ' on' : ''}`}
              title="TTS settings"
              aria-label="Text-to-speech settings"
              onClick={() => setShowTTSCtrl(v => !v)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>

            {/* Speak */}
            <button
              type="button"
              className={`speak-btn${speaking ? ' on' : ''}${ttsUnavailable ? ' disabled' : ''}`}
              aria-label={ttsUnavailable ? `TTS not available for this language` : speaking ? 'Stop speaking' : 'Read aloud'}
              title={ttsUnavailable ? 'No voice available for this language on your device' : speaking ? 'Stop' : 'Speak'}
              disabled={ttsUnavailable}
              onClick={toggleSpeak}
            >
              {speaking ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
              )}
              {speaking ? 'Stop' : 'Speak'}
            </button>

            {/* Save */}
            <button
              type="button"
              className={`bm-btn lg ${bookmarked ? 'on' : ''}`}
              aria-label={bookmarked ? 'Remove bookmark' : 'Save article'}
              onClick={() => onToggleBookmark(article.article_url)}
            >
              {bookmarked ? '★ Saved' : '☆ Save'}
            </button>

            {/* Share */}
            {article.id && (
              <button
                type="button"
                className={`share-btn${copied ? ' copied' : ''}`}
                title={copied ? 'Copied!' : 'Share article'}
                onClick={shareArticle}
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    Share
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── TTS controls bar ── */}
        {showTTSCtrl && (
          <div className="tts-bar">
            <div className="tts-bar-group">
              <span className="tts-bar-label">Speed</span>
              <div className="tts-speeds">
                {SPEEDS.map(r => (
                  <button
                    key={r}
                    className={`tts-speed-btn${rate === r ? ' on' : ''}`}
                    onClick={() => handleRateChange(r)}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </div>
            {langVoices.length > 0 && (
              <div className="tts-bar-group">
                <span className="tts-bar-label">Voice</span>
                <select
                  className="tts-voice-sel"
                  value={selectedVoiceURI || chosenVoice?.voiceURI || ''}
                  onChange={e => handleVoiceChange(e.target.value)}
                >
                  {langVoices.map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}
            {langVoices.length === 0 && (
              <span className="tts-bar-note">
                No {target.toUpperCase()} voices installed on this device. Language set via browser default.
              </span>
            )}
          </div>
        )}

        {/* ── Body ── */}
        <div className="dpbody">
          {showImage && (
            <img
              className="dimg"
              src={article.image_url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
            />
          )}

          <div className="dtags">
            {topics.length > 0
              ? topics.map(t => <span key={t} className={`dcat tone-${toneFor(t)}`}>{t}</span>)
              : <span className="dcat tone-neutral">News</span>}
            {sentiment && (
              <span className={`sent sent-${sentiment.tone}`}>
                {sentiment.label} · {sentiment.score.toFixed(2)}
              </span>
            )}
            {article.language && (
              <span className="lang-pill">{String(article.language).toUpperCase()}</span>
            )}
          </div>

          <h2 className="dtitle">
            <HighlightedText text={view.title || 'No headline'} range={speaking ? getRange('title') : null} />
          </h2>

          <div className="dmeta">
            <span className="dsrc">{article.source_name || 'Unknown'}</span>
            <span>{formatDate(article.published_at_ist || article.fetched_at_ist)}</span>
            {article.country && <span className="cc">{String(article.country).toUpperCase()}</span>}
          </div>

          {view.description && (
            <div className="dshort">
              <HighlightedText text={view.description} range={speaking ? getRange('desc') : null} />
            </div>
          )}

          {contentText && (
            <div className="dfull">
              <HighlightedText text={contentText} range={speaking ? getRange('content') : null} />
            </div>
          )}

          {view.keyPoints.length > 0 && (
            <div className="kpbox">
              <div className="kplabel">Key Points</div>
              <ul>{view.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}

          <OsintPanel
            article={article}
            allArticles={allArticles}
            target={target}
            onSelectArticle={onSelectArticle}
          />

          {article.article_url && (
            <a href={article.article_url} target="_blank" rel="noopener noreferrer" className="rlink">
              Read original article
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          )}

          {(hasPrev || hasNext) && (
            <nav className="dnav" aria-label="Article navigation">
              <button type="button" className="dnav-btn" onClick={onPrev} disabled={!hasPrev} aria-label="Previous story">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                <span className="dnav-label">Previous</span>
              </button>
              <button type="button" className="dnav-btn" onClick={onNext} disabled={!hasNext} aria-label="Next story">
                <span className="dnav-label">Next</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </nav>
          )}
        </div>
      </div>
    </aside>
  );
}
