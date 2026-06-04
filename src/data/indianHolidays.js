/**
 * Comprehensive Indian holidays, festivals, vrats, and observances 2025–2026.
 *
 * Types:
 *   national   — Central govt gazetted holiday (all states)
 *   festival   — Major cross-religion celebration
 *   vrat       — Fasting / religious observance day
 *   moon       — Purnima (full moon) or Amavasya (new moon)
 *   regional   — State-specific or community-specific
 *   observance — International / national awareness days
 */

export const HOLIDAYS = [

  // ══════════════════════════════════════════════════════════════════════
  // 2025
  // ══════════════════════════════════════════════════════════════════════

  // ── January 2025 ──────────────────────────────────────────────────────
  { date: '2025-01-01', name: "New Year's Day",                    emoji: '🎉', type: 'observance' },
  { date: '2025-01-03', name: 'Sankashti Chaturthi (Ganesh Vrat)', emoji: '🐘', type: 'vrat'       },
  { date: '2025-01-06', name: 'Guru Gobind Singh Jayanti',         emoji: '🙏', type: 'national'   },
  { date: '2025-01-10', name: 'Saphala Ekadasi',                   emoji: '🪷', type: 'vrat'       },
  { date: '2025-01-13', name: 'Lohri',                             emoji: '🔥', type: 'festival'   },
  { date: '2025-01-14', name: 'Makar Sankranti',                   emoji: '🪁', type: 'festival'   },
  { date: '2025-01-14', name: 'Pongal (Bhogi)',                    emoji: '🍚', type: 'regional'   },
  { date: '2025-01-15', name: 'Pongal (Thai Pongal) / Army Day',   emoji: '🎖️', type: 'regional'  },
  { date: '2025-01-16', name: 'Mattu Pongal',                      emoji: '🐄', type: 'regional'   },
  { date: '2025-01-25', name: 'Putrada Ekadasi',                   emoji: '🪷', type: 'vrat'       },
  { date: '2025-01-23', name: 'Netaji Subhas Chandra Bose Jayanti',emoji: '🎖️', type: 'national'  },
  { date: '2025-01-26', name: 'Republic Day',                      emoji: '🇮🇳', type: 'national'  },
  { date: '2025-01-29', name: 'Mauni Amavasya (Silence fast)',     emoji: '🤫', type: 'vrat'       },

  // ── February 2025 ─────────────────────────────────────────────────────
  { date: '2025-02-01', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2025-02-02', name: 'Vasant Panchami (Saraswati Puja)',  emoji: '💛', type: 'festival'   },
  { date: '2025-02-08', name: 'Sat Tila Ekadasi',                  emoji: '🪷', type: 'vrat'       },
  { date: '2025-02-12', name: 'Magha Purnima',                     emoji: '🌕', type: 'moon'       },
  { date: '2025-02-24', name: 'Jaya Ekadasi',                      emoji: '🪷', type: 'vrat'       },
  { date: '2025-02-26', name: 'Maha Shivratri',                    emoji: '🕉️', type: 'national'  },
  { date: '2025-02-28', name: 'National Science Day',              emoji: '🔬', type: 'observance' },
  { date: '2025-02-28', name: 'Magha Amavasya',                    emoji: '🌑', type: 'moon'       },

  // ── March 2025 ────────────────────────────────────────────────────────
  { date: '2025-03-03', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2025-03-08', name: "International Women's Day",         emoji: '♀️', type: 'observance' },
  { date: '2025-03-10', name: 'Vijaya Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2025-03-13', name: 'Phalguna Purnima / Holika Dahan',   emoji: '🔥', type: 'festival'   },
  { date: '2025-03-14', name: 'Holi',                              emoji: '🎨', type: 'national'   },
  { date: '2025-03-25', name: 'Amalaki Ekadasi',                   emoji: '🪷', type: 'vrat'       },
  { date: '2025-03-29', name: 'Chaitra Amavasya',                  emoji: '🌑', type: 'moon'       },
  { date: '2025-03-30', name: 'Eid al-Fitr (Ramzan Eid)',          emoji: '🌙', type: 'national'   },
  { date: '2025-03-30', name: 'Ugadi / Gudi Padwa / Telugu New Year', emoji: '🌸', type: 'festival' },

  // ── April 2025 ────────────────────────────────────────────────────────
  { date: '2025-04-01', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2025-04-06', name: 'Ram Navami',                        emoji: '🪔', type: 'national'   },
  { date: '2025-04-07', name: 'World Health Day',                  emoji: '🏥', type: 'observance' },
  { date: '2025-04-09', name: 'Papamochani Ekadasi',               emoji: '🪷', type: 'vrat'       },
  { date: '2025-04-10', name: 'Mahavir Jayanti',                   emoji: '☮️', type: 'national'  },
  { date: '2025-04-12', name: 'Chaitra Purnima / Hanuman Jayanti', emoji: '🐒', type: 'festival'   },
  { date: '2025-04-13', name: 'Baisakhi / Vishu (Kerala)',         emoji: '🌾', type: 'festival'   },
  { date: '2025-04-14', name: 'Dr. B R Ambedkar Jayanti',         emoji: '📚', type: 'national'   },
  { date: '2025-04-14', name: 'Bihu (Assam) / Tamil New Year',     emoji: '🥁', type: 'regional'   },
  { date: '2025-04-18', name: 'Good Friday',                       emoji: '✝️', type: 'national'  },
  { date: '2025-04-20', name: 'Easter Sunday',                     emoji: '🐣', type: 'festival'   },
  { date: '2025-04-22', name: 'World Earth Day',                   emoji: '🌍', type: 'observance' },
  { date: '2025-04-24', name: 'Kamada Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2025-04-27', name: 'Vaishakha Amavasya',                emoji: '🌑', type: 'moon'       },
  { date: '2025-04-30', name: 'Akshaya Tritiya',                   emoji: '✨', type: 'festival'   },
  { date: '2025-04-30', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },

  // ── May 2025 ──────────────────────────────────────────────────────────
  { date: '2025-05-01', name: 'Maharashtra Day / Gujarat Day / Workers Day', emoji: '⚒️', type: 'regional' },
  { date: '2025-05-09', name: 'Varuthini Ekadasi',                 emoji: '🪷', type: 'vrat'       },
  { date: '2025-05-12', name: 'Buddha Purnima (Vesak)',            emoji: '☸️', type: 'national'  },
  { date: '2025-05-23', name: 'Mohini Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2025-05-26', name: 'Jyeshtha Amavasya',                 emoji: '🌑', type: 'moon'       },
  { date: '2025-05-29', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },

  // ── June 2025 ─────────────────────────────────────────────────────────
  { date: '2025-06-05', name: 'World Environment Day',             emoji: '🌿', type: 'observance' },
  { date: '2025-06-07', name: 'Apara Ekadasi',                     emoji: '🪷', type: 'vrat'       },
  { date: '2025-06-07', name: 'Eid al-Adha (Bakrid)',              emoji: '🌙', type: 'national'   },
  { date: '2025-06-11', name: 'Jyeshtha Purnima',                  emoji: '🌕', type: 'moon'       },
  { date: '2025-06-21', name: 'International Yoga Day',            emoji: '🧘', type: 'observance' },
  { date: '2025-06-22', name: 'Nirjala Ekadasi (Pandava Bhima)',   emoji: '🪷', type: 'vrat'       },
  { date: '2025-06-25', name: 'Ashadha Amavasya',                  emoji: '🌑', type: 'moon'       },
  { date: '2025-06-27', name: 'Rath Yatra (Puri Jagannath)',       emoji: '🛕', type: 'festival'   },
  { date: '2025-06-28', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },

  // ── July 2025 ─────────────────────────────────────────────────────────
  { date: '2025-07-01', name: 'National Doctors Day',              emoji: '👨‍⚕️', type: 'observance' },
  { date: '2025-07-06', name: 'Muharram (Islamic New Year)',        emoji: '🌙', type: 'national'   },
  { date: '2025-07-07', name: 'Yogini Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2025-07-10', name: 'Ashadha Purnima / Guru Purnima',    emoji: '🙏', type: 'festival'   },
  { date: '2025-07-21', name: 'Devshayani Ekadasi (Vishnu sleeps)', emoji: '🪷', type: 'vrat'      },
  { date: '2025-07-24', name: 'Shravan Amavasya',                  emoji: '🌑', type: 'moon'       },
  { date: '2025-07-28', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },

  // ── August 2025 ───────────────────────────────────────────────────────
  { date: '2025-08-03', name: 'Friendship Day / Hariyali Teej',    emoji: '🤝', type: 'observance' },
  { date: '2025-08-05', name: 'Kamika Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2025-08-08', name: 'Shravana Purnima / Raksha Bandhan', emoji: '🧵', type: 'festival'   },
  { date: '2025-08-15', name: 'Independence Day',                  emoji: '🇮🇳', type: 'national'  },
  { date: '2025-08-16', name: 'Janmashtami (Dahi Handi)',          emoji: '🦚', type: 'national'   },
  { date: '2025-08-19', name: 'Shravana Putrada Ekadasi',          emoji: '🪷', type: 'vrat'       },
  { date: '2025-08-22', name: 'Bhadrapada Amavasya',               emoji: '🌑', type: 'moon'       },
  { date: '2025-08-26', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2025-08-27', name: 'Ganesh Chaturthi',                  emoji: '🐘', type: 'festival'   },
  { date: '2025-08-29', name: 'National Sports Day (Dhyan Chand)', emoji: '🏑', type: 'observance' },

  // ── September 2025 ────────────────────────────────────────────────────
  { date: '2025-09-04', name: 'Annada Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2025-09-05', name: "Teachers' Day",                     emoji: '📖', type: 'national'   },
  { date: '2025-09-06', name: 'Bhadrapada Purnima / Onam Thiruvonam', emoji: '🌺', type: 'regional' },
  { date: '2025-09-15', name: 'Ganesh Visarjan (Anant Chaturdashi)', emoji: '🐘', type: 'festival'  },
  { date: '2025-09-17', name: 'Vishwakarma Puja',                  emoji: '🔧', type: 'festival'   },
  { date: '2025-09-18', name: 'Parsva Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2025-09-21', name: 'Mahalaya Amavasya (Pitru Visarjan)',emoji: '🌑', type: 'vrat'       },
  { date: '2025-09-22', name: 'Navratri Begins (Shardiya)',        emoji: '🔱', type: 'festival'   },
  { date: '2025-09-24', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2025-09-25', name: 'Durga Puja Shashti (Bengal)',       emoji: '🔱', type: 'regional'   },
  { date: '2025-09-28', name: 'Maha Ashtami / Durga Ashtami',     emoji: '🔱', type: 'festival'   },
  { date: '2025-09-29', name: 'Maha Navami',                       emoji: '🔱', type: 'festival'   },

  // ── October 2025 ──────────────────────────────────────────────────────
  { date: '2025-10-01', name: 'Saraswati Puja (Navratri Navami)',  emoji: '🎓', type: 'festival'   },
  { date: '2025-10-02', name: 'Gandhi Jayanti',                    emoji: '🕊️', type: 'national'  },
  { date: '2025-10-02', name: 'Dussehra (Vijaya Dashami)',         emoji: '⚔️', type: 'national'  },
  { date: '2025-10-03', name: 'Indira Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2025-10-06', name: 'Sharad Purnima (Kojagiri / Lakshmi Puja)', emoji: '🌕', type: 'festival' },
  { date: '2025-10-08', name: 'Indian Air Force Day',              emoji: '✈️', type: 'observance' },
  { date: '2025-10-13', name: 'Karva Chauth',                      emoji: '🌕', type: 'festival'   },
  { date: '2025-10-16', name: 'Dhanteras (Dhantrayodashi)',        emoji: '🪙', type: 'festival'   },
  { date: '2025-10-17', name: 'Papankusha Ekadasi',               emoji: '🪷', type: 'vrat'       },
  { date: '2025-10-17', name: 'Naraka Chaturdashi (Choti Diwali)',emoji: '🪔', type: 'festival'   },
  { date: '2025-10-20', name: 'Diwali (Lakshmi Puja)',             emoji: '🪔', type: 'national'   },
  { date: '2025-10-20', name: 'Kali Puja (Bengal)',                emoji: '🔱', type: 'regional'   },
  { date: '2025-10-21', name: 'Govardhan Puja / Annakut',         emoji: '🐄', type: 'festival'   },
  { date: '2025-10-22', name: 'Bhai Dooj',                         emoji: '👫', type: 'festival'   },
  { date: '2025-10-24', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2025-10-24', name: 'Chhath Puja (Nahay Khay)',          emoji: '🌅', type: 'festival'   },
  { date: '2025-10-26', name: 'Ahoi Ashtami',                      emoji: '⭐', type: 'vrat'       },
  { date: '2025-10-27', name: 'Chhath Puja (Sandhya Arghya)',      emoji: '🌅', type: 'festival'   },
  { date: '2025-10-28', name: 'Chhath Puja (Usha Arghya)',         emoji: '🌅', type: 'festival'   },
  { date: '2025-10-31', name: 'Sardar Vallabhbhai Patel Jayanti / Rashtriya Ekta Diwas', emoji: '🇮🇳', type: 'national' },

  // ── November 2025 ─────────────────────────────────────────────────────
  { date: '2025-11-01', name: 'Rama Ekadasi',                      emoji: '🪷', type: 'vrat'       },
  { date: '2025-11-05', name: 'Kartika Purnima / Deva Deepawali',  emoji: '🌕', type: 'festival'   },
  { date: '2025-11-05', name: 'Guru Nanak Jayanti (Gurpurab)',      emoji: '🙏', type: 'national'   },
  { date: '2025-11-14', name: "Children's Day / Jawaharlal Nehru Jayanti", emoji: '🧒', type: 'national' },
  { date: '2025-11-16', name: 'Dev Prabodhini Ekadasi (Vishnu wakes)', emoji: '🪷', type: 'vrat'   },
  { date: '2025-11-19', name: 'Guru Tegh Bahadur Martyrdom Day',   emoji: '🕯️', type: 'national'  },
  { date: '2025-11-23', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2025-11-23', name: 'Kartika Amavasya',                  emoji: '🌑', type: 'moon'       },

  // ── December 2025 ─────────────────────────────────────────────────────
  { date: '2025-12-01', name: 'Utpanna Ekadasi',                   emoji: '🪷', type: 'vrat'       },
  { date: '2025-12-04', name: 'Navy Day',                          emoji: '⚓', type: 'observance' },
  { date: '2025-12-05', name: 'Margashirsha Purnima',              emoji: '🌕', type: 'moon'       },
  { date: '2025-12-06', name: 'Mahaparinirvan Diwas (Dr. Ambedkar)', emoji: '📚', type: 'national' },
  { date: '2025-12-16', name: 'Mokshada Ekadasi (Gita Jayanti)',    emoji: '🪷', type: 'vrat'       },
  { date: '2025-12-19', name: 'Goa Liberation Day',                emoji: '🌊', type: 'regional'   },
  { date: '2025-12-22', name: 'National Mathematics Day (Ramanujan)', emoji: '🔢', type: 'observance' },
  { date: '2025-12-22', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2025-12-24', name: 'Christmas Eve',                     emoji: '🎄', type: 'festival'   },
  { date: '2025-12-25', name: 'Christmas',                         emoji: '🎄', type: 'national'   },
  { date: '2025-12-31', name: "New Year's Eve",                    emoji: '🎆', type: 'observance' },

  // ══════════════════════════════════════════════════════════════════════
  // 2026
  // ══════════════════════════════════════════════════════════════════════

  // ── January 2026 ──────────────────────────────────────────────────────
  { date: '2026-01-01', name: "New Year's Day",                    emoji: '🎉', type: 'observance' },
  { date: '2026-01-02', name: 'Guru Gobind Singh Jayanti',         emoji: '🙏', type: 'national'   },
  { date: '2026-01-10', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-01-13', name: 'Lohri',                             emoji: '🔥', type: 'festival'   },
  { date: '2026-01-14', name: 'Makar Sankranti / Pongal',          emoji: '🪁', type: 'festival'   },
  { date: '2026-01-15', name: 'Army Day',                          emoji: '🎖️', type: 'observance' },
  { date: '2026-01-14', name: 'Putrada Ekadasi',                   emoji: '🪷', type: 'vrat'       },
  { date: '2026-01-22', name: 'Vasant Panchami (Saraswati Puja)',  emoji: '💛', type: 'festival'   },
  { date: '2026-01-23', name: 'Netaji Jayanti',                    emoji: '🎖️', type: 'national'  },
  { date: '2026-01-26', name: 'Republic Day',                      emoji: '🇮🇳', type: 'national'  },
  { date: '2026-01-29', name: 'Sat Tila Ekadasi',                  emoji: '🪷', type: 'vrat'       },

  // ── February 2026 ─────────────────────────────────────────────────────
  { date: '2026-02-09', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-02-12', name: 'Jaya Ekadasi',                      emoji: '🪷', type: 'vrat'       },
  { date: '2026-02-15', name: 'Maha Shivratri',                    emoji: '🕉️', type: 'national'  },
  { date: '2026-02-27', name: 'Vijaya Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2026-02-28', name: 'National Science Day',              emoji: '🔬', type: 'observance' },

  // ── March 2026 ────────────────────────────────────────────────────────
  { date: '2026-03-01', name: 'Holika Dahan',                      emoji: '🔥', type: 'festival'   },
  { date: '2026-03-02', name: 'Holi',                              emoji: '🎨', type: 'national'   },
  { date: '2026-03-08', name: "International Women's Day",         emoji: '♀️', type: 'observance' },
  { date: '2026-03-10', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-03-13', name: 'Amalaki Ekadasi',                   emoji: '🪷', type: 'vrat'       },
  { date: '2026-03-14', name: 'Phalguna Purnima',                  emoji: '🌕', type: 'moon'       },
  { date: '2026-03-19', name: 'Eid al-Fitr',                       emoji: '🌙', type: 'national'   },
  { date: '2026-03-19', name: 'Ugadi / Gudi Padwa',                emoji: '🌸', type: 'festival'   },
  { date: '2026-03-28', name: 'Papamochani Ekadasi',               emoji: '🪷', type: 'vrat'       },

  // ── April 2026 ────────────────────────────────────────────────────────
  { date: '2026-04-02', name: 'Mahavir Jayanti',                   emoji: '☮️', type: 'national'  },
  { date: '2026-04-03', name: 'Good Friday',                       emoji: '✝️', type: 'national'  },
  { date: '2026-04-05', name: 'Easter Sunday',                     emoji: '🐣', type: 'festival'   },
  { date: '2026-04-08', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-04-12', name: 'Kamada Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2026-04-13', name: 'Baisakhi / Vishu (Kerala)',         emoji: '🌾', type: 'festival'   },
  { date: '2026-04-13', name: 'Chaitra Purnima',                   emoji: '🌕', type: 'moon'       },
  { date: '2026-04-14', name: 'Dr. B R Ambedkar Jayanti',         emoji: '📚', type: 'national'   },
  { date: '2026-04-14', name: 'Bihu / Tamil New Year',             emoji: '🥁', type: 'regional'   },
  { date: '2026-04-22', name: 'Akshaya Tritiya / World Earth Day', emoji: '✨', type: 'festival'   },
  { date: '2026-04-26', name: 'Varuthini Ekadasi',                 emoji: '🪷', type: 'vrat'       },

  // ── May 2026 ──────────────────────────────────────────────────────────
  { date: '2026-05-01', name: 'Maharashtra Day / Workers Day',     emoji: '⚒️', type: 'regional'  },
  { date: '2026-05-08', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-05-11', name: 'Mohini Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2026-05-12', name: 'Vaishakha Purnima / Buddha Purnima',emoji: '☸️', type: 'national'  },
  { date: '2026-05-26', name: 'Apara Ekadasi',                     emoji: '🪷', type: 'vrat'       },
  { date: '2026-05-27', name: 'Eid al-Adha',                       emoji: '🌙', type: 'national'   },

  // ── June 2026 ─────────────────────────────────────────────────────────
  { date: '2026-06-05', name: 'World Environment Day',             emoji: '🌿', type: 'observance' },
  { date: '2026-06-07', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-06-09', name: 'Nirjala Ekadasi (most important)',   emoji: '🪷', type: 'vrat'       },
  { date: '2026-06-16', name: 'Rath Yatra (Puri)',                 emoji: '🛕', type: 'festival'   },
  { date: '2026-06-21', name: 'International Yoga Day',            emoji: '🧘', type: 'observance' },
  { date: '2026-06-25', name: 'Yogini Ekadasi',                    emoji: '🪷', type: 'vrat'       },

  // ── July 2026 ─────────────────────────────────────────────────────────
  { date: '2026-07-07', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-07-09', name: 'Devshayani Ekadasi',                emoji: '🪷', type: 'vrat'       },
  { date: '2026-07-10', name: 'Ashadha Purnima / Guru Purnima',    emoji: '🙏', type: 'festival'   },
  { date: '2026-07-24', name: 'Kamika Ekadasi',                    emoji: '🪷', type: 'vrat'       },

  // ── August 2026 ───────────────────────────────────────────────────────
  { date: '2026-08-06', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-08-08', name: 'Shravana Putrada Ekadasi',          emoji: '🪷', type: 'vrat'       },
  { date: '2026-08-09', name: 'Shravana Purnima',                  emoji: '🌕', type: 'moon'       },
  { date: '2026-08-15', name: 'Independence Day',                  emoji: '🇮🇳', type: 'national'  },
  { date: '2026-08-22', name: 'Annada Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2026-08-26', name: 'Raksha Bandhan',                    emoji: '🧵', type: 'festival'   },
  { date: '2026-08-29', name: 'National Sports Day',               emoji: '🏑', type: 'observance' },

  // ── September 2026 ────────────────────────────────────────────────────
  { date: '2026-09-03', name: 'Janmashtami',                       emoji: '🦚', type: 'national'   },
  { date: '2026-09-05', name: "Teachers' Day",                     emoji: '📖', type: 'national'   },
  { date: '2026-09-05', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-09-07', name: 'Parsva Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2026-09-09', name: 'Onam Thiruvonam',                   emoji: '🌺', type: 'regional'   },
  { date: '2026-09-16', name: 'Ganesh Chaturthi',                  emoji: '🐘', type: 'festival'   },
  { date: '2026-09-19', name: 'Mahalaya Amavasya (Pitru Visarjan)',emoji: '🌑', type: 'vrat'       },
  { date: '2026-09-21', name: 'Navratri Begins',                   emoji: '🔱', type: 'festival'   },
  { date: '2026-09-25', name: 'Maha Ashtami',                      emoji: '🔱', type: 'festival'   },

  // ── October 2026 ──────────────────────────────────────────────────────
  { date: '2026-10-02', name: 'Gandhi Jayanti',                    emoji: '🕊️', type: 'national'  },
  { date: '2026-10-04', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-10-07', name: 'Indira Ekadasi',                    emoji: '🪷', type: 'vrat'       },
  { date: '2026-10-08', name: 'Indian Air Force Day',              emoji: '✈️', type: 'observance' },
  { date: '2026-10-19', name: 'Dussehra (Vijaya Dashami)',         emoji: '⚔️', type: 'national'  },
  { date: '2026-10-21', name: 'Papankusha Ekadasi',                emoji: '🪷', type: 'vrat'       },
  { date: '2026-10-22', name: 'Sharad Purnima',                    emoji: '🌕', type: 'festival'   },
  { date: '2026-10-27', name: 'Karva Chauth',                      emoji: '🌕', type: 'festival'   },
  { date: '2026-11-04', name: 'Dhanteras',                         emoji: '🪙', type: 'festival'   },
  { date: '2026-11-04', name: 'Sankashti Chaturthi',               emoji: '🐘', type: 'vrat'       },
  { date: '2026-11-05', name: 'Naraka Chaturdashi',                emoji: '🪔', type: 'festival'   },
  { date: '2026-11-06', name: 'Rama Ekadasi',                      emoji: '🪷', type: 'vrat'       },
  { date: '2026-11-08', name: 'Diwali / Kali Puja',                emoji: '🪔', type: 'national'   },
  { date: '2026-11-09', name: 'Govardhan Puja',                    emoji: '🐄', type: 'festival'   },
  { date: '2026-11-10', name: 'Bhai Dooj',                         emoji: '👫', type: 'festival'   },
  { date: '2026-11-12', name: 'Chhath Puja (Sandhya Arghya)',      emoji: '🌅', type: 'festival'   },
  { date: '2026-11-14', name: "Children's Day / Nehru Jayanti",    emoji: '🧒', type: 'national'   },
  { date: '2026-11-21', name: 'Dev Prabodhini Ekadasi',            emoji: '🪷', type: 'vrat'       },
  { date: '2026-11-24', name: 'Kartika Purnima / Guru Nanak Jayanti', emoji: '🙏', type: 'national' },
  { date: '2026-11-19', name: 'Guru Tegh Bahadur Martyrdom Day',   emoji: '🕯️', type: 'national'  },

  // ── December 2026 ─────────────────────────────────────────────────────
  { date: '2026-12-04', name: 'Navy Day / Utpanna Ekadasi',        emoji: '⚓', type: 'observance' },
  { date: '2026-12-06', name: 'Mahaparinirvan Diwas',              emoji: '📚', type: 'national'   },
  { date: '2026-12-19', name: 'Mokshada Ekadasi (Gita Jayanti)',   emoji: '🪷', type: 'vrat'       },
  { date: '2026-12-19', name: 'Goa Liberation Day',                emoji: '🌊', type: 'regional'   },
  { date: '2026-12-22', name: 'National Mathematics Day',          emoji: '🔢', type: 'observance' },
  { date: '2026-12-25', name: 'Christmas',                         emoji: '🎄', type: 'national'   },
  { date: '2026-12-31', name: "New Year's Eve",                    emoji: '🎆', type: 'observance' },
];

/** Returns upcoming holidays starting from today, up to `limit`. */
export function getUpcomingHolidays(limit = 5) {
  const today = new Date().toISOString().slice(0, 10);
  return HOLIDAYS.filter(h => h.date >= today).slice(0, limit);
}

/** Days until a given ISO date string (0 = today, negative = past). */
export function daysUntil(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const diff = new Date(y, m - 1, d) - new Date(new Date().toDateString());
  return Math.ceil(diff / 86400000);
}
