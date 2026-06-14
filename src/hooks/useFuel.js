/**
 * Live city-specific fuel prices.
 * Reads from Supabase `fuel` table (populated every 6 h by the pipeline).
 *
 * Lookup order:
 *   1. Exact city match  (e.g. city_key = "mumbai")
 *   2. Any city in the same state
 *   3. Fallback to New Delhi when state data is unavailable
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { INDIA_DEFAULT, useLocation } from './useLocation.js';

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
    ?? Object.entries(REGION_STATE).find(([key]) =>
      key.toLowerCase() === region.toLowerCase() ||
      region.toLowerCase().includes(key.toLowerCase())
    )?.[1]
    ?? toDbKey(toKey(region));
}

async function loadFuelRow(cityKeys) {
  const keys = cityKeys.filter(Boolean);
  if (keys.length === 0) return null;

  const { data: rows } = await supabase
    .from('fuel')
    .select('city_key, petrol, diesel, cng, city, state, updated_at')
    .in('city_key', keys);

  return keys
    .map((key) => rows?.find((row) => row.city_key === key))
    .find((row) => row?.petrol) ?? null;
}

export function useFuel() {
  const { city, region } = useLocation();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!city && !region) return;
    let mounted = true;

    async function load() {
      const cityKey = toDbKey(toKey(city || ''));
      const stateKey = regionToState(region || '');
      const fallbackKey = toDbKey(toKey(INDIA_DEFAULT.city));
      let source = 'fallback';

      let row = await loadFuelRow([cityKey]);
      if (row?.petrol) {
        source = 'live';
      } else if (stateKey) {
        const { data: rows } = await supabase
          .from('fuel')
          .select('city_key, petrol, diesel, cng, city, state, updated_at')
          .eq('state_key', stateKey)
          .order('city_key')
          .limit(1);
        row = rows?.find((entry) => entry?.petrol) ?? null;
        if (row?.petrol) source = 'state';
      }

      if (!row?.petrol) {
        const fallbackKeys = [fallbackKey, toDbKey(toKey('Delhi'))];
        row = await loadFuelRow(fallbackKeys);
        if (row?.petrol) source = 'fallback';
      }

      if (row?.petrol && mounted) {
        setData({
          petrol: row.petrol,
          diesel: row.diesel,
          cng: row.cng,
          city: row.city,
          state: row.state,
          updatedAt: row.updated_at,
          source,
        });
        setLoading(false);
        return;
      }

      if (mounted) setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [city, region]);

  return { data, loading };
}
