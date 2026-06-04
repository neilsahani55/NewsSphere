// City-wise Indian retail fuel prices (₹/litre) — post March 2024 revision.
// Central govt cut petrol/diesel by ₹2 each on Mar 15 2024.
// Final prices = base price + central excise + state VAT + dealer commission.
// State VAT varies significantly, hence large city-to-city differences.

export const FUEL_LAST_REVISED = 'Mar 2024';

// City prices (petrol, diesel) in ₹/litre
export const CITY_FUEL = {
  // ── National Capital / NCR ────────────────────────────────────────
  'Delhi':             { p: 94.72,  d: 87.62 },
  'New Delhi':         { p: 94.72,  d: 87.62 },
  'Noida':             { p: 94.73,  d: 87.61 },
  'Greater Noida':     { p: 94.73,  d: 87.61 },
  'Gurgaon':           { p: 95.03,  d: 87.86 },
  'Gurugram':          { p: 95.03,  d: 87.86 },
  'Faridabad':         { p: 95.15,  d: 87.98 },
  'Ghaziabad':         { p: 94.73,  d: 87.61 },

  // ── Maharashtra ───────────────────────────────────────────────────
  'Mumbai':            { p: 103.44, d: 89.97 },
  'Bombay':            { p: 103.44, d: 89.97 },
  'Navi Mumbai':       { p: 103.44, d: 89.97 },
  'Thane':             { p: 103.44, d: 89.97 },
  'Kalyan':            { p: 103.44, d: 89.97 },
  'Vasai':             { p: 103.44, d: 89.97 },
  'Pune':              { p: 104.96, d: 91.08 },
  'Pimpri-Chinchwad':  { p: 104.96, d: 91.08 },
  'Nagpur':            { p: 109.24, d: 95.02 },
  'Nashik':            { p: 104.50, d: 90.69 },
  'Aurangabad':        { p: 104.78, d: 90.95 },
  'Chhatrapati Sambhajinagar': { p: 104.78, d: 90.95 },
  'Solapur':           { p: 105.20, d: 91.35 },
  'Kolhapur':          { p: 104.10, d: 90.30 },
  'Amravati':          { p: 107.50, d: 93.40 },
  'Nanded':            { p: 104.95, d: 91.10 },

  // ── Karnataka ─────────────────────────────────────────────────────
  'Bengaluru':         { p: 102.86, d: 88.94 },
  'Bangalore':         { p: 102.86, d: 88.94 },
  'Mysuru':            { p: 102.86, d: 88.94 },
  'Mysore':            { p: 102.86, d: 88.94 },
  'Hubli':             { p: 102.86, d: 88.94 },
  'Mangaluru':         { p: 102.86, d: 88.94 },
  'Mangalore':         { p: 102.86, d: 88.94 },
  'Belagavi':          { p: 102.86, d: 88.94 },
  'Davangere':         { p: 102.86, d: 88.94 },

  // ── Tamil Nadu ────────────────────────────────────────────────────
  'Chennai':           { p: 100.75, d: 92.34 },
  'Madras':            { p: 100.75, d: 92.34 },
  'Coimbatore':        { p: 100.75, d: 92.34 },
  'Madurai':           { p: 100.75, d: 92.34 },
  'Salem':             { p: 100.75, d: 92.34 },
  'Tiruchirappalli':   { p: 100.75, d: 92.34 },
  'Tirunelveli':       { p: 100.75, d: 92.34 },
  'Erode':             { p: 100.75, d: 92.34 },
  'Vellore':           { p: 100.75, d: 92.34 },

  // ── Telangana ─────────────────────────────────────────────────────
  'Hyderabad':         { p: 107.41, d: 95.65 },
  'Secunderabad':      { p: 107.41, d: 95.65 },
  'Warangal':          { p: 107.41, d: 95.65 },
  'Nizamabad':         { p: 107.41, d: 95.65 },
  'Karimnagar':        { p: 107.41, d: 95.65 },

  // ── Andhra Pradesh ───────────────────────────────────────────────
  'Visakhapatnam':     { p: 109.41, d: 97.21 },
  'Vijayawada':        { p: 109.58, d: 97.38 },
  'Guntur':            { p: 109.48, d: 97.28 },
  'Tirupati':          { p: 109.41, d: 97.21 },
  'Kurnool':           { p: 109.41, d: 97.21 },
  'Nellore':           { p: 109.41, d: 97.21 },

  // ── Kerala ────────────────────────────────────────────────────────
  'Kochi':             { p: 102.05, d: 90.55 },
  'Cochin':            { p: 102.05, d: 90.55 },
  'Thiruvananthapuram':{ p: 102.41, d: 90.93 },
  'Trivandrum':        { p: 102.41, d: 90.93 },
  'Kozhikode':         { p: 102.43, d: 90.96 },
  'Calicut':           { p: 102.43, d: 90.96 },
  'Thrissur':          { p: 102.31, d: 90.84 },
  'Kannur':            { p: 102.43, d: 90.96 },
  'Kollam':            { p: 102.15, d: 90.65 },
  'Palakkad':          { p: 102.05, d: 90.55 },

  // ── Gujarat ───────────────────────────────────────────────────────
  'Ahmedabad':         { p: 96.63,  d: 92.38 },
  'Surat':             { p: 96.26,  d: 92.01 },
  'Vadodara':          { p: 96.38,  d: 92.15 },
  'Baroda':            { p: 96.38,  d: 92.15 },
  'Rajkot':            { p: 96.82,  d: 92.57 },
  'Bhavnagar':         { p: 96.60,  d: 92.35 },
  'Jamnagar':          { p: 96.75,  d: 92.50 },
  'Gandhinagar':       { p: 96.63,  d: 92.38 },

  // ── Rajasthan ─────────────────────────────────────────────────────
  'Jaipur':            { p: 104.88, d: 90.36 },
  'Jodhpur':           { p: 105.29, d: 90.74 },
  'Udaipur':           { p: 105.43, d: 90.88 },
  'Kota':              { p: 104.99, d: 90.48 },
  'Ajmer':             { p: 105.05, d: 90.54 },
  'Bikaner':           { p: 105.40, d: 90.84 },

  // ── Madhya Pradesh ────────────────────────────────────────────────
  'Bhopal':            { p: 108.65, d: 93.77 },
  'Indore':            { p: 108.48, d: 93.64 },
  'Gwalior':           { p: 108.08, d: 93.27 },
  'Jabalpur':          { p: 108.93, d: 94.02 },
  'Ujjain':            { p: 108.65, d: 93.77 },
  'Rewa':              { p: 108.93, d: 94.02 },

  // ── Uttar Pradesh ────────────────────────────────────────────────
  'Lucknow':           { p: 96.57,  d: 89.76 },
  'Kanpur':            { p: 96.48,  d: 89.68 },
  'Varanasi':          { p: 96.85,  d: 90.10 },
  'Agra':              { p: 96.20,  d: 89.48 },
  'Allahabad':         { p: 96.85,  d: 90.10 },
  'Prayagraj':         { p: 96.85,  d: 90.10 },
  'Meerut':            { p: 94.73,  d: 87.61 },
  'Bareilly':          { p: 96.40,  d: 89.65 },
  'Aligarh':           { p: 96.20,  d: 89.48 },
  'Gorakhpur':         { p: 96.85,  d: 90.10 },
  'Moradabad':         { p: 96.40,  d: 89.65 },

  // ── Punjab ───────────────────────────────────────────────────────
  'Amritsar':          { p: 96.94,  d: 83.67 },
  'Ludhiana':          { p: 96.80,  d: 83.55 },
  'Chandigarh':        { p: 94.24,  d: 82.40 },
  'Jalandhar':         { p: 96.83,  d: 83.57 },
  'Patiala':           { p: 96.80,  d: 83.55 },
  'Mohali':            { p: 96.80,  d: 83.55 },

  // ── Haryana ──────────────────────────────────────────────────────
  'Rohtak':            { p: 95.15,  d: 87.98 },
  'Hisar':             { p: 95.15,  d: 87.98 },
  'Panipat':           { p: 95.03,  d: 87.86 },
  'Ambala':            { p: 94.24,  d: 82.40 },

  // ── Bihar ────────────────────────────────────────────────────────
  'Patna':             { p: 107.24, d: 94.04 },
  'Gaya':              { p: 107.24, d: 94.04 },
  'Muzaffarpur':       { p: 107.24, d: 94.04 },
  'Bhagalpur':         { p: 107.24, d: 94.04 },

  // ── Jharkhand ────────────────────────────────────────────────────
  'Ranchi':            { p: 99.09,  d: 96.77 },
  'Jamshedpur':        { p: 99.09,  d: 96.77 },
  'Dhanbad':           { p: 99.09,  d: 96.77 },

  // ── Odisha ───────────────────────────────────────────────────────
  'Bhubaneswar':       { p: 103.19, d: 94.76 },
  'Cuttack':           { p: 103.29, d: 94.86 },
  'Rourkela':          { p: 103.19, d: 94.76 },

  // ── Chhattisgarh ─────────────────────────────────────────────────
  'Raipur':            { p: 102.70, d: 94.76 },
  'Bilaspur':          { p: 102.70, d: 94.76 },

  // ── West Bengal ──────────────────────────────────────────────────
  'Kolkata':           { p: 103.94, d: 90.56 },
  'Calcutta':          { p: 103.94, d: 90.56 },
  'Siliguri':          { p: 104.60, d: 91.22 },
  'Asansol':           { p: 104.05, d: 90.67 },
  'Durgapur':          { p: 104.05, d: 90.67 },
  'Howrah':            { p: 103.94, d: 90.56 },

  // ── North-East ───────────────────────────────────────────────────
  'Guwahati':          { p: 96.01,  d: 83.94 },
  'Shillong':          { p: 97.53,  d: 88.14 },
  'Agartala':          { p: 97.13,  d: 88.07 },
  'Aizawl':            { p: 101.18, d: 91.47 },
  'Imphal':            { p: 99.49,  d: 90.71 },
  'Kohima':            { p: 99.00,  d: 88.60 },
  'Dimapur':           { p: 98.50,  d: 88.10 },

  // ── Himachal Pradesh / Uttarakhand / J&K ─────────────────────────
  'Shimla':            { p: 97.50,  d: 85.60 },
  'Dehradun':          { p: 95.42,  d: 88.11 },
  'Haridwar':          { p: 95.42,  d: 88.11 },
  'Srinagar':          { p: 97.77,  d: 88.70 },
  'Jammu':             { p: 97.77,  d: 88.70 },

  // ── Goa ──────────────────────────────────────────────────────────
  'Panaji':            { p: 96.81,  d: 90.08 },
  'Panjim':            { p: 96.81,  d: 90.08 },
  'Margao':            { p: 96.81,  d: 90.08 },
  'Vasco da Gama':     { p: 96.81,  d: 90.08 },
};

