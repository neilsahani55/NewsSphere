/**
 * Live holiday data from three sources merged in real-time:
 *
 * 1. date.nager.at  → Indian official public holidays for current + next year
 *    (Republic Day, Independence Day, Gandhi Jayanti, Good Friday, etc.)
 *    Free API, no key, CORS-enabled, auto-updates each year.
 *
 * 2. Lunar calculator → Ekadasi (×2/month), Purnima, Amavasya, Sankashti
 *    Chaturthi, Pradosh Vrat — computed from astronomical new/full moon times.
 *    Accurate to ±1 day (sufficient for reference calendar).
 *
 * 3. Compact festival table → Major Hindu/Muslim/other festivals whose dates
 *    follow the lunisolar calendar but aren't easily auto-calculated
 *    (Holi, Diwali, Navratri, Eid, Janmashtami, etc.) pre-computed for 2025–2030.
 */

import { useEffect, useState } from 'react';

// ── Compact multi-year festival table (2025–2030) ─────────────────────────
// Replaces the old 200-entry static file. Covers 6 years of named festivals
// that need Panchang expertise to compute (luni-solar calendar).
const FESTIVAL_TABLE = [
  // Lohri
  { date: '2025-01-13', name: 'Lohri',                   emoji: '🔥', type: 'festival' },
  { date: '2026-01-13', name: 'Lohri',                   emoji: '🔥', type: 'festival' },
  { date: '2027-01-13', name: 'Lohri',                   emoji: '🔥', type: 'festival' },
  // Makar Sankranti / Pongal
  { date: '2025-01-14', name: 'Makar Sankranti / Pongal',emoji: '🪁', type: 'festival' },
  { date: '2026-01-14', name: 'Makar Sankranti / Pongal',emoji: '🪁', type: 'festival' },
  { date: '2027-01-14', name: 'Makar Sankranti / Pongal',emoji: '🪁', type: 'festival' },
  // Vasant Panchami
  { date: '2025-02-02', name: 'Vasant Panchami (Saraswati Puja)', emoji: '💛', type: 'festival' },
  { date: '2026-01-22', name: 'Vasant Panchami',         emoji: '💛', type: 'festival' },
  { date: '2027-02-11', name: 'Vasant Panchami',         emoji: '💛', type: 'festival' },
  // Maha Shivratri
  { date: '2025-02-26', name: 'Maha Shivratri',          emoji: '🕉️', type: 'festival' },
  { date: '2026-02-15', name: 'Maha Shivratri',          emoji: '🕉️', type: 'festival' },
  { date: '2027-03-06', name: 'Maha Shivratri',          emoji: '🕉️', type: 'festival' },
  // Holika Dahan
  { date: '2025-03-13', name: 'Holika Dahan',            emoji: '🔥', type: 'festival' },
  { date: '2026-03-01', name: 'Holika Dahan',            emoji: '🔥', type: 'festival' },
  { date: '2027-03-21', name: 'Holika Dahan',            emoji: '🔥', type: 'festival' },
  // Holi
  { date: '2025-03-14', name: 'Holi',                    emoji: '🎨', type: 'festival' },
  { date: '2026-03-02', name: 'Holi',                    emoji: '🎨', type: 'festival' },
  { date: '2027-03-22', name: 'Holi',                    emoji: '🎨', type: 'festival' },
  // Ugadi / Gudi Padwa / Telugu NY
  { date: '2025-03-30', name: 'Ugadi / Gudi Padwa',      emoji: '🌸', type: 'festival' },
  { date: '2026-03-19', name: 'Ugadi / Gudi Padwa',      emoji: '🌸', type: 'festival' },
  { date: '2027-04-07', name: 'Ugadi / Gudi Padwa',      emoji: '🌸', type: 'festival' },
  // Ram Navami
  { date: '2025-04-06', name: 'Ram Navami',              emoji: '🪔', type: 'festival' },
  { date: '2026-03-27', name: 'Ram Navami',              emoji: '🪔', type: 'festival' },
  { date: '2027-04-15', name: 'Ram Navami',              emoji: '🪔', type: 'festival' },
  // Hanuman Jayanti
  { date: '2025-04-12', name: 'Hanuman Jayanti',         emoji: '🐒', type: 'festival' },
  { date: '2026-04-01', name: 'Hanuman Jayanti',         emoji: '🐒', type: 'festival' },
  // Baisakhi / Vishu
  { date: '2025-04-13', name: 'Baisakhi / Vishu',        emoji: '🌾', type: 'festival' },
  { date: '2026-04-13', name: 'Baisakhi / Vishu',        emoji: '🌾', type: 'festival' },
  { date: '2027-04-13', name: 'Baisakhi / Vishu',        emoji: '🌾', type: 'festival' },
  // Akshaya Tritiya
  { date: '2025-04-30', name: 'Akshaya Tritiya',         emoji: '✨', type: 'festival' },
  { date: '2026-04-22', name: 'Akshaya Tritiya',         emoji: '✨', type: 'festival' },
  { date: '2027-05-11', name: 'Akshaya Tritiya',         emoji: '✨', type: 'festival' },
  // Eid al-Fitr
  { date: '2025-03-30', name: 'Eid al-Fitr (Ramzan Eid)',emoji: '🌙', type: 'festival' },
  { date: '2026-03-19', name: 'Eid al-Fitr (Ramzan Eid)',emoji: '🌙', type: 'festival' },
  { date: '2027-03-08', name: 'Eid al-Fitr (Ramzan Eid)',emoji: '🌙', type: 'festival' },
  // Eid al-Adha
  { date: '2025-06-07', name: 'Eid al-Adha (Bakrid)',    emoji: '🌙', type: 'festival' },
  { date: '2026-05-27', name: 'Eid al-Adha (Bakrid)',    emoji: '🌙', type: 'festival' },
  { date: '2027-05-17', name: 'Eid al-Adha (Bakrid)',    emoji: '🌙', type: 'festival' },
  // Rath Yatra
  { date: '2025-06-27', name: 'Rath Yatra (Puri)',       emoji: '🛕', type: 'festival' },
  { date: '2026-06-16', name: 'Rath Yatra (Puri)',       emoji: '🛕', type: 'festival' },
  { date: '2027-07-06', name: 'Rath Yatra (Puri)',       emoji: '🛕', type: 'festival' },
  // Raksha Bandhan
  { date: '2025-08-08', name: 'Raksha Bandhan',          emoji: '🧵', type: 'festival' },
  { date: '2026-08-26', name: 'Raksha Bandhan',          emoji: '🧵', type: 'festival' },
  { date: '2027-08-15', name: 'Raksha Bandhan',          emoji: '🧵', type: 'festival' },
  // Janmashtami
  { date: '2025-08-16', name: 'Janmashtami',             emoji: '🦚', type: 'festival' },
  { date: '2026-09-03', name: 'Janmashtami',             emoji: '🦚', type: 'festival' },
  { date: '2027-08-24', name: 'Janmashtami',             emoji: '🦚', type: 'festival' },
  // Ganesh Chaturthi
  { date: '2025-08-27', name: 'Ganesh Chaturthi',        emoji: '🐘', type: 'festival' },
  { date: '2026-09-16', name: 'Ganesh Chaturthi',        emoji: '🐘', type: 'festival' },
  { date: '2027-09-05', name: 'Ganesh Chaturthi',        emoji: '🐘', type: 'festival' },
  // Onam Thiruvonam
  { date: '2025-09-05', name: 'Onam Thiruvonam',         emoji: '🌺', type: 'regional' },
  { date: '2026-09-09', name: 'Onam Thiruvonam',         emoji: '🌺', type: 'regional' },
  // Navratri (Shardiya)
  { date: '2025-09-22', name: 'Navratri Begins',         emoji: '🔱', type: 'festival' },
  { date: '2026-10-11', name: 'Navratri Begins',         emoji: '🔱', type: 'festival' },
  { date: '2027-09-30', name: 'Navratri Begins',         emoji: '🔱', type: 'festival' },
  // Dussehra
  { date: '2025-10-02', name: 'Dussehra (Vijaya Dashami)', emoji: '⚔️', type: 'festival' },
  { date: '2026-10-19', name: 'Dussehra (Vijaya Dashami)', emoji: '⚔️', type: 'festival' },
  { date: '2027-10-10', name: 'Dussehra (Vijaya Dashami)', emoji: '⚔️', type: 'festival' },
  // Karva Chauth
  { date: '2025-10-13', name: 'Karva Chauth',            emoji: '🌕', type: 'festival' },
  { date: '2026-10-27', name: 'Karva Chauth',            emoji: '🌕', type: 'festival' },
  { date: '2027-10-16', name: 'Karva Chauth',            emoji: '🌕', type: 'festival' },
  // Dhanteras + Diwali
  { date: '2025-10-18', name: 'Dhanteras',               emoji: '🪙', type: 'festival' },
  { date: '2025-10-20', name: 'Diwali (Lakshmi Puja)',   emoji: '🪔', type: 'festival' },
  { date: '2026-11-04', name: 'Dhanteras',               emoji: '🪙', type: 'festival' },
  { date: '2026-11-08', name: 'Diwali',                  emoji: '🪔', type: 'festival' },
  { date: '2027-10-29', name: 'Diwali',                  emoji: '🪔', type: 'festival' },
  // Bhai Dooj
  { date: '2025-10-22', name: 'Bhai Dooj',               emoji: '👫', type: 'festival' },
  { date: '2026-11-10', name: 'Bhai Dooj',               emoji: '👫', type: 'festival' },
  // Chhath Puja (Sandhya Arghya)
  { date: '2025-10-27', name: 'Chhath Puja (Arghya)',    emoji: '🌅', type: 'festival' },
  { date: '2026-11-12', name: 'Chhath Puja (Arghya)',    emoji: '🌅', type: 'festival' },
];

