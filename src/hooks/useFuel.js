/**
 * Live city-specific fuel prices.
 * Reads from Supabase `fuel` table (populated every 6 h by the pipeline).
 *
 * Lookup order:
 *   1. Exact city match  (e.g. city_key = "mumbai")
 *   2. Any city in the same state (e.g. state_key = "maharashtra")
 *   3. Show nothing — no fake reference prices
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLocation } from './useLocation.js';

// Normalise a name to a DB key (same logic as pipeline)
function toKey(s) {
  const k = String(s ?? '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  return ({ pondicherry: 'puducherry', bombay: 'mumbai', bangalore: 'bengaluru' })[k] ?? k;
}

function toDbKey(k) { return k.replace(/\s+/g, '_'); }

// Map ipapi.co `region` → state_key used in the fuel table
const REGION_STATE = {
  'Andhra Pradesh':'andhra_pradesh','Arunachal Pradesh':'arunachal_pradesh',
  'Assam':'assam','Bihar':'bihar','Chhattisgarh':'chhattisgarh','Goa':'goa',
  'Gujarat':'gujarat','Haryana':'haryana','Himachal Pradesh':'himachal_pradesh',
  'Jharkhand':'jharkhand','Karnataka':'karnataka','Kerala':'kerala',
  'Madhya Pradesh':'madhya_pradesh','Maharashtra':'maharashtra','Manipur':'manipur',
  'Meghalaya':'meghalaya','Mizoram':'mizoram','Nagaland':'nagaland','Odisha':'odisha',
  'Punjab':'punjab','Rajasthan':'rajasthan','Sikkim':'sikkim',
  'Tamil Nadu':'tamil_nadu','Telangana':'telangana','Tripura':'tripura',
  'Uttar Pradesh':'uttar_pradesh','Uttarakhand':'uttarakhand','West Bengal':'west_bengal',
  'Delhi':'delhi','NCT of Delhi':'delhi','Chandigarh':'chandigarh',
  'Puducherry':'puducherry','Pondicherry':'puducherry',
  'Jammu and Kashmir':'jammu_and_kashmir','Jammu & Kashmir':'jammu_and_kashmir',
  'Ladakh':'ladakh','Lakshadweep':'lakshadweep',
  'Andaman and Nicobar Islands':'andaman_and_nicobar_islands',
};

function regionToState(region = '') {
  return REGION_STATE[region]
    ?? Object.entries(REGION_STATE).find(([k]) =>
        k.toLowerCase() === region.toLowerCase() ||
        region.toLowerCase().includes(k.toLowerCase())
       )?.[1]
    ?? toDbKey(toKey(region));
}

export function useFuel() {
  const { city, region } = useLocation();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!city && !region) return;
    let mounted = true;

    async function load() {
      const cityKey  = toDbKey(toKey(city || ''));
      const stateKey = regionToState(region || '');

      // 1. Exact city match
      if (cityKey) {
        const { data: row } = await supabase
          .from('fuel')
          .select('petrol, diesel, cng, city, state, updated_at')
          .eq('city_key', cityKey)
          .maybeSingle();

        if (row?.petrol && mounted) {
          setData({ petrol: row.petrol, diesel: row.diesel, cng: row.cng,
                    city: row.city, state: row.state,
                    updatedAt: row.updated_at, source: 'live' });
          setLoading(false);
          return;
        }
      }

      // 2. Any city in the same state (ordered alphabetically → most likely capital)
      if (stateKey) {
        const { data: rows } = await supabase
          .from('fuel')
          .select('petrol, diesel, cng, city, state, updated_at')
          .eq('state_key', stateKey)
          .order('city_key')
          .limit(1);

        const row = rows?.[0];
        if (row?.petrol && mounted) {
          setData({ petrol: row.petrol, diesel: row.diesel, cng: row.cng,
                    city: row.city, state: row.state,
                    updatedAt: row.updated_at, source: 'live' });
          setLoading(false);
          return;
        }
      }

      // 3. No data yet (pipeline hasn't run) — show nothing, not a fake value
      if (mounted) setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [city, region]);

  return { data, loading };
}