// Map Indian state names → default city key for region-based fallback
const STATE_TO_CITY = {
  'Delhi':              'Delhi',
  'Haryana':            'Gurgaon',
  'Uttar Pradesh':      'Lucknow',
  'Maharashtra':        'Mumbai',
  'Karnataka':          'Bengaluru',
  'Tamil Nadu':         'Chennai',
  'Telangana':          'Hyderabad',
  'Andhra Pradesh':     'Visakhapatnam',
  'Kerala':             'Kochi',
  'Gujarat':            'Ahmedabad',
  'Rajasthan':          'Jaipur',
  'Madhya Pradesh':     'Bhopal',
  'Punjab':             'Amritsar',
  'Chandigarh':         'Chandigarh',
  'Bihar':              'Patna',
  'Jharkhand':          'Ranchi',
  'Odisha':             'Bhubaneswar',
  'West Bengal':        'Kolkata',
  'Assam':              'Guwahati',
  'Meghalaya':          'Shillong',
  'Tripura':            'Agartala',
  'Mizoram':            'Aizawl',
  'Manipur':            'Imphal',
  'Nagaland':           'Kohima',
  'Chhattisgarh':       'Raipur',
  'Himachal Pradesh':   'Shimla',
  'Uttarakhand':        'Dehradun',
  'Jammu and Kashmir':  'Srinagar',
  'Goa':                'Panaji',
};

