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
    <div className="fb-wrap">
      <div className="fb-hdr">
        <h2 className="fb-title">Share your thoughts</h2>
        <p className="fb-sub">Help us improve NewsSphere — your feedback goes directly to the team.</p>
      </div>

      <form className="fb-form" onSubmit={handleSubmit}>
        <div className="fb-type-row">
          {['Feedback','Suggestion','Complaint'].map(t => (
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
            Feedback submission is not configured yet. Please add <code>VITE_FORMSPREE_ID</code> to your Vercel environment variables.
          </div>
        )}
        {status === 'error' && FORMSPREE_ID && (
          <div className="fb-err">Something went wrong. Please try again.</div>
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
  );
}
