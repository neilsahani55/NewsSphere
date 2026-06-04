/**
 * Live fuel prices read from Supabase market_data table.
 * The market pipeline (market.js / GitHub Actions) fetches prices server-side
 * and stores them. This hook reads the latest stored values.
 *
 * Keys in market_data:
 *   petrol_{citykey}  and  diesel_{citykey}
 *   where citykey = lowercase, spaces→underscores
 *
 * Falls back to state-level default if exact city not in DB,
 * then to Delhi prices if state also missing.
 */
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useLocation } from './useLocation.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// State → representative city key stored in DB
const STATE_CITY = {
  'Maharashtra': 'mumbai', 'Karnataka': 'bengaluru', 'Tamil Nadu': 'chennai',
  'Telangana': 'hyderabad', 'Andhra Pradesh': 'hyderabad', 'Kerala': 'kochi',
  'Gujarat': 'ahmedabad', 'Rajasthan': 'jaipur', 'Madhya Pradesh': 'bhopal',
  'Uttar Pradesh': 'lucknow', 'Bihar': 'patna', 'West Bengal': 'kolkata',
  'Punjab': 'amritsar', 'Haryana': 'gurgaon', 'Odisha': 'bhubaneswar',
  'Assam': 'guwahati', 'Chhattisgarh': 'raipur', 'Jharkhand': 'ranchi',
  'Delhi': 'delhi', 'Chandigarh': 'chandigarh', 'Goa': 'panaji',
  'Uttarakhand': 'dehradun', 'Himachal Pradesh': 'shimla',
  'Jammu and Kashmir': 'srinagar', 'Manipur': 'imphal', 'Nagaland': 'kohima',
  'Meghalaya': 'shillong', 'Mizoram': 'aizawl', 'Tripura': 'agartala',
};

function cityKey(city = '') {
  return city.toLowerCase().replace(/\s+/g, '_');
}

export function useFuel() {
  const { city, region } = useLocation();
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!city && !region) return; // wait for location
    let live = true;

    async function load() {
      // Build list of keys to try: exact city → state city → delhi
      const cityK  = cityKey(city);
      const stateK = STATE_CITY[region] || '';
      const keys   = [...new Set([
        `petrol_${cityK}`, `diesel_${cityK}`,
        stateK && `petrol_${stateK}`, stateK && `diesel_${stateK}`,
        'petrol_delhi', 'diesel_delhi',
      ].filter(Boolean))];

      try {
        const { data: rows, error } = await supabase
          .from('market_data')
          .select('key, price, updated_at')
          .in('key', keys);

        if (error || !rows?.length) { if (live) setLoading(false); return; }

        const map = Object.fromEntries(rows.map(r => [r.key, r]));
        const resolve = (kind) => {
          return map[`${kind}_${cityK}`]
            || map[`${kind}_${stateK}`]
            || map[`${kind}_delhi`]
            || null;
        };

        const petrolRow  = resolve('petrol');
        const dieselRow  = resolve('diesel');

        if (live && petrolRow) {
          setData({
            petrol:    petrolRow.price,
            diesel:    dieselRow?.price ?? null,
            city:      petrolRow.key.replace('petrol_', '').replace(/_/g, ' ')
                         .replace(/\b\w/g, l => l.toUpperCase()),
            updatedAt: petrolRow.updated_at,
          });
        }
      } catch {}
      if (live) setLoading(false);
    }

    load();
    return () => { live = false; };
  }, [city, region]);

  return { data, loading };
}