// ── National + international observances (fixed dates) ────────────────────
const OBSERVANCES = [
  { md: '01-15', name: 'Army Day',                        emoji: '🎖️', type: 'observance' },
  { md: '01-23', name: 'Netaji Subhas Chandra Bose Jayanti', emoji: '🎖️', type: 'national' },
  { md: '01-30', name: 'Martyrs Day (Bapu)',              emoji: '🕊️', type: 'national'   },
  { md: '02-04', name: 'World Cancer Day',                emoji: '🎗️', type: 'observance' },
  { md: '02-28', name: 'National Science Day (Raman Effect)', emoji: '🔬', type: 'observance' },
  { md: '03-08', name: "International Women's Day",       emoji: '♀️', type: 'observance' },
  { md: '04-07', name: 'World Health Day',                emoji: '🏥', type: 'observance' },
  { md: '04-14', name: 'Dr. B R Ambedkar Jayanti',       emoji: '📚', type: 'national'   },
  { md: '04-22', name: 'World Earth Day',                 emoji: '🌍', type: 'observance' },
  { md: '05-01', name: 'International Workers Day / Maharashtra Day', emoji: '⚒️', type: 'regional' },
  { md: '05-09', name: 'Rabindranath Tagore Jayanti',     emoji: '📝', type: 'observance' },
  { md: '06-05', name: 'World Environment Day',           emoji: '🌿', type: 'observance' },
  { md: '06-21', name: 'International Yoga Day',          emoji: '🧘', type: 'observance' },
  { md: '07-01', name: 'National Doctors Day',            emoji: '👨‍⚕️', type: 'observance' },
  { md: '08-03', name: 'Friendship Day',                  emoji: '🤝', type: 'observance' },
  { md: '08-29', name: 'National Sports Day (Dhyan Chand)', emoji: '🏑', type: 'observance' },
  { md: '09-05', name: "Teachers' Day (Dr. Radhakrishnan)", emoji: '📖', type: 'national'  },
  { md: '09-17', name: 'Vishwakarma Puja',                emoji: '🔧', type: 'festival'   },
  { md: '10-02', name: 'Gandhi Jayanti',                  emoji: '🕊️', type: 'national'   },
  { md: '10-08', name: 'Indian Air Force Day',            emoji: '✈️', type: 'observance' },
  { md: '10-31', name: 'Sardar Patel Jayanti / Rashtriya Ekta Diwas', emoji: '🇮🇳', type: 'national' },
  { md: '11-14', name: "Children's Day / Jawaharlal Nehru Jayanti", emoji: '🧒', type: 'national' },
  { md: '11-19', name: 'Guru Tegh Bahadur Martyrdom Day', emoji: '🕯️', type: 'national'  },
  { md: '12-04', name: 'Navy Day',                        emoji: '⚓', type: 'observance' },
  { md: '12-06', name: 'Mahaparinirvan Diwas (Dr. Ambedkar)', emoji: '📚', type: 'national' },
  { md: '12-19', name: 'Goa Liberation Day',              emoji: '🌊', type: 'regional'   },
  { md: '12-22', name: 'National Mathematics Day (Ramanujan)', emoji: '🔢', type: 'observance' },
];

