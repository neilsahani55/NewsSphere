// The Sheet's `category` column (B) is now a comma-separated list of topics.
// Examples seen in production:
//   "India"
//   "Crypto, Tech"
//   "India, Politics, Business"
//   "Crypto, Health, Business, Tech"
// We treat each cell as a SET of topics — an article appears under any topic
// it carries, and the filter bar matches by membership.

export const TOPIC_CATEGORIES = [
  { id: 'All',           label: 'All',           tone: 'neutral' },
  { id: 'India',         label: 'India',         tone: 'cream'   },
  { id: 'Politics',      label: 'Politics',      tone: 'purple'  },
  { id: 'Business',      label: 'Business',      tone: 'green'   },
  { id: 'Tech',          label: 'Tech',          tone: 'blue'    },
  { id: 'Crypto',        label: 'Crypto',        tone: 'amber'   },
  { id: 'Sports',        label: 'Sports',        tone: 'orange'  },
  { id: 'World',         label: 'World',         tone: 'indigo'  },
  { id: 'Science',       label: 'Science',       tone: 'teal'    },
  { id: 'Health',        label: 'Health',        tone: 'green'   },
  { id: 'Entertainment', label: 'Entertainment', tone: 'red'     },
  { id: 'Crime',         label: 'Crime',         tone: 'red'     },
  { id: 'Environment',   label: 'Environment',   tone: 'teal'    },
];

const TOPIC_INDEX = Object.fromEntries(TOPIC_CATEGORIES.map(t => [t.id, t]));

// Splits "India, Politics, Business" → ["India", "Politics", "Business"].
// Returns an empty array for blank cells. Trims whitespace, drops empties.
export function topicsOf(category) {
  if (!category) return [];
  return String(category)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// First topic in the list — used for the dominant tone/color.
export function primaryTopic(category) {
  return topicsOf(category)[0] || 'Other';
}

// Tone (color theme) is derived from the primary topic.
export function categoryTone(category) {
  return TOPIC_INDEX[primaryTopic(category)]?.tone || 'neutral';
}

// Per-topic tone — used when rendering each tag in a multi-topic article.
export function toneFor(topic) {
  return TOPIC_INDEX[topic]?.tone || 'neutral';
}

// Returns true if the article's category list contains the target topic.
// "All" matches everything.
export function matchesTopic(category, target) {
  if (target === 'All') return true;
  return topicsOf(category).includes(target);
}

// Languages offered by the global translator (Google Translate).
// 'en' is the default — most articles are already in English so this is a no-op
// for them, while non-English source rows get auto-translated to English.
export const TRANSLATE_LANGUAGES = [
  { id: 'en',       label: 'English'     },
  { id: 'hi',       label: 'हिन्दी'      },
  { id: 'ta',       label: 'தமிழ்'      },
  { id: 'te',       label: 'తెలుగు'     },
  { id: 'bn',       label: 'বাংলা'       },
  { id: 'mr',       label: 'मराठी'       },
  { id: 'gu',       label: 'ગુજરાતી'    },
  { id: 'kn',       label: 'ಕನ್ನಡ'      },
  { id: 'ml',       label: 'മലയാളം'    },
  { id: 'pa',       label: 'ਪੰਜਾਬੀ'      },
  { id: 'ur',       label: 'اردو'        },
  { id: 'ar',       label: 'العربية'     },
  { id: 'es',       label: 'Español'     },
  { id: 'fr',       label: 'Français'    },
  { id: 'de',       label: 'Deutsch'     },
  { id: 'zh-CN',    label: '中文'         },
  { id: 'ja',       label: '日本語'       },
];

// Sentiment in the sheet is -1.0..+1.0 (World News API).
export function sentimentLabel(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  if (n >= 0.25)  return { tone: 'pos', label: 'Positive', score: n };
  if (n <= -0.25) return { tone: 'neg', label: 'Negative', score: n };
  return { tone: 'neu', label: 'Neutral', score: n };
}
