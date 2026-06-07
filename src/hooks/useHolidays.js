/**
 * Holidays & Festivals — fully dynamic, zero static dates in code.
 *
 * Three sources merged every page load:
 *
 * 1. date.nager.at API  — Indian public holidays for this year + next
 *    (Republic Day, Holi, Diwali, Eid, Christmas, Good Friday, etc.)
 *    Free, no key, CORS-enabled, auto-updates every year.
 *
 * 2. Lunar calculator   — Hindu lunar vrats computed from astronomy
 *    (Ekadasi ×2/month, Purnima, Amavasya, Sankashti, Pradosh)
 *    Pure math — no network, works for any future year forever.
 *
 * 3. Calendrical rules  — All other observances computed by algorithm
 *    Fixed dates: Valentine's Day, Earth Day, Independence Day…
 *    Nth-weekday rules: Mother's Day (2nd Sun May), Father's Day (3rd Sun Jun)…
 *    Festival durations: Navratri 9 days derived from Dussehra in source 1
 *    Valentine's Week: Rose Day through Valentine's Day (Feb 7-14)
 */

import { useEffect, useState } from 'react';

// ── Helpers ────────────────────────────────────────────────────────────────

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** nth occurrence of weekday (0=Sun) in a month (month0 = 0-based) */
function nthWeekday(year, month0, weekday, n) {
  let count = 0, d = 1;
  while (true) {
    const dt = new Date(year, month0, d);
    if (dt.getDay() === weekday) { if (++count === n) return dt; }
    d++;
  }
}

/** Last occurrence of weekday in a month */
function lastWeekday(year, month0, weekday) {
  const last = new Date(year, month0 + 1, 0);
  while (last.getDay() !== weekday) last.setDate(last.getDate() - 1);
  return last;
}

/** Add `days` days to a date */
function addDays(d, days) {
  const r = new Date(d); r.setDate(r.getDate() + days); return r;
}

// ── Source 3: Calendrical rules (pure JS — no static dates) ───────────────

const EMOJI = {
  national: '🇮🇳', love: '❤️', health: '🏥', environment: '🌿',
  education: '📚', sports: '🏅', culture: '🎭', family: '👨‍👩‍👧',
  awareness: '🎗️', peace: '🕊️', science: '🔬', food: '🍽️',
  music: '🎵', art: '🎨', kids: '🧒', women: '♀️', men: '👨',
};

