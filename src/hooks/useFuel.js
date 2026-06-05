/**
 * Live Indian fuel prices — calls our Vercel function /api/fuel which
 * scrapes goodreturns.in (petrol/diesel/cng state tables) server-side.
 *
 * Flow:
 *  1. Show reference prices immediately (no blank state)
 *  2. Call /api/fuel (same-origin, 1-hour CDN cache on Vercel)
 *  3. Vercel function scrapes goodreturns.in and returns all states as JSON
 *  4. Pick the detected state's prices and update display
 */

import { useEffect, useState } from 'react';
import { useLocation } from './useLocation.js';

// Map ipapi.co region → state key
const REGION_KEY = {
  'Andhra Pradesh':'andhra_pradesh','Arunachal Pradesh':'arunachal_pradesh',
  'Assam':'assam','Bihar':'bihar','Chhattisgarh':'chhattisgarh','Goa':'goa',
  'Gujarat':'gujarat','Haryana':'haryana','Himachal Pradesh':'himachal_pradesh',
  'Jharkhand':'jharkhand','Karnataka':'karnataka','Kerala':'kerala',
  'Madhya Pradesh':'madhya_pradesh','Maharashtra':'maharashtra','Manipur':'manipur',
  'Meghalaya':'meghalaya','Mizoram':'mizoram','Nagaland':'nagaland',
  'Odisha':'odisha','Orissa':'odisha','Punjab':'punjab','Rajasthan':'rajasthan',
  'Sikkim':'sikkim','Tamil Nadu':'tamil_nadu','Telangana':'telangana',
  'Tripura':'tripura','Uttar Pradesh':'uttar_pradesh','Uttarakhand':'uttarakhand',
  'Uttaranchal':'uttarakhand','West Bengal':'west_bengal',
  'Delhi':'delhi','NCT of Delhi':'delhi','Chandigarh':'chandigarh',
  'Puducherry':'puducherry','Pondicherry':'puducherry',
  'Jammu and Kashmir':'jammu_and_kashmir','Jammu & Kashmir':'jammu_and_kashmir',
  'Ladakh':'ladakh','Lakshadweep':'lakshadweep',
  'Andaman and Nicobar Islands':'andaman_and_nicobar_islands',
};

// Inline reference prices (shown while /api/fuel loads)
const REF = {
  delhi:{p:94.72,d:87.62},maharashtra:{p:111.18,d:97.83},
  karnataka:{p:104.45,d:90.30},tamil_nadu:{p:100.75,d:92.34},
  telangana:{p:109.18,d:97.42},andhra_pradesh:{p:111.19,d:97.21},
  kerala:{p:102.05,d:90.55},gujarat:{p:96.63,d:92.38},
  rajasthan:{p:106.55,d:91.98},madhya_pradesh:{p:110.48,d:95.46},
  uttar_pradesh:{p:96.57,d:89.76},bihar:{p:107.24,d:94.04},
  west_bengal:{p:104.25,d:91.19},punjab:{p:98.20,d:84.44},
  haryana:{p:95.61,d:88.45},odisha:{p:103.19,d:94.76},
  assam:{p:96.45,d:84.10},jharkhand:{p:99.09,d:96.77},
  chandigarh:{p:94.24,d:82.40},goa:{p:96.81,d:90.08},
  chhattisgarh:{p:105.36,d:96.57},uttarakhand:{p:95.42,d:88.11},
  himachal_pradesh:{p:97.50,d:85.60},jammu_and_kashmir:{p:97.77,d:88.70},
  puducherry:{p:98.30,d:90.50},manipur:{p:99.49,d:90.71},
  meghalaya:{p:97.53,d:88.14},tripura:{p:97.13,d:88.07},
  mizoram:{p:101.18,d:91.47},nagaland:{p:99.00,d:88.60},
  arunachal_pradesh:{p:97.43,d:84.12},sikkim:{p:102.50,d:89.60},
  ladakh:{p:100.30,d:88.70},
};

const DEFAULT = {p:94.72,d:87.62};

function regionToKey(region='') {
  if (REGION_KEY[region]) return REGION_KEY[region];
  const lower = region.toLowerCase();
  const match = Object.entries(REGION_KEY).find(([k]) =>
    k.toLowerCase()===lower || lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  );
  return match?.[1] ?? 'delhi';
}

export function useFuel() {
  const { city, region } = useLocation();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!region && !city) return;
    let mounted = true;

    async function load() {
      const stateKey = regionToKey(region);
      const ref = REF[stateKey] ?? DEFAULT;
      const displayCity = city || stateKey.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());

      // Step 1: Show reference prices immediately
      if (mounted) {
        setData({ petrol: ref.p, diesel: ref.d, cng: null, city: displayCity, source: 'reference' });
        setLoading(false);
      }

      // Step 2: Call /api/fuel — Vercel scrapes goodreturns.in server-side
      try {
        const res = await fetch('/api/fuel', { signal: AbortSignal.timeout(15000) });
        if (!res.ok) return;
        const json = await res.json();

        const stateData = json[stateKey];
        if (stateData?.petrol && mounted) {
          setData({
            petrol: Number(stateData.petrol),
            diesel: stateData.diesel ? Number(stateData.diesel) : null,
            cng:    stateData.cng    ? Number(stateData.cng)    : null,
            city:   displayCity,
            source: json._source || 'live',
          });
        }
      } catch (e) {
        console.warn('[useFuel] API error:', e.message);
        // Reference prices from step 1 remain displayed
      }
    }

    load();
    return () => { mounted = false; };
  }, [city, region]);

  return { data, loading };
}