/**
 * Returns { petrol, diesel, city } for a given city + optional state/region.
 * Tries: exact match → alias → partial → state fallback → Delhi default.
 */
export function getFuelForCity(city = '', region = '') {
  const norm = (s) => s.toLowerCase().trim();

  // 1. Exact match on city
  const exactKey = Object.keys(CITY_FUEL).find(k => norm(k) === norm(city));
  if (exactKey) return { ...CITY_FUEL[exactKey], city: exactKey };

  // 2. Substring match on city name
  const partKey = Object.keys(CITY_FUEL).find(k =>
    k !== 'Delhi' &&
    (norm(city).includes(norm(k)) || norm(k).includes(norm(city)))
  );
  if (partKey) return { ...CITY_FUEL[partKey], city: partKey };

  // 3. State/region fallback — ipapi.co returns 'region' = state name
  const stateCity = STATE_TO_CITY[region];
  if (stateCity && CITY_FUEL[stateCity]) {
    return { ...CITY_FUEL[stateCity], city: stateCity };
  }

  // 4. Partial state match
  const stateKey = Object.keys(STATE_TO_CITY).find(s =>
    norm(region).includes(norm(s)) || norm(s).includes(norm(region))
  );
  if (stateKey) {
    const sc = STATE_TO_CITY[stateKey];
    return { ...CITY_FUEL[sc], city: sc };
  }

  // 5. Delhi as final fallback
  return { ...CITY_FUEL['Delhi'], city: 'Delhi' };
}

// Format: { petrol: number, diesel: number } → rename fields for widget
export function normaliseFuel({ p, d, city }) {
  return { petrol: p, diesel: d, city };
}
