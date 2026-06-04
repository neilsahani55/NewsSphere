// Curated Indian public holidays and major festivals 2025–2026.
// Fixed-date national holidays are exact; religious festival dates are
// based on official government gazette / ICCR announcements.
export const HOLIDAYS = [
  // ── 2025 ──────────────────────────────────────────────────────────────
  { date: '2025-01-14', name: 'Makar Sankranti',          emoji: '🪁', type: 'festival'  },
  { date: '2025-01-23', name: 'Netaji Subhas Chandra Bose Jayanti', emoji: '🎖️', type: 'national' },
  { date: '2025-01-26', name: 'Republic Day',             emoji: '🇮🇳', type: 'national'  },
  { date: '2025-02-26', name: 'Maha Shivratri',           emoji: '🕉️', type: 'festival'  },
  { date: '2025-03-14', name: 'Holi',                     emoji: '🎨', type: 'festival'  },
  { date: '2025-03-30', name: 'Eid al-Fitr (Ramzan Eid)', emoji: '🌙', type: 'festival'  },
  { date: '2025-04-06', name: 'Ram Navami',               emoji: '🪔', type: 'festival'  },
  { date: '2025-04-10', name: 'Mahavir Jayanti',          emoji: '☮️', type: 'national'  },
  { date: '2025-04-13', name: 'Baisakhi',                 emoji: '🌾', type: 'festival'  },
  { date: '2025-04-14', name: 'Dr. Ambedkar Jayanti',     emoji: '📚', type: 'national'  },
  { date: '2025-04-18', name: 'Good Friday',              emoji: '✝️', type: 'national'  },
  { date: '2025-05-12', name: 'Buddha Purnima',           emoji: '☸️', type: 'national'  },
  { date: '2025-06-07', name: 'Eid al-Adha (Bakrid)',     emoji: '🌙', type: 'festival'  },
  { date: '2025-07-06', name: 'Muharram',                 emoji: '🌙', type: 'festival'  },
  { date: '2025-08-15', name: 'Independence Day',         emoji: '🇮🇳', type: 'national'  },
  { date: '2025-08-16', name: 'Janmashtami',              emoji: '🦚', type: 'festival'  },
  { date: '2025-08-27', name: 'Ganesh Chaturthi',         emoji: '🐘', type: 'festival'  },
  { date: '2025-10-02', name: 'Gandhi Jayanti / Dussehra',emoji: '🕊️', type: 'national'  },
  { date: '2025-10-20', name: 'Diwali',                   emoji: '🪔', type: 'festival'  },
  { date: '2025-10-22', name: 'Bhai Dooj',                emoji: '🪔', type: 'festival'  },
  { date: '2025-11-05', name: 'Guru Nanak Jayanti',       emoji: '🙏', type: 'national'  },
  { date: '2025-12-25', name: 'Christmas',                emoji: '🎄', type: 'national'  },
  // ── 2026 ──────────────────────────────────────────────────────────────
  { date: '2026-01-14', name: 'Makar Sankranti',          emoji: '🪁', type: 'festival'  },
  { date: '2026-01-26', name: 'Republic Day',             emoji: '🇮🇳', type: 'national'  },
  { date: '2026-02-15', name: 'Maha Shivratri',           emoji: '🕉️', type: 'festival'  },
  { date: '2026-03-02', name: 'Holi',                     emoji: '🎨', type: 'festival'  },
  { date: '2026-03-19', name: 'Eid al-Fitr (Ramzan Eid)', emoji: '🌙', type: 'festival'  },
  { date: '2026-04-03', name: 'Good Friday',              emoji: '✝️', type: 'national'  },
  { date: '2026-04-14', name: 'Dr. Ambedkar Jayanti / Baisakhi', emoji: '📚', type: 'national' },
  { date: '2026-05-27', name: 'Eid al-Adha (Bakrid)',     emoji: '🌙', type: 'festival'  },
  { date: '2026-08-15', name: 'Independence Day',         emoji: '🇮🇳', type: 'national'  },
  { date: '2026-09-03', name: 'Janmashtami',              emoji: '🦚', type: 'festival'  },
  { date: '2026-09-19', name: 'Ganesh Chaturthi',         emoji: '🐘', type: 'festival'  },
  { date: '2026-10-02', name: 'Gandhi Jayanti',           emoji: '🕊️', type: 'national'  },
  { date: '2026-11-08', name: 'Diwali',                   emoji: '🪔', type: 'festival'  },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti',       emoji: '🙏', type: 'national'  },
  { date: '2026-12-25', name: 'Christmas',                emoji: '🎄', type: 'national'  },
];

// Returns upcoming holidays starting from today, up to `limit`
export function getUpcomingHolidays(limit = 4) {
  const today = new Date().toISOString().slice(0, 10);
  return HOLIDAYS
    .filter(h => h.date >= today)
    .slice(0, limit);
}

// Days until a given ISO date string
export function daysUntil(isoDate) {
  const now  = new Date();
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.ceil((target - now) / 86400000);
}
