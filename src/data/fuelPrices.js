// City-wise Indian retail fuel prices (₹/litre).
// Effective as of last government revision — Indian fuel prices are set by
// oil marketing companies (BPCL/IOCL/HPCL) and change infrequently.
// Last major revision: June 2023.

export const FUEL_LAST_REVISED = 'Jun 2023';

export const CITY_FUEL = {
  // North India
  'Delhi':         { petrol: 94.72,  diesel: 87.62  },
  'New Delhi':     { petrol: 94.72,  diesel: 87.62  },
  'Chandigarh':    { petrol: 94.24,  diesel: 82.40  },
  'Noida':         { petrol: 94.73,  diesel: 87.61  },
  'Gurgaon':       { petrol: 95.03,  diesel: 87.86  },
  'Gurugram':      { petrol: 95.03,  diesel: 87.86  },
  'Faridabad':     { petrol: 95.15,  diesel: 87.98  },
  'Agra':          { petrol: 96.20,  diesel: 89.48  },
  'Lucknow':       { petrol: 96.57,  diesel: 89.76  },
  'Kanpur':        { petrol: 96.48,  diesel: 89.68  },
  'Varanasi':      { petrol: 96.85,  diesel: 90.10  },
  'Jaipur':        { petrol: 104.88, diesel: 90.36  },
  'Jodhpur':       { petrol: 105.29, diesel: 90.74  },
  'Udaipur':       { petrol: 105.43, diesel: 90.88  },
  'Amritsar':      { petrol: 96.94,  diesel: 83.67  },
  'Ludhiana':      { petrol: 96.80,  diesel: 83.55  },

  // West India
  'Mumbai':        { petrol: 103.44, diesel: 89.97  },
  'Navi Mumbai':   { petrol: 103.44, diesel: 89.97  },
  'Thane':         { petrol: 103.44, diesel: 89.97  },
  'Pune':          { petrol: 104.96, diesel: 91.08  },
  'Nagpur':        { petrol: 109.24, diesel: 95.02  },
  'Nashik':        { petrol: 104.50, diesel: 90.69  },
  'Aurangabad':    { petrol: 104.78, diesel: 90.95  },
  'Ahmedabad':     { petrol: 96.63,  diesel: 92.38  },
  'Surat':         { petrol: 96.26,  diesel: 92.01  },
  'Vadodara':      { petrol: 96.38,  diesel: 92.15  },
  'Rajkot':        { petrol: 96.82,  diesel: 92.57  },
  'Bhopal':        { petrol: 108.65, diesel: 93.77  },
  'Indore':        { petrol: 108.48, diesel: 93.64  },
  'Gwalior':       { petrol: 108.08, diesel: 93.27  },
  'Jabalpur':      { petrol: 108.93, diesel: 94.02  },
  'Raipur':        { petrol: 102.70, diesel: 94.76  },

  // South India
  'Bengaluru':     { petrol: 102.86, diesel: 88.94  },
  'Bangalore':     { petrol: 102.86, diesel: 88.94  },
  'Mysuru':        { petrol: 102.86, diesel: 88.94  },
  'Mysore':        { petrol: 102.86, diesel: 88.94  },
  'Chennai':       { petrol: 100.75, diesel: 92.34  },
  'Coimbatore':    { petrol: 100.75, diesel: 92.34  },
  'Madurai':       { petrol: 100.75, diesel: 92.34  },
  'Salem':         { petrol: 100.75, diesel: 92.34  },
  'Hyderabad':     { petrol: 107.41, diesel: 95.65  },
  'Secunderabad':  { petrol: 107.41, diesel: 95.65  },
  'Visakhapatnam': { petrol: 109.41, diesel: 97.21  },
  'Vijayawada':    { petrol: 109.58, diesel: 97.38  },
  'Kochi':         { petrol: 102.05, diesel: 90.55  },
  'Cochin':        { petrol: 102.05, diesel: 90.55  },
  'Thiruvananthapuram': { petrol: 102.41, diesel: 90.93 },
  'Kozhikode':     { petrol: 102.43, diesel: 90.96  },
  'Calicut':       { petrol: 102.43, diesel: 90.96  },
  'Thrissur':      { petrol: 102.31, diesel: 90.84  },

  // East India
  'Kolkata':       { petrol: 103.94, diesel: 90.56  },
  'Calcutta':      { petrol: 103.94, diesel: 90.56  },
  'Siliguri':      { petrol: 104.60, diesel: 91.22  },
  'Asansol':       { petrol: 104.05, diesel: 90.67  },
  'Patna':         { petrol: 107.24, diesel: 94.04  },
  'Ranchi':        { petrol: 99.09,  diesel: 96.77  },
  'Bhubaneswar':   { petrol: 103.19, diesel: 94.76  },
  'Cuttack':       { petrol: 103.29, diesel: 94.86  },
  'Guwahati':      { petrol: 96.01,  diesel: 83.94  },

  // Default (Delhi prices)
  'India':         { petrol: 94.72,  diesel: 87.62  },
};

// Fuzzy city lookup — tries exact match, then partial match
export function getFuelForCity(city) {
  if (!city) return { ...CITY_FUEL.India, city: 'Delhi' };

  // Exact match
  if (CITY_FUEL[city]) return { ...CITY_FUEL[city], city };

  // Case-insensitive exact match
  const exactKey = Object.keys(CITY_FUEL).find(
    k => k.toLowerCase() === city.toLowerCase()
  );
  if (exactKey) return { ...CITY_FUEL[exactKey], city: exactKey };

  // Partial match (city contains key or key contains city)
  const partialKey = Object.keys(CITY_FUEL).find(k =>
    k !== 'India' && (
      city.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(city.toLowerCase())
    )
  );
  if (partialKey) return { ...CITY_FUEL[partialKey], city: partialKey };

  // Fallback to Delhi
  return { ...CITY_FUEL.India, city: 'Delhi' };
}
