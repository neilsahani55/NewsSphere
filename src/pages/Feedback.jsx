import { useState } from 'react';

const FORMSPREE_ID = import.meta.env.VITE_FORMSPREE_ID;

export default function Feedback() {
  const [type, setType] = useState('Feedback');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!FORMSPREE_ID) { setStatus('error'); return; }
    setStatus('sending');
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ type, name, email, message }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="fb-sent">
        <div className="fb-sent-icon" aria-hidden>✓</div>
        <h2>Thank you!</h2>
        <p>Your {type.toLowerCase()} has been received. We'll get back to you if needed.</p>
        <button className="fb-again" onClick={() => { setStatus('idle'); setMessage(''); setName(''); setEmail(''); }}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="fb-layout">
      {/* Left — brand panel */}
      <aside className="fb-brand">
        <div className="fb-brand-logo" aria-hidden>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="var(--accent)" />
            <path d="M8 12h24M8 20h16M8 28h20" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="fb-brand-name">NewsSphere</h1>
        <p className="fb-brand-tag">News intelligence beyond the headline</p>
        <ul className="fb-brand-list">
          <li>
            <span className="fb-brand-icon">💬</span>
            <span><strong>Feedback</strong> — help us improve the reading experience</span>
          </li>
          <li>
            <span className="fb-brand-icon">💡</span>
            <span><strong>Suggestions</strong> — request topics, sources, or features</span>
          </li>
          <li>
            <span className="fb-brand-icon">⚠️</span>
            <span><strong>Complaints</strong> — report inaccurate content or broken features</span>
          </li>
        </ul>
        <div className="fb-brand-contact">
          <p className="fb-brand-contact-lbl">Or reach us directly</p>
          <a href="mailto:grievance@newssphere.in" className="fb-brand-email">grievance@newssphere.in</a>
        </div>
      </aside>

      {/* Right — form */}
      <div className="fb-wrap">
        <div className="fb-hdr">
          <h2 className="fb-title">Share your thoughts</h2>
          <p className="fb-sub">Your feedback goes directly to the team. We read every message.</p>
        </div>

        <form className="fb-form" onSubmit={handleSubmit}>
          <div className="fb-type-row">
            {['Feedback', 'Suggestion', 'Complaint'].map(t => (
              <button
                key={t}
                type="button"
                className={`fb-type-btn${type === t ? ' on' : ''}`}
                onClick={() => setType(t)}
              >
                {t === 'Feedback' && '💬 '}
                {t === 'Suggestion' && '💡 '}
                {t === 'Complaint' && '⚠️ '}
                {t}
              </button>
            ))}
          </div>

          <div className="fb-row">
            <label className="fb-label" htmlFor="fb-name">Your name <span className="fb-opt">(optional)</span></label>
            <input id="fb-name" className="fb-input" type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} maxLength={100} />
          </div>

          <div className="fb-row">
            <label className="fb-label" htmlFor="fb-email">Email <span className="fb-opt">(so we can reply)</span></label>
            <input id="fb-email" className="fb-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} maxLength={200} />
          </div>

          <div className="fb-row">
            <label className="fb-label" htmlFor="fb-msg">Message <span className="fb-req">*</span></label>
            <textarea
              id="fb-msg"
              className="fb-textarea"
              placeholder={`Write your ${type.toLowerCase()} here…`}
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              minLength={10}
              maxLength={2000}
              rows={6}
            />
            <span className="fb-char">{message.length}/2000</span>
          </div>

          {status === 'error' && !FORMSPREE_ID && (
            <div className="fb-err">
              Feedback is not configured yet. Please contact us at <strong>grievance@newssphere.in</strong> directly.
            </div>
          )}
          {status === 'error' && FORMSPREE_ID && (
            <div className="fb-err">Something went wrong. Please try again or email us directly.</div>
          )}

          <button
            type="submit"
            className="fb-submit"
            disabled={status === 'sending' || !message.trim()}
          >
            {status === 'sending' ? 'Sending…' : `Send ${type}`}
          </button>
        </form>
      </div>
    </div>
  );
}
