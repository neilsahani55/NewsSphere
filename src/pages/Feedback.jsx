import { useState } from 'react';
import { useUIStrings } from '../hooks/useUIStrings.js';

const FORMSPREE_ID = import.meta.env.VITE_FORMSPREE_ID;

const FB_STRINGS = {
  tagline: 'News intelligence beyond the headline',
  feat1title: 'Feedback',    feat1desc: 'help us improve the reading experience',
  feat2title: 'Suggestions', feat2desc: 'request topics, sources, or features',
  feat3title: 'Complaints',  feat3desc: 'report inaccurate content or broken features',
  orReach: 'Or reach us directly',
  formTitle: 'Share your thoughts',
  formSub: 'Your feedback goes directly to the team. We read every message.',
  typeFeedback: 'Feedback', typeSuggestion: 'Suggestion', typeComplaint: 'Complaint',
  nameLabel: 'Your name', nameOpt: '(optional)', namePlaceholder: 'John Doe',
  emailLabel: 'Email', emailOpt: '(so we can reply)', emailPlaceholder: 'you@example.com',
  msgLabel: 'Message',
  thankYou: 'Thank you!',
  received: 'has been received. We\'ll get back to you if needed.',
  sendAnother: 'Send another',
  sending: 'Sending…',
};

export default function Feedback({ target }) {
  const t = useUIStrings(FB_STRINGS, target);
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
        body: JSON.stringify({ type, name, email, message, _cc: 'newssphere55@gmail.com' }),
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
        <h2>{t.thankYou}</h2>
        <p>Your {type.toLowerCase()} {t.received}</p>
        <button className="fb-again" onClick={() => { setStatus('idle'); setMessage(''); setName(''); setEmail(''); }}>
          {t.sendAnother}
        </button>
      </div>
    );
  }

  return (
    <div className="fb-layout">
      {/* Left — brand panel */}
      <aside className="fb-brand">
        <div className="fb-brand-logo" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
            <circle cx="16" cy="16" r="15" fill="#1a3c6e"/>
            <ellipse cx="16" cy="16" rx="15" ry="5.5" fill="none" stroke="#5d7ba8" strokeWidth="0.9" opacity="0.9"/>
            <path d="M10.5 22 V10.5 L21.5 22 V10.5" stroke="#f5f4f0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="25.5" cy="7" r="2.6" fill="#d4a847"/>
          </svg>
        </div>
        <h1 className="fb-brand-name">NewsSphere<span className="fb-brand-dot" aria-hidden /></h1>
        <p className="fb-brand-tag">{t.tagline}</p>
        <ul className="fb-brand-list">
          <li>
            <span className="fb-brand-icon">💬</span>
            <span><strong>{t.typeFeedback}</strong> — {t.feat1desc}</span>
          </li>
          <li>
            <span className="fb-brand-icon">💡</span>
            <span><strong>{t.feat2title}</strong> — {t.feat2desc}</span>
          </li>
          <li>
            <span className="fb-brand-icon">⚠️</span>
            <span><strong>{t.feat3title}</strong> — {t.feat3desc}</span>
          </li>
        </ul>
        <div className="fb-brand-contact">
          <p className="fb-brand-contact-lbl">{t.orReach}</p>
          <a href="mailto:newssphere55@gmail.com" className="fb-brand-email">newssphere55@gmail.com</a>
        </div>
      </aside>

      {/* Right — form */}
      <div className="fb-wrap">
        {/* Compact brand header — visible only on mobile (desktop shows the aside panel) */}
        <div className="fb-mobile-hdr" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="30" height="30">
            <circle cx="16" cy="16" r="15" fill="#1a3c6e"/>
            <ellipse cx="16" cy="16" rx="15" ry="5.5" fill="none" stroke="#5d7ba8" strokeWidth="0.9" opacity="0.9"/>
            <path d="M10.5 22 V10.5 L21.5 22 V10.5" stroke="#f5f4f0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="25.5" cy="7" r="2.6" fill="#d4a847"/>
          </svg>
          <span className="fb-mobile-brand">NewsSphere<span className="fb-brand-dot" aria-hidden /></span>
        </div>

        <div className="fb-hdr">
          <h2 className="fb-title">{t.formTitle}</h2>
          <p className="fb-sub">{t.formSub}</p>
        </div>

        <form className="fb-form" onSubmit={handleSubmit}>
          <div className="fb-type-row">
            {[
              { key: 'Feedback',   label: t.typeFeedback,   icon: '💬 ' },
              { key: 'Suggestion', label: t.typeSuggestion, icon: '💡 ' },
              { key: 'Complaint',  label: t.typeComplaint,  icon: '⚠️ ' },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                className={`fb-type-btn${type === key ? ' on' : ''}`}
                onClick={() => setType(key)}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          <div className="fb-row">
            <label className="fb-label" htmlFor="fb-name">{t.nameLabel} <span className="fb-opt">{t.nameOpt}</span></label>
            <input id="fb-name" className="fb-input" type="text" placeholder={t.namePlaceholder} value={name} onChange={e => setName(e.target.value)} maxLength={100} />
          </div>

          <div className="fb-row">
            <label className="fb-label" htmlFor="fb-email">{t.emailLabel} <span className="fb-opt">{t.emailOpt}</span></label>
            <input id="fb-email" className="fb-input" type="email" placeholder={t.emailPlaceholder} value={email} onChange={e => setEmail(e.target.value)} maxLength={200} />
          </div>

          <div className="fb-row">
            <label className="fb-label" htmlFor="fb-msg">{t.msgLabel} <span className="fb-req">*</span></label>
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
              Feedback is not configured yet. Please contact us at <strong>newssphere55@gmail.com</strong> directly.
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
            {status === 'sending' ? t.sending : `Send ${type}`}
          </button>
        </form>
      </div>
    </div>
  );
}
