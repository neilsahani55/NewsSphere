import { TRANSLATE_LANGUAGES } from '../utils/categories.js';

export default function TranslateSelector({ value, onChange, busy }) {
  return (
    <div className="tr-global">
      <svg
        className="tr-global-icon"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 8l6 6" />
        <path d="M4 14l6-6 2-3" />
        <path d="M2 5h12" />
        <path d="M7 2h1" />
        <path d="M22 22l-5-10-5 10" />
        <path d="M14 18h6" />
      </svg>
      <select
        className="tr-global-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Translate news to"
      >
        {TRANSLATE_LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>{l.label}</option>
        ))}
      </select>
      {busy > 0 && (
        <span className="tr-global-busy" title={`Translating ${busy} items`}>
          <span className="tr-spin" aria-hidden /> {busy}
        </span>
      )}
    </div>
  );
}