function computeObservances(year) {
  const ev = [];
  const add = (date, name, emoji, type = 'observance') =>
    ev.push({ date: iso(date), name, emoji, type });

  // ── Fixed solar / regional Indian festivals ────────────────────────────
  // These are solar-calendar based (fixed Gregorian dates) so safe to compute
  add(new Date(year,  0, 13), 'Lohri',                                    '🔥', 'festival');
  add(new Date(year,  0, 14), 'Makar Sankranti',                          '🪁', 'festival');
  add(new Date(year,  0, 14), 'Thai Pongal (Pongal Day 1)',               '🍚', 'regional');
  add(new Date(year,  0, 15), 'Mattu Pongal (Pongal Day 2)',              '🐄', 'regional');
  add(new Date(year,  0, 16), 'Kaanum Pongal (Pongal Day 3)',             '🌺', 'regional');
  add(new Date(year,  3, 13), 'Baisakhi / Vishu (Kerala)',               '🌾', 'festival');

  // ── Fixed dates — national (India) ──────────────────────────────────────
  add(new Date(year,  0,  1), "New Year's Day",                           '🎉', 'national');
  add(new Date(year,  0, 10), 'World Hindi Day',                          '📜', 'national');
  add(new Date(year,  0, 12), 'National Youth Day (Vivekananda Jayanti)',  '🔱', 'national');
  add(new Date(year,  0, 15), 'Army Day',                                  '🎖️', 'national');
  add(new Date(year,  0, 23), 'Netaji Subhas Chandra Bose Jayanti',       '🎖️', 'national');
  add(new Date(year,  0, 24), 'National Girl Child Day',                  '👧', 'national');
  add(new Date(year,  0, 25), 'National Voters Day',                      '🗳️', 'national');
  add(new Date(year,  0, 28), 'Data Protection Day',                      '🔒', 'observance');
  add(new Date(year,  0, 30), 'Martyrs Day (Bapu)',                       '🕊️', 'national');
  add(new Date(year,  1,  4), 'World Cancer Day',                         '🎗️', 'observance');
  add(new Date(year,  1, 10), 'National Deworming Day',                   '🏥', 'national');
  add(new Date(year,  1, 20), 'World Day of Social Justice',              '⚖️', 'observance');
  add(new Date(year,  1, 21), 'International Mother Language Day',        '🗣️', 'observance');
  add(new Date(year,  1, 28), 'National Science Day (Raman Effect)',      '🔬', 'national');
  add(new Date(year,  2,  3), 'World Wildlife Day',                       '🦁', 'observance');
  add(new Date(year,  2,  8), "International Women's Day",                '♀️', 'observance');
  add(new Date(year,  2, 14), 'Pi Day',                                   '🔢', 'observance');
  add(new Date(year,  2, 15), 'World Consumer Rights Day',                '🛒', 'observance');
  add(new Date(year,  2, 20), "International Day of Happiness",           '😊', 'observance');
  add(new Date(year,  2, 21), 'World Poetry Day',                        '📜', 'observance');
  add(new Date(year,  2, 22), 'World Water Day',                         '💧', 'observance');
  add(new Date(year,  2, 23), 'World Meteorological Day',                '⛅', 'observance');
  add(new Date(year,  2, 27), 'World Theatre Day',                       '🎭', 'observance');
  add(new Date(year,  3,  2), 'World Autism Awareness Day',              '🧩', 'observance');
  add(new Date(year,  3,  5), 'National Maritime Day',                   '⚓', 'national');
  add(new Date(year,  3,  7), 'World Health Day',                        '🏥', 'observance');
  add(new Date(year,  3, 11), 'National Safe Motherhood Day',            '🤱', 'national');
  add(new Date(year,  3, 14), 'Dr. B R Ambedkar Jayanti',               '📚', 'national');
  add(new Date(year,  3, 17), 'World Haemophilia Day',                   '🎗️', 'observance');
  add(new Date(year,  3, 18), 'World Heritage Day',                      '🏛️', 'observance');
  add(new Date(year,  3, 19), 'World Liver Day',                        '🫀', 'observance');
  add(new Date(year,  3, 22), 'World Earth Day',                        '🌍', 'observance');
  add(new Date(year,  3, 23), 'World Book Day',                         '📚', 'observance');
  add(new Date(year,  3, 24), 'National Panchayati Raj Day',            '🏘️', 'national');
  add(new Date(year,  3, 25), 'World Malaria Day',                      '🦟', 'observance');
  add(new Date(year,  4,  1), 'International Workers Day / Maharashtra Day', '⚒️', 'regional');
  add(new Date(year,  4,  3), 'World Press Freedom Day',                '📰', 'observance');
  add(new Date(year,  4,  7), 'World Athletics Day',                    '🏃', 'observance');
  add(new Date(year,  4,  8), 'World Thalassemia Day',                  '🎗️', 'observance');
  add(new Date(year,  4,  9), 'Rabindranath Tagore Jayanti',            '📝', 'national');
  add(new Date(year,  4, 12), 'International Nurses Day',               '👩‍⚕️', 'observance');
  add(new Date(year,  4, 15), 'International Day of Families',          '👨‍👩‍👧', 'observance');
  add(new Date(year,  4, 17), 'World Hypertension Day',                 '🫀', 'observance');
  add(new Date(year,  4, 21), 'National Technology Day',                '💻', 'national');
  add(new Date(year,  4, 22), 'World Biodiversity Day',                 '🌿', 'observance');
  add(new Date(year,  4, 31), 'World No-Tobacco Day',                   '🚭', 'observance');
  add(new Date(year,  5,  1), 'World Milk Day',                         '🥛', 'observance');
  add(new Date(year,  5,  5), 'World Environment Day',                  '🌿', 'observance');
  add(new Date(year,  5,  7), 'World Food Safety Day',                  '🍽️', 'observance');
  add(new Date(year,  5,  8), 'World Oceans Day',                       '🌊', 'observance');
  add(new Date(year,  5, 12), 'World Day Against Child Labour',         '🧒', 'observance');
  add(new Date(year,  5, 14), 'World Blood Donor Day',                  '🩸', 'observance');
  add(new Date(year,  5, 21), 'International Yoga Day',                 '🧘', 'national');
  add(new Date(year,  5, 23), 'International Olympic Day',              '🏅', 'observance');
  add(new Date(year,  6,  1), 'National Doctors Day',                   '👨‍⚕️', 'national');
  add(new Date(year,  6, 11), 'World Population Day',                   '🌏', 'observance');
  add(new Date(year,  6, 26), 'International Day against Drug Abuse',   '🚫', 'observance');
  add(new Date(year,  6, 28), 'World Hepatitis Day',                    '🎗️', 'observance');
  add(new Date(year,  7,  9), 'Quit India Movement Day',                '🇮🇳', 'national');
  add(new Date(year,  7, 12), 'International Youth Day',                '👦', 'observance');
  add(new Date(year,  7, 19), 'World Photography Day',                  '📷', 'observance');
  add(new Date(year,  7, 29), 'National Sports Day (Dhyan Chand)',       '🏑', 'national');
  add(new Date(year,  7, 30), 'National Small Industry Day',            '🏭', 'national');
  add(new Date(year,  8,  2), 'World Coconut Day',                      '🥥', 'observance');
  add(new Date(year,  8,  5), "Teachers' Day (Dr. Radhakrishnan)",       '📖', 'national');
  add(new Date(year,  8,  8), 'International Literacy Day',             '📚', 'observance');
  add(new Date(year,  8, 14), 'Hindi Diwas',                            '📜', 'national');
  add(new Date(year,  8, 16), 'World Ozone Day',                        '🌡️', 'observance');
  add(new Date(year,  8, 17), 'Vishwakarma Puja',                       '🔧', 'festival');
  add(new Date(year,  8, 21), 'International Day of Peace',             '🕊️', 'observance');
  add(new Date(year,  8, 22), 'Rose Day (Cancer Patients)',             '🌹', 'observance');
  add(new Date(year,  8, 26), 'World Environmental Health Day',         '🌍', 'observance');
  add(new Date(year,  8, 27), 'World Tourism Day',                      '✈️', 'observance');
  add(new Date(year,  8, 28), 'World Rabies Day',                       '🐕', 'observance');
  add(new Date(year,  9,  1), 'World Vegetarian Day',                   '🥦', 'observance');
  add(new Date(year,  9,  2), 'Gandhi Jayanti / World Non-Violence Day', '🕊️', 'national');
  add(new Date(year,  9,  4), 'World Animal Welfare Day',               '🐾', 'observance');
  add(new Date(year,  9,  8), 'Indian Air Force Day',                   '✈️', 'national');
  add(new Date(year,  9, 10), 'World Mental Health Day',                '🧠', 'observance');
  add(new Date(year,  9, 13), 'World Egg Day',                          '🥚', 'observance');
  add(new Date(year,  9, 15), 'World Students Day',                     '🎓', 'national');
  add(new Date(year,  9, 16), 'World Food Day',                         '🌾', 'observance');
  add(new Date(year,  9, 24), 'United Nations Day',                     '🌐', 'observance');
  add(new Date(year,  9, 31), 'Sardar Patel Jayanti / Rashtriya Ekta Diwas', '🇮🇳', 'national');
  add(new Date(year, 10,  1), 'World Vegan Day',                        '🥗', 'observance');
  add(new Date(year, 10, 14), "Children's Day / Jawaharlal Nehru Jayanti", '🧒', 'national');
  add(new Date(year, 10, 19), 'Guru Tegh Bahadur Martyrdom Day',        '🕯️', 'national');
  add(new Date(year, 10, 19), 'International Men\'s Day',               '👨', 'observance');
  add(new Date(year, 10, 20), 'Africa Industrialization Day',           '🌍', 'observance');
  add(new Date(year, 11,  1), 'World AIDS Day',                         '🎗️', 'observance');
  add(new Date(year, 11,  2), 'National Pollution Control Day',         '🌿', 'national');
  add(new Date(year, 11,  3), 'World Disabilities Day',                 '♿', 'observance');
  add(new Date(year, 11,  4), 'Navy Day',                               '⚓', 'national');
  add(new Date(year, 11,  6), 'Mahaparinirvan Diwas (Dr. Ambedkar)',    '📚', 'national');
  add(new Date(year, 11, 10), 'Human Rights Day',                       '⚖️', 'observance');
  add(new Date(year, 11, 16), 'Vijay Diwas',                            '🎖️', 'national');
  add(new Date(year, 11, 19), 'Goa Liberation Day',                     '🌊', 'regional');
  add(new Date(year, 11, 22), 'National Mathematics Day (Ramanujan)',    '🔢', 'national');
  add(new Date(year, 11, 23), 'Kisan Diwas (Farmers Day)',              '🌾', 'national');
  add(new Date(year, 11, 24), 'National Consumer Day',                  '🛒', 'national');
  add(new Date(year, 11, 24), 'Christmas Eve',                          '🎄', 'festival');
  add(new Date(year, 11, 31), "New Year's Eve",                         '🎆', 'observance');

  // ── Valentine's Week (Feb 7–14) ──────────────────────────────────────────
  const vWeek = [
    [7, 'Rose Day',         '🌹'],
    [8, 'Propose Day',      '💍'],
    [9, 'Chocolate Day',    '🍫'],
    [10,'Teddy Day',        '🧸'],
    [11,'Promise Day',      '🤞'],
    [12,'Hug Day',          '🤗'],
    [13,'Kiss Day',         '💋'],
    [14,"Valentine's Day",  '❤️'],
  ];
  vWeek.forEach(([d, n, e]) => add(new Date(year, 1, d), n, e, 'observance'));

  // ── More fixed-date days ─────────────────────────────────────────────────
  add(new Date(year,  3, 10), 'Siblings Day',                              '👫', 'observance');
  add(new Date(year,  3, 29), 'International Dance Day',                   '💃', 'observance');
  add(new Date(year,  3, 30), 'International Jazz Day',                    '🎷', 'observance');
  add(new Date(year,  4,  4), 'Star Wars Day',                             '⭐', 'observance');
  add(new Date(year,  5, 23), 'International Olympic Day',                 '🏅', 'observance');
  add(new Date(year,  6, 17), 'World Emoji Day',                           '😊', 'observance');
  add(new Date(year,  7, 12), 'World Elephant Day',                        '🐘', 'observance');
  add(new Date(year,  9,  5), 'World Teachers Day (International)',        '📖', 'observance');
  add(new Date(year,  9, 31), 'Halloween',                                 '🎃', 'observance');
  add(new Date(year, 10, 11), 'Remembrance Day',                          '🌹', 'observance');
  add(new Date(year, 10, 13), 'World Kindness Day',                        '💛', 'observance');

  // ── Nth-weekday rules ─────────────────────────────────────────────────────
  // World Laughter Day: 1st Sunday of May
  add(nthWeekday(year, 4, 0, 1),  'World Laughter Day',        '😂', 'observance');
  // Mother's Day: 2nd Sunday of May
  add(nthWeekday(year, 4, 0, 2),  "Mother's Day",              '👩‍👧‍👦', 'observance');
  // Father's Day: 3rd Sunday of June
  add(nthWeekday(year, 5, 0, 3),  "Father's Day",              '👨‍👧‍👦', 'observance');
  // Friendship Day: 1st Sunday of August
  add(nthWeekday(year, 7, 0, 1),  'Friendship Day',            '🤝', 'observance');
  // Grandparents Day: 2nd Sunday of September
  add(nthWeekday(year, 8, 0, 2),  "Grandparents Day",          '👴👵', 'observance');
  // World Smile Day: 1st Friday of October
  add(nthWeekday(year, 9, 5, 1),  'World Smile Day',           '😊', 'observance');
  // Thanksgiving: 4th Thursday of November
  add(nthWeekday(year, 10, 4, 4), 'Thanksgiving Day',          '🦃', 'observance');

  return ev;
}