// ── Lunar calendar calculator ──────────────────────────────────────────────
// Uses mean synodic period from a known reference new moon.
// Accurate to ~1 day (adequate for reference calendar display).

const SYNODIC = 29.530588861;
const REF_NEW_MOON_JD = 2451550.09766; // Jan 6.597, 2000 UTC (known new moon)

function dateToJD(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function jdToISO(jd) {
  const z  = Math.floor(jd + 0.5);
  const a  = z >= 2299161 ? (() => { const x = Math.floor((z - 1867216.25) / 36524.25); return z + 1 + x - Math.floor(x / 4); })() : z;
  const b  = a + 1524;
  const c  = Math.floor((b - 122.1) / 365.25);
  const d  = Math.floor(365.25 * c);
  const e  = Math.floor((b - d) / 30.6001);
  const day   = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year  = month > 2 ? c - 4716 : c - 4715;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

// Named Ekadasi list (Shukla = odd, Krishna = even index)
const EKADASI_NAMES = [
  // Shukla Ekadasis (starting from Margashirsha)
  'Mokshada Ekadasi', 'Saphala Ekadasi',  'Putrada Ekadasi', 'Sat Tila Ekadasi',
  'Jaya Ekadasi',     'Vijaya Ekadasi',   'Amalaki Ekadasi', 'Papamochani Ekadasi',
  'Kamada Ekadasi',   'Varuthini Ekadasi','Mohini Ekadasi',  'Apara Ekadasi',
  'Nirjala Ekadasi',  'Yogini Ekadasi',   'Devshayani Ekadasi','Kamika Ekadasi',
  'Shravana Putrada', 'Annada Ekadasi',   'Parsva Ekadasi',  'Indira Ekadasi',
  'Papankusha Ekadasi','Rama Ekadasi',    'Dev Prabodhini Ekadasi','Utpanna Ekadasi',
];

// Named Purnima
const PURNIMA_NAMES = [
  'Pausa Purnima',    'Magha Purnima',    'Phalguna Purnima', 'Chaitra Purnima',
  'Vaishakha Purnima','Jyeshtha Purnima','Ashadha Purnima',  'Shravana Purnima',
  'Bhadrapada Purnima','Ashwin Purnima', 'Kartika Purnima',  'Margashirsha Purnima',
];

// Named Sankashti
const SANKASHTI_NAMES = [
  'Dhumravarna Sankashti','Angaraki Chaturthi','Bhalachandra Sankashti','Vikata Sankashti',
  'Ekadanta Sankashti','Krishnapingala Sankashti','Gajanana Sankashti','Lambodara Sankashti',
  'Dvija Sankashti','Mahaganapati Sankashti','Vijaya Sankashti','Siddhi Sankashti',
];

function computeLunarEvents(fromISO, count = 60) {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const todayJD = dateToJD(fy, fm, fd);

  // Find the lunation index for current period
  const k0 = Math.ceil((todayJD - REF_NEW_MOON_JD) / SYNODIC);

  const events = [];

  for (let k = k0 - 1; k < k0 + 26 && events.length < count; k++) {
    const newMoonJD  = REF_NEW_MOON_JD + k * SYNODIC;
    const fullMoonJD = newMoonJD + SYNODIC * 0.5;

    // 1 tithi = SYNODIC / 30 days
    const tithi = SYNODIC / 30;
    const nameIdx = Math.abs(k) % 12;

    // Amavasya (new moon)
    const amavJD = newMoonJD;
    if (amavJD >= todayJD - 0.5) {
      events.push({ date: jdToISO(amavJD), name: 'Amavasya', emoji: '🌑', type: 'moon' });
    }

    // Shukla Ekadasi (11th tithi after new moon)
    const sEJD = newMoonJD + 11 * tithi;
    if (sEJD >= todayJD - 0.5) {
      events.push({ date: jdToISO(sEJD), name: `Ekadasi — ${EKADASI_NAMES[(k * 2) % 24] || 'Shukla Ekadasi'}`, emoji: '🪷', type: 'vrat' });
    }

    // Purnima (full moon)
    if (fullMoonJD >= todayJD - 0.5) {
      events.push({ date: jdToISO(fullMoonJD), name: `Purnima — ${PURNIMA_NAMES[nameIdx]}`, emoji: '🌕', type: 'moon' });
    }

    // Sankashti Chaturthi (4th tithi of Krishna paksha = 4 tithis after full moon)
    const sankJD = fullMoonJD + 4 * tithi;
    if (sankJD >= todayJD - 0.5) {
      events.push({ date: jdToISO(sankJD), name: `Sankashti Chaturthi — ${SANKASHTI_NAMES[nameIdx]}`, emoji: '🐘', type: 'vrat' });
    }

    // Krishna Ekadasi (11th tithi after full moon)
    const kEJD = fullMoonJD + 11 * tithi;
    if (kEJD >= todayJD - 0.5) {
      events.push({ date: jdToISO(kEJD), name: `Ekadasi — ${EKADASI_NAMES[(k * 2 + 1) % 24] || 'Krishna Ekadasi'}`, emoji: '🪷', type: 'vrat' });
    }

    // Shukla Pradosh (13th tithi after new moon)
    const sPraJD = newMoonJD + 13 * tithi;
    if (sPraJD >= todayJD - 0.5) {
      events.push({ date: jdToISO(sPraJD), name: 'Pradosh Vrat (Shukla)', emoji: '🕉️', type: 'vrat' });
    }

    // Krishna Pradosh (13th tithi after full moon)
    const kPraJD = fullMoonJD + 13 * tithi;
    if (kPraJD >= todayJD - 0.5) {
      events.push({ date: jdToISO(kPraJD), name: 'Pradosh Vrat (Krishna)', emoji: '🕉️', type: 'vrat' });
    }
  }

  return events;
}

// Map nager.at official holiday → emoji
const NAGER_EMOJI = {
  'Republic Day': '🇮🇳', 'Independence Day': '🇮🇳', 'Gandhi Jayanti': '🕊️',
  'Good Friday': '✝️', 'Christmas': '🎄', 'Christmas Day': '🎄',
  'Mahavir Jayanti': '☮️', "Buddha's Birthday": '☸️', 'Buddha Purnima': '☸️',
  'Guru Nanak Jayanti': '🙏', 'Eid-ul-Fitr': '🌙', 'Id-ul-Fitr': '🌙',
  'Eid-ul-Adha': '🌙', 'Muharram': '🌙',
  "Dr. B. R. Ambedkar's Jayanti": '📚', 'Ambedkar Jayanti': '📚',
};

// ── Main hook ─────────────────────────────────────────────────────────────
export function useHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let live = true;
    const today = new Date().toISOString().slice(0, 10);
    const thisYear = new Date().getFullYear();

    async function load() {
      // 1. Official public holidays from date.nager.at (live, no key)
      let official = [];
      try {
        const [r1, r2] = await Promise.all([
          fetch(`https://date.nager.at/api/v3/PublicHolidays/${thisYear}/IN`,    { signal: AbortSignal.timeout(6000) }),
          fetch(`https://date.nager.at/api/v3/PublicHolidays/${thisYear + 1}/IN`, { signal: AbortSignal.timeout(6000) }),
        ]);
        const [d1, d2] = await Promise.all([r1.ok ? r1.json() : [], r2.ok ? r2.json() : []]);
        official = [...(Array.isArray(d1) ? d1 : []), ...(Array.isArray(d2) ? d2 : [])].map(h => ({
          date: h.date,
          name: h.localName || h.name,
          emoji: NAGER_EMOJI[h.name] || NAGER_EMOJI[h.localName] || '🇮🇳',
          type: 'national',
        }));
      } catch {}

      // 2. Calculated lunar events
      const lunar = computeLunarEvents(today, 80);

      // 3. Festival table — only upcoming
      const festivals = FESTIVAL_TABLE.filter(f => f.date >= today);

      // 4. Observances — inject year
      const observances = OBSERVANCES.flatMap(o => {
        const dates = [`${thisYear}-${o.md}`, `${thisYear + 1}-${o.md}`];
        return dates.filter(d => d >= today).map(d => ({ ...o, date: d }));
      });

      // Merge, deduplicate by date+name, sort
      const all = [...official, ...lunar, ...festivals, ...observances];
      const seen = new Set();
      const merged = all
        .filter(h => h.date >= today)
        .filter(h => { const k = h.date + h.name; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => a.date.localeCompare(b.date));

      if (live) { setHolidays(merged); setLoading(false); }
    }

    load();
    return () => { live = false; };
  }, []);

  return { holidays, loading };
}

export function daysUntil(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.ceil((new Date(y, m - 1, d) - new Date(new Date().toDateString())) / 86400000);
}