// ── Source 2: Lunar calendar (pure astronomy — same as before) ────────────

const SYNODIC         = 29.530588861;
const REF_NEW_MOON_JD = 2451550.09766;

function dateToJD(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function jdToISO(jd) {
  const z = Math.floor(jd + 0.5);
  const a = z >= 2299161 ? (() => { const x = Math.floor((z-1867216.25)/36524.25); return z+1+x-Math.floor(x/4); })() : z;
  const b = a+1524, c = Math.floor((b-122.1)/365.25), d = Math.floor(365.25*c), e = Math.floor((b-d)/30.6001);
  const day = b-d-Math.floor(30.6001*e), month = e<14?e-1:e-13, year = month>2?c-4716:c-4715;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

const EKADASI_NAMES = [
  'Mokshada Ekadasi','Saphala Ekadasi','Putrada Ekadasi','Sat Tila Ekadasi',
  'Jaya Ekadasi','Vijaya Ekadasi','Amalaki Ekadasi','Papamochani Ekadasi',
  'Kamada Ekadasi','Varuthini Ekadasi','Mohini Ekadasi','Apara Ekadasi',
  'Nirjala Ekadasi','Yogini Ekadasi','Devshayani Ekadasi','Kamika Ekadasi',
  'Shravana Putrada','Annada Ekadasi','Parsva Ekadasi','Indira Ekadasi',
  'Papankusha Ekadasi','Rama Ekadasi','Dev Prabodhini Ekadasi','Utpanna Ekadasi',
];
const PURNIMA_NAMES = [
  'Pausa Purnima','Magha Purnima','Phalguna Purnima','Chaitra Purnima',
  'Vaishakha Purnima','Jyeshtha Purnima','Ashadha Purnima','Shravana Purnima',
  'Bhadrapada Purnima','Ashwin Purnima','Kartika Purnima','Margashirsha Purnima',
];
const SANKASHTI_NAMES = [
  'Dhumravarna Sankashti','Angaraki Chaturthi','Bhalachandra Sankashti',
  'Vikata Sankashti','Ekadanta Sankashti','Krishnapingala Sankashti',
  'Gajanana Sankashti','Lambodara Sankashti','Dvija Sankashti',
  'Mahaganapati Sankashti','Vijaya Sankashti','Siddhi Sankashti',
];

function computeLunarEvents(fromISO, count = 80) {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const todayJD = dateToJD(fy, fm, fd);
  const k0 = Math.ceil((todayJD - REF_NEW_MOON_JD) / SYNODIC);
  const tithi = SYNODIC / 30;
  const events = [];

  for (let k = k0 - 1; k < k0 + 28 && events.length < count; k++) {
    const nmJD = REF_NEW_MOON_JD + k * SYNODIC;
    const fmJD = nmJD + SYNODIC * 0.5;
    const ni   = Math.abs(k) % 12;

    if (nmJD >= todayJD - 0.5)
      events.push({ date: jdToISO(nmJD), name: 'Amavasya', emoji: '🌑', type: 'moon' });
    if (nmJD + 11*tithi >= todayJD - 0.5)
      events.push({ date: jdToISO(nmJD + 11*tithi), name: `Ekadasi — ${EKADASI_NAMES[(k*2)%24]}`, emoji: '🪷', type: 'vrat' });
    if (nmJD + 13*tithi >= todayJD - 0.5)
      events.push({ date: jdToISO(nmJD + 13*tithi), name: 'Pradosh Vrat (Shukla)', emoji: '🕉️', type: 'vrat' });
    if (fmJD >= todayJD - 0.5)
      events.push({ date: jdToISO(fmJD), name: `Purnima — ${PURNIMA_NAMES[ni]}`, emoji: '🌕', type: 'moon' });
    if (fmJD + 4*tithi >= todayJD - 0.5)
      events.push({ date: jdToISO(fmJD + 4*tithi), name: `Sankashti Chaturthi — ${SANKASHTI_NAMES[ni]}`, emoji: '🐘', type: 'vrat' });
    if (fmJD + 11*tithi >= todayJD - 0.5)
      events.push({ date: jdToISO(fmJD + 11*tithi), name: `Ekadasi — ${EKADASI_NAMES[(k*2+1)%24]}`, emoji: '🪷', type: 'vrat' });
    if (fmJD + 13*tithi >= todayJD - 0.5)
      events.push({ date: jdToISO(fmJD + 13*tithi), name: 'Pradosh Vrat (Krishna)', emoji: '🕉️', type: 'vrat' });
  }
  return events;
}

// ── Source 1: date.nager.at + derived events ──────────────────────────────

const NAGER_EMOJI = {
  'Republic Day':'🇮🇳','Independence Day':'🇮🇳','Gandhi Jayanti':'🕊️',
  'Good Friday':'✝️','Christmas':'🎄','Christmas Day':'🎄',
  'Mahavir Jayanti':'☮️',"Buddha's Birthday":'☸️','Buddha Purnima':'☸️',
  'Guru Nanak Jayanti':'🙏','Eid-ul-Fitr':'🌙','Id-ul-Fitr':'🌙',
  'Eid-ul-Adha':'🌙','Muharram':'🌙','Holi':'🎨','Diwali':'🪔',
  "Dr. B. R. Ambedkar's Jayanti":'📚','Ambedkar Jayanti':'📚',
  'Vijaya Dashami':'⚔️','Dussehra':'⚔️','Navratri':'🔱',
  'Janmashtami':'🦚','Ganesh Chaturthi':'🐘','Raksha Bandhan':'🧵',
  'Ram Navami':'🪔','Vasant Panchami':'💛',
};

/** Derive Diwali-period events (Dhanteras → Chhath) from the Diwali date */
function deriveDiwaliPeriod(official) {
  const d = official.find(h => /diwali|deepavali/i.test(h.name));
  if (!d) return [];
  const [y, m, dy] = d.date.split('-').map(Number);
  const dw = new Date(y, m - 1, dy);
  return [
    { date: iso(addDays(dw, -2)), name: 'Dhanteras (Dhantrayodashi)',         emoji: '🪙', type: 'festival' },
    { date: iso(addDays(dw, -1)), name: 'Naraka Chaturdashi (Choti Diwali)', emoji: '🪔', type: 'festival' },
    { date: iso(addDays(dw,  1)), name: 'Govardhan Puja / Annakut',          emoji: '🐄', type: 'festival' },
    { date: iso(addDays(dw,  2)), name: 'Bhai Dooj',                          emoji: '👫', type: 'festival' },
    { date: iso(addDays(dw,  6)), name: 'Chhath Puja — Nahay Khay',          emoji: '🌅', type: 'festival' },
    { date: iso(addDays(dw,  7)), name: 'Chhath Puja — Kharna',              emoji: '🌅', type: 'festival' },
    { date: iso(addDays(dw,  8)), name: 'Chhath Puja — Sandhya Arghya',      emoji: '🌅', type: 'festival' },
    { date: iso(addDays(dw,  9)), name: 'Chhath Puja — Usha Arghya',         emoji: '🌅', type: 'festival' },
  ];
}

/** Derive Navratri days (9) from the Dussehra date in official holidays */
function deriveNavratri(official) {
  const d = official.find(h =>
    /dussehra|vijaya.dashami/i.test(h.name) || /vijay.dashami/i.test(h.name)
  );
  if (!d) return [];
  const [y, m, dy] = d.date.split('-').map(Number);
  const dussDate = new Date(y, m - 1, dy);
  const days = [];
  for (let i = 9; i >= 1; i--) {
    const dt = addDays(dussDate, -i);
    days.push({ date: iso(dt), name: `Navratri Day ${10-i}`, emoji: '🔱', type: 'festival' });
  }
  return days;
}

/** Derive 10-day Ganesh Chaturthi (until Anant Chaturdashi) */
function deriveGaneshPeriod(official) {
  const g = official.find(h => /ganesh.chaturthi/i.test(h.name));
  if (!g) return [];
  const [y, m, d] = g.date.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  return Array.from({ length: 9 }, (_, i) => ({
    date: iso(addDays(start, i + 1)),
    name: i === 8 ? 'Anant Chaturdashi (Ganesh Visarjan)' : `Ganesh Chaturthi Day ${i + 2}`,
    emoji: '🐘', type: 'festival',
  }));
}

// ── Main hook ──────────────────────────────────────────────────────────────

export function useHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let live = true;
    const today    = new Date().toISOString().slice(0, 10);
    const thisYear = new Date().getFullYear();

    async function load() {
      // Source 1: Official holidays (current + next year)
      let official = [];
      try {
        const [r1, r2] = await Promise.all([
          fetch(`https://date.nager.at/api/v3/PublicHolidays/${thisYear}/IN`,     { signal: AbortSignal.timeout(6000) }),
          fetch(`https://date.nager.at/api/v3/PublicHolidays/${thisYear+1}/IN`,   { signal: AbortSignal.timeout(6000) }),
        ]);
        const [d1, d2] = await Promise.all([r1.ok ? r1.json() : [], r2.ok ? r2.json() : []]);
        official = [...(Array.isArray(d1) ? d1 : []), ...(Array.isArray(d2) ? d2 : [])].map(h => ({
          date:  h.date,
          name:  h.localName || h.name,
          emoji: NAGER_EMOJI[h.name] || NAGER_EMOJI[h.localName] || '🇮🇳',
          type:  'national',
        }));
      } catch {}

      // Derived events from official holidays
      const derived = [
        ...deriveNavratri(official),
        ...deriveGaneshPeriod(official),
        ...deriveDiwaliPeriod(official),
      ];

      // Source 2: Lunar vrats (computed astronomy)
      const lunar = computeLunarEvents(today, 80);

      // Source 3: All observances — computed by calendrical rules, both years
      const obs = [
        ...computeObservances(thisYear),
        ...computeObservances(thisYear + 1),
      ];

      // Merge, dedup, filter upcoming, sort
      const all  = [...official, ...derived, ...lunar, ...obs];
      const seen = new Set();
      const out  = all
        .filter(h => h.date >= today)
        .filter(h => { const k = h.date + h.name; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => a.date.localeCompare(b.date));

      if (live) { setHolidays(out); setLoading(false); }
    }

    load();
    return () => { live = false; };
  }, []);

  return { holidays, loading };
}

export function daysUntil(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.ceil((new Date(y, m-1, d) - new Date(new Date().toDateString())) / 86400000);
}
