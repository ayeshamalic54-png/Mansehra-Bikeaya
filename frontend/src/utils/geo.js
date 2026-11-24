const LOCAL_LANDMARKS = [
  // === 10 Official Mansehra Chowks (Pinpoint Distinct Locations) ===
  {
    id: 'chk-punjab',
    name: 'Punjab Chowk — Shahrah-e-Resham (N-35) & Jail Road',
    shortName: 'Punjab Chowk, Mansehra',
    aliases: 'punjab chowk paracha mall dab 1 shahrah e resham kkh jail road',
    lat: 34.328548,
    lng: 73.188513,
    zone: 'Mansehra — Punjab Chowk',
    badge: 'Chowk · N-35',
  },
  {
    id: 'chk-baidra',
    name: 'Baidra Chowk — Baidra Rd & Shahrah-e-Resham (Motorway Hub)',
    shortName: 'Baidra Chowk, Mansehra',
    aliases: 'baidra chowk badra bedra motorway interchange wagons buses s-12',
    lat: 34.334342,
    lng: 73.187789,
    zone: 'Mansehra — Baidra Chowk',
    badge: 'Chowk · Motorway Hub',
  },
  {
    id: 'chk-dhangri',
    name: 'Dhangri Chowk — Main Shahrah-e-Resham (N-35)',
    shortName: 'Dhangri Chowk, Mansehra',
    aliases: 'dhangri chowk mpicc kkh commercial tijarati hub',
    lat: 34.325215,
    lng: 73.191734,
    zone: 'Mansehra — Dhangri Chowk',
    badge: 'Chowk · N-35',
  },
  {
    id: 'chk-safdar',
    name: 'Safdar Chowk — Main Shahrah-e-Resham (Banks & Plazas)',
    shortName: 'Safdar Chowk, Mansehra',
    aliases: 'safdar chowk dab 1 banks plazas commercial',
    lat: 34.330300,
    lng: 73.188400,
    zone: 'Mansehra — Safdar Chowk',
    badge: 'Chowk · Commercial',
  },
  {
    id: 'chk-shahnawaz',
    name: 'Shahnawaz Chowk — Mohalla Saienabad (Balakot/Naran Junction)',
    shortName: 'Shahnawaz Chowk, Mansehra',
    aliases: 'shahnawaz chowk saienabad sainabad balakot naran road',
    lat: 34.340333,
    lng: 73.196527,
    zone: 'Mansehra — Shahnawaz Chowk',
    badge: 'Chowk · Saienabad',
  },
  {
    id: 'chk-khatm',
    name: 'Chowk Khatm-e-Nabuwat — Kashmir Road & Inner Bazar',
    shortName: 'Chowk Khatm-e-Nabuwat, Mansehra',
    aliases: 'chowk khatm e nabuwat khatam nabuwat kashmir road bazar',
    lat: 34.333848,
    lng: 73.201123,
    zone: 'Mansehra — Chowk Khatm-e-Nabuwat',
    badge: 'Chowk · Kashmir Rd',
  },
  {
    id: 'chk-mainbazar',
    name: 'Main Chowk Bazar — Main Bazaar, Mansehra',
    shortName: 'Main Chowk Bazar, Mansehra',
    aliases: 'main chowk bazar bazaar aurangabad street old market',
    lat: 34.330769,
    lng: 73.201234,
    zone: 'Mansehra — Main Chowk Bazar',
    badge: 'Chowk · Main Bazar',
  },
  {
    id: 'chk-pakhwal',
    name: 'Pakhwal Chowk — Pakhwal Rd (Near Madina Colony & Chehra Bazar)',
    shortName: 'Pakhwal Chowk, Mansehra',
    aliases: 'pakhwal chowk pakhal chowk madina colony chehra bazar',
    lat: 34.323885,
    lng: 73.194572,
    zone: 'Mansehra — Pakhwal Chowk',
    badge: 'Chowk · Pakhwal',
  },
  {
    id: 'chk-bypass',
    name: 'Township Bypass Chowk — KKH & Ghazikot Township Bypass',
    shortName: 'Township Bypass Chowk, Mansehra',
    aliases: 'township bypass chowk ghazikot ghazi kot bypass kkh',
    lat: 34.313611,
    lng: 73.210442,
    zone: 'Mansehra — Township Bypass Chowk',
    badge: 'Chowk · Bypass',
  },
  {
    id: 'chk-phagla',
    name: 'Phagla Chowk — Mansehra–Naran Road (N-15 / Hazara Motorway Link)',
    shortName: 'Phagla Chowk, Mansehra',
    aliases: 'phagla chowk n15 n-15 hazara motorway balakot naran',
    lat: 34.407260,
    lng: 73.308950,
    zone: 'Mansehra — Phagla Chowk (N-15)',
    badge: 'Chowk · N-15',
  },

  // === Highways & Motorways ===
  {
    id: 'hwy-kkh',
    name: 'Karakoram Highway (KKH / N-35) — Shahrah-e-Resham, Mansehra',
    shortName: 'Karakoram Highway (KKH / N-35)',
    aliases: 'kkh karakoram highway n35 n-35 shahrah e resham silk road',
    lat: 34.323739,
    lng: 73.194892,
    zone: 'Mansehra — Karakoram Highway (KKH / N-35)',
    badge: 'Highway · N-35',
  },
  {
    id: 'hwy-m15',
    name: 'Hazara Motorway (M-15 / E-35) — Mansehra Interchange',
    shortName: 'Hazara Motorway (M-15 / E-35)',
    aliases: 'hazara motorway m15 m-15 e35 e-35 interchange thakot havelian',
    lat: 34.306227,
    lng: 73.191264,
    zone: 'Mansehra — Hazara Motorway (M-15 / E-35)',
    badge: 'Motorway · M-15',
  },
  {
    id: 'hwy-n15',
    name: 'Mansehra–Naran–Jalkhad Road (N-15 / Babusar Highway)',
    shortName: 'Mansehra–Naran Road (N-15)',
    aliases: 'mansehra naran jalkhad road n15 n-15 babusar kaghan balakot',
    lat: 34.346063,
    lng: 73.220614,
    zone: 'Mansehra — Naran–Jalkhad Road (N-15)',
    badge: 'Highway · N-15',
  },

  // === City Inner & Link Roads (Distinct from Chowks!) ===
  {
    id: 'rd-bypass',
    name: 'Mansehra Bypass Road (Ghazikot Township to KKH — 4.4 km)',
    shortName: 'Mansehra Bypass Road',
    aliases: 'mansehra bypass road 4.4km ghazikot kkh',
    lat: 34.330582,
    lng: 73.218097,
    zone: 'Mansehra — Mansehra Bypass Road',
    badge: 'Bypass Road',
  },
  {
    id: 'rd-kashmir',
    name: 'Kashmir Road — Inner Bazar to Muzaffarabad / Garhi Habibullah',
    shortName: 'Kashmir Road, Mansehra',
    aliases: 'kashmir road muzaffarabad garhi habibullah',
    lat: 34.336118,
    lng: 73.203858,
    zone: 'Mansehra — Kashmir Road',
    badge: 'Main Road',
  },
  {
    id: 'rd-abbottabad',
    name: 'Abbottabad Road — Old Commercial Road, Mansehra',
    shortName: 'Abbottabad Road, Mansehra',
    aliases: 'abbottabad road abbotabad commercial purana rasta',
    lat: 34.324470,
    lng: 73.202414,
    zone: 'Abbottabad Road',
    badge: 'Main Road',
  },
  {
    id: 'rd-pakhwal',
    name: 'Pakhwal Road — Madina Colony & Chehra Bazar Link, Mansehra',
    shortName: 'Pakhwal Road, Mansehra',
    aliases: 'pakhwal road madina colony chehra bazar',
    lat: 34.316127,
    lng: 73.190583,
    zone: 'Mansehra — Pakhwal Road',
    badge: 'Link Road',
  },
  {
    id: 'rd-baidra',
    name: 'Baidra Road — Baidra Chowk to Motorway Interchange & Lohar Banda',
    shortName: 'Baidra Road, Mansehra',
    aliases: 'baidra road badra bedra motorway link lohar banda',
    lat: 34.332967,
    lng: 73.194443,
    zone: 'Mansehra — Baidra Road',
    badge: 'Link Road',
  },
  {
    id: 'rd-jail',
    name: 'Jail Road — Near Punjab Chowk, District Jail & Govt Offices',
    shortName: 'Jail Road, Mansehra',
    aliases: 'jail road district jail punjab chowk govt office kachehri',
    lat: 34.331800,
    lng: 73.192000,
    zone: 'Mansehra — Jail Road',
    badge: 'City Road',
  },
  {
    id: 'rd-chinar',
    name: 'Chinar Road — Androon-e-Mansehra (Near Bus Stand)',
    shortName: 'Chinar Road, Mansehra',
    aliases: 'chinar road androon bus stand mansehra',
    lat: 34.343498,
    lng: 73.202521,
    zone: 'Mansehra — Chinar Road',
    badge: 'City Road',
  },
  {
    id: 'rd-shinkiari',
    name: 'Shinkiari Road — Mansehra to Siran Valley & Baffa',
    shortName: 'Shinkiari Road, Mansehra',
    aliases: 'shinkiari road siran valley baffa',
    lat: 34.337644,
    lng: 73.194713,
    zone: 'Shinkiari Road',
    badge: 'Main Road',
  },
  {
    id: 'rd-oghi',
    name: 'Oghi Road — Mansehra (Bherkund) to Oghi & Tanawal',
    shortName: 'Oghi Road, Mansehra',
    aliases: 'oghi road bherkund tanawal mansehra',
    lat: 34.365885,
    lng: 73.195159,
    zone: 'Mansehra — Oghi Road',
    badge: 'Link Road',
  },
  {
    id: 'rd-safdar',
    name: 'Safdar Road — Dab No. 1, OPF School & Commercial Markets',
    shortName: 'Safdar Road, Mansehra',
    aliases: 'safdar road dab 1 dub 1 opf public school safdar chowk',
    lat: 34.332400,
    lng: 73.190800,
    zone: 'Mansehra — Safdar Road / Dab No. 1',
    badge: 'City Road',
  },

  // === Popular Mansehra City Landmarks & Terminals ===
  {
    id: 'lm-paracha',
    name: 'Paracha Mall — Main Shahrah-e-Resham (Near Punjab Chowk)',
    shortName: 'Paracha Mall, Mansehra',
    aliases: 'paracha mall zellbury ecs punjab chowk',
    lat: 34.329100,
    lng: 73.189000,
    zone: 'Mansehra — Punjab Chowk',
    badge: 'Mall / Landmark',
  },
  {
    id: 'lm-madina',
    name: 'Madina Colony / Dab No. 2 — Pakhwal Rd, Mansehra',
    shortName: 'Madina Colony / Dab No. 2',
    aliases: 'madina colony dab 2 dub 2 shell pump',
    lat: 34.318579,
    lng: 73.196106,
    zone: 'Mansehra — Pakhwal Road',
    badge: 'Residential',
  },
  {
    id: 'lm-chehra',
    name: 'Chehra Bazar — Near Pakhwal Road, Mansehra',
    shortName: 'Chehra Bazar, Mansehra',
    aliases: 'chehra bazar pakhwal road',
    lat: 34.320800,
    lng: 73.192800,
    zone: 'Mansehra — Pakhwal Road',
    badge: 'Bazar',
  },
  {
    id: 'lm-saienabad',
    name: 'Mohalla Saienabad — Near Shahnawaz Chowk, Mansehra',
    shortName: 'Mohalla Saienabad, Mansehra',
    aliases: 'mohalla saienabad sainabad shahnawaz chowk',
    lat: 34.339100,
    lng: 73.197200,
    zone: 'Mansehra — Shahnawaz Chowk',
    badge: 'Residential',
  },
  {
    id: 'lm-nogazia',
    name: 'Nogazia Chowk, Mansehra',
    shortName: 'Nogazia Chowk, Mansehra',
    aliases: 'nogazia chowk mansehra',
    lat: 34.327000,
    lng: 73.193000,
    zone: 'Mansehra — Nogazia Chowk',
    badge: 'Chowk',
  },
  {
    id: 'lm-kachehri',
    name: 'Kachehri / Tehsil Office, Mansehra',
    shortName: 'Kachehri Road, Mansehra',
    aliases: 'kachehri court tehsil office jail road',
    lat: 34.335200,
    lng: 73.197800,
    zone: 'Mansehra — Kachehri / Tehsil Road',
    badge: 'Govt Hub',
  },
  {
    id: 'lm-ghazi',
    name: 'Ghazikot Township Markaz, Mansehra',
    shortName: 'Ghazikot Township, Mansehra',
    aliases: 'ghazikot township markaz sector',
    lat: 34.316800,
    lng: 73.192000,
    zone: 'Ghazikot Township',
    badge: 'Township',
  },
  {
    id: 'lm-lari',
    name: 'Lari Adda / Main Bazar, Mansehra',
    shortName: 'Lari Adda / Main Bazar, Mansehra',
    aliases: 'lari adda main bazar city center',
    lat: 34.333500,
    lng: 73.199500,
    zone: 'Main Bazar / Lari Adda',
    badge: 'City Core',
  },
  {
    id: 'lm-busstand',
    name: 'Mansehra General Bus Stand & Faisal Movers (KKH)',
    shortName: 'Mansehra Bus Stand / Faisal Movers',
    aliases: 'bus stand faisal movers sabzi mandi adda',
    lat: 34.345770,
    lng: 73.198109,
    zone: 'Mansehra — Sabzi Mandi / GT Bypass',
    badge: 'Terminal',
  },
  {
    id: 'lm-kah',
    name: 'King Abdullah Teaching Hospital, Mansehra',
    shortName: 'King Abdullah Hospital, Mansehra',
    aliases: 'king abdullah hospital dhq medical',
    lat: 34.327500,
    lng: 73.197500,
    zone: 'King Abdullah Hospital',
    badge: 'Hospital',
  },
  {
    id: 'lm-hu',
    name: 'Hazara University (Dhodial), Mansehra',
    shortName: 'Hazara University, Dhodial',
    aliases: 'hazara university dhodial campus',
    lat: 34.432800,
    lng: 73.261000,
    zone: 'Hazara University (Dhodial)',
    badge: 'University',
  },
  {
    id: 'lm-sabzi',
    name: 'Sabzi Mandi Mansehra (KKH)',
    shortName: 'Sabzi Mandi, Mansehra',
    aliases: 'sabzi mandi fruit market',
    lat: 34.348123,
    lng: 73.198128,
    zone: 'Mansehra — Sabzi Mandi / GT Bypass',
    badge: 'Market',
  },

  // === Abbottabad, Intercity & Airport Hubs ===
  {
    id: 'lm-fawara',
    name: 'Fawara Chowk, Main City, Abbottabad',
    shortName: 'Fawara Chowk, Abbottabad',
    aliases: 'abbottabad fawara chowk city',
    lat: 34.1495,
    lng: 73.2145,
    zone: 'Abbottabad (City / Fawara Chowk)',
    badge: 'Abbottabad',
  },
  {
    id: 'lm-supply',
    name: 'Supply Bazar, Abbottabad',
    shortName: 'Supply Bazar, Abbottabad',
    aliases: 'supply bazar abbottabad',
    lat: 34.1558,
    lng: 73.2185,
    zone: 'Abbottabad — Supply Bazar',
    badge: 'Abbottabad',
  },
  {
    id: 'lm-mandian',
    name: 'Mandian / KKH, Abbottabad',
    shortName: 'Mandian, Abbottabad',
    aliases: 'mandian abbottabad kkh',
    lat: 34.1852,
    lng: 73.2315,
    zone: 'Abbottabad — Mandian / KKH',
    badge: 'Abbottabad',
  },
  {
    id: 'lm-jinnahabad',
    name: 'Jinnahabad, Abbottabad',
    shortName: 'Jinnahabad, Abbottabad',
    aliases: 'jinnahabad abbottabad',
    lat: 34.1815,
    lng: 73.2412,
    zone: 'Abbottabad — Jinnahabad',
    badge: 'Abbottabad',
  },
  {
    id: 'lm-amc',
    name: 'Ayub Medical Complex (AMC), Abbottabad',
    shortName: 'Ayub Medical Complex, Abbottabad',
    aliases: 'ayub medical complex amc hospital abbottabad',
    lat: 34.1982,
    lng: 73.2375,
    zone: 'Abbottabad — Ayub Medical Complex (AMC)',
    badge: 'Hospital',
  },
  {
    id: 'lm-comsats',
    name: 'COMSATS University, Abbottabad',
    shortName: 'COMSATS, Abbottabad',
    aliases: 'comsats university tobe camp abbottabad',
    lat: 34.1975,
    lng: 73.2435,
    zone: 'Abbottabad — COMSATS University / Tobe Camp',
    badge: 'University',
  },
  {
    id: 'lm-pma',
    name: 'PMA Kakul Gate, Abbottabad',
    shortName: 'PMA Kakul, Abbottabad',
    aliases: 'pma kakul academy abbottabad',
    lat: 34.1795,
    lng: 73.2575,
    zone: 'Abbottabad — PMA Kakul Road / Kakul',
    badge: 'Abbottabad',
  },
  {
    id: 'lm-haripur',
    name: 'Haripur City / GT Road',
    shortName: 'Haripur City',
    aliases: 'haripur city gt road',
    lat: 33.9978,
    lng: 72.9348,
    zone: 'Haripur (City / GT Road)',
    badge: 'Intercity',
  },
  {
    id: 'lm-battagram',
    name: 'Battagram City Center',
    shortName: 'Battagram City',
    aliases: 'battagram city',
    lat: 34.6775,
    lng: 73.0255,
    zone: 'Battagram (City Center)',
    badge: 'Intercity',
  },
  {
    id: 'lm-isb',
    name: 'Islamabad International Airport (New IIA)',
    shortName: 'Islamabad Airport (New IIA)',
    aliases: 'islamabad international airport iia rawalpindi',
    lat: 33.5607,
    lng: 72.8516,
    zone: 'Islamabad Airport (New IIA)',
    badge: 'Airport',
  },
];

export const TOP_MANSEHRA_QUICK_SPOTS = [
  'chk-punjab',
  'chk-baidra',
  'rd-baidra',
  'rd-safdar',
  'chk-pakhwal',
  'chk-mainbazar',
]
  .map((id) => LOCAL_LANDMARKS.find((lm) => lm.id === id))
  .filter(Boolean);

export function haversineKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v === null || v === undefined || Number.isNaN(Number(v)))) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function estimateRoadKmFallback(lat1, lng1, lat2, lng2) {
  const straight = haversineKm(lat1, lng1, lat2, lng2);
  if (straight === null) return null;
  if (straight < 0.15) return 1.0;
  const road = straight * 1.32;
  return Math.max(1.0, Math.round(road * 2) / 2);
}

export function findNearestZone(lat, lng, zones = []) {
  let best = null;
  let bestDist = Infinity;
  for (const z of zones) {
    if (z.lat == null || z.lng == null) continue;
    const d = haversineKm(lat, lng, z.lat, z.lng);
    if (d !== null && d < bestDist) {
      bestDist = d;
      best = z;
    }
  }
  return best;
}

export async function fetchRoadRoute(lat1, lng1, lat2, lng2, signal) {
  const fbDist = estimateRoadKmFallback(lat1, lng1, lat2, lng2) ?? 3.0;
  const fallback = {
    distanceKm: fbDist,
    durationMin: Math.max(4, Math.round(fbDist * 2.5)),
    coords: [
      [lat1, lng1],
      [lat2, lng2],
    ],
    source: 'estimate',
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route || !route.distance) return fallback;
    const km = Math.max(0.5, Math.round((route.distance / 1000) * 10) / 10);
    const mins = Math.max(2, Math.round((route.duration || 0) / 60));
    const coords = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
    return {
      distanceKm: km,
      durationMin: mins,
      coords: coords.length >= 2 ? coords : fallback.coords,
      source: 'osrm',
    };
  } catch {
    return fallback;
  }
}

function norm(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreMatch(title, hay, qNorm, tokens) {
  const tNorm = norm(title);
  const hNorm = norm(hay);
  if (!tokens.every((t) => hNorm.includes(t))) return -1;
  if (tNorm === qNorm) return 220;
  if (tNorm.startsWith(qNorm)) return 160;
  if (tNorm.includes(qNorm)) return 120;
  if (hNorm.includes(qNorm)) return 80;
  return 40;
}

export async function searchPakistanPlaces(query, zones = [], biasLat = 34.3335, biasLng = 73.1995) {
  const qNorm = norm(query);
  if (qNorm.length < 2) return [];

  const tokens = qNorm.split(/\s+/).filter(Boolean);
  const localItems = [];

  for (const lm of LOCAL_LANDMARKS) {
    const sc = scoreMatch(lm.shortName, `${lm.name} ${lm.shortName} ${lm.aliases || ''} ${lm.zone}`, qNorm, tokens);
    if (sc < 0) continue;
    localItems.push({
      id: lm.id,
      label: lm.name,
      shortName: lm.shortName,
      lat: lm.lat,
      lng: lm.lng,
      zoneName: lm.zone,
      badge: lm.badge || 'Mansehra',
      _score: sc + 20, // Prefer rich curated Chowk/Road entries cleanly
    });
  }

  for (const z of zones || []) {
    if (z.lat == null || z.lng == null) continue;
    const sc = scoreMatch(z.name, `${z.name} ${z.area_tag || ''}`, qNorm, tokens);
    if (sc < 0) continue;
    localItems.push({
      id: `zone-${z.id}`,
      label: z.name,
      shortName: z.name,
      lat: z.lat,
      lng: z.lng,
      zoneName: z.name,
      badge: z.area_tag || 'Hub',
      _score: sc,
    });
  }

  localItems.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

  // If verified Mansehra / Hazara index already found strong local hits, return immediately without distant noise!
  const bestLocalScore = localItems[0]?._score ?? 0;
  if (localItems.length >= 2 || bestLocalScore >= 100) {
    const dedupedLocal = [];
    const seenCoords = new Set();
    for (const item of localItems) {
      const coordKey = `${item.lat.toFixed(4)},${item.lng.toFixed(4)}`;
      if (seenCoords.has(coordKey)) continue;
      seenCoords.add(coordKey);
      dedupedLocal.push(item);
      if (dedupedLocal.length >= 8) break;
    }
    return dedupedLocal;
  }

  // Intercity query check: only allow > 55 km remote hits when the user actually named an outside city/airport
  const isIntercityQuery = /\b(islamabad|airport|iia|rawalpindi|lahore|peshawar|haripur|battagram|abbottabad|balakot|naran|kaghan|nathia|taxila|havelian)\b/.test(qNorm);
  const maxRemoteKm = isIntercityQuery ? 250 : 48;

  const remoteItems = [];
  const fetchJson = async (url) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3200);
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  // Query Nominatim bounded strictly to Hazara / Mansehra region unless intercity keyword was typed
  const viewbox = isIntercityQuery ? '72.6,34.8,73.7,33.4' : '72.95,34.65,73.45,33.95';
  const [nominatimLocal, arcgisData, photonData] = await Promise.all([
    fetchJson(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=pk&viewbox=${viewbox}&bounded=1&limit=5&q=${encodeURIComponent(query)}`
    ),
    fetchJson(
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&countryCode=PAK&location=${biasLng},${biasLat}&maxLocations=5&SingleLine=${encodeURIComponent(query)}`
    ),
    fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${biasLat}&lon=${biasLng}&limit=5`),
  ]);

  if (Array.isArray(nominatimLocal)) {
    for (const item of nominatimLocal) {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      const distKm = haversineKm(biasLat, biasLng, lat, lng);
      if (distKm !== null && distKm > maxRemoteKm) continue;
      remoteItems.push({
        id: `nom-${item.place_id}`,
        label: item.display_name,
        shortName: (item.display_name || '').split(',').slice(0, 2).join(',').trim(),
        lat,
        lng,
        badge: distKm !== null && distKm < 15 ? 'Mansehra OSM' : 'Hazara OSM',
        _dist: distKm ?? 999,
      });
    }
  }

  if (Array.isArray(arcgisData?.candidates)) {
    for (let i = 0; i < arcgisData.candidates.length; i += 1) {
      const c = arcgisData.candidates[i];
      const lat = c.location?.y;
      const lng = c.location?.x;
      if (lat == null || lng == null || !c.address) continue;
      // Ignore generic whole-city centroid guesses from ArcGIS (34.33023, 73.19679)
      if (Math.abs(lat - 34.33023) < 0.0005 && Math.abs(lng - 73.19679) < 0.0005) continue;
      const distKm = haversineKm(biasLat, biasLng, lat, lng);
      if (distKm !== null && distKm > maxRemoteKm) continue;
      remoteItems.push({
        id: `arc-${i}-${lat.toFixed(4)}`,
        label: c.address,
        shortName: c.address.split(',').slice(0, 2).join(',').trim(),
        lat: Number(lat),
        lng: Number(lng),
        badge: distKm !== null && distKm < 15 ? 'Nearby' : 'Hazara',
        _dist: distKm ?? 999,
      });
    }
  }

  if (photonData?.features) {
    for (const f of photonData.features) {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates || [];
      const [lon, lat] = coords;
      if (lat == null || lon == null) continue;
      if (p.countrycode && p.countrycode !== 'PK') continue;
      const distKm = haversineKm(biasLat, biasLng, lat, lon);
      if (distKm !== null && distKm > maxRemoteKm) continue;
      const parts = [p.name, p.street, p.city || p.county || p.state].filter(Boolean);
      const label = parts.join(', ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      remoteItems.push({
        id: `ph-${p.osm_id || `${lat}-${lon}`}`,
        label,
        shortName: parts.slice(0, 2).join(', ') || label,
        lat: Number(lat),
        lng: Number(lon),
        badge: distKm !== null && distKm < 15 ? 'Nearby' : 'Hazara',
        _dist: distKm ?? 999,
      });
    }
  }

  remoteItems.sort((a, b) => (a._dist ?? 999) - (b._dist ?? 999));

  const combined = [...localItems, ...remoteItems];
  const seen = new Set();
  const deduped = [];
  for (const item of combined) {
    const key = `${norm(item.shortName)}-${item.lat.toFixed(3)}-${item.lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 8) break;
  }
  return deduped;
}

export async function reverseGeocode(lat, lng) {
  // Check verified Mansehra / Hazara landmarks first (accurate local naming within 180m)
  let closest = null;
  let closestDist = Infinity;
  for (const lm of LOCAL_LANDMARKS) {
    const d = haversineKm(lat, lng, lm.lat, lm.lng);
    if (d !== null && d < closestDist) {
      closestDist = d;
      closest = lm;
    }
  }
  if (closest && closestDist <= 0.18) {
    return closest.shortName;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return closest && closestDist < 3 ? `Near ${closest.shortName}` : null;
    const data = await res.json();
    const addr = data?.address || {};
    const roadRaw = addr.road || addr.neighbourhood || addr.suburb || addr.village || addr.town;
    const roadClean = roadRaw && !/unnamed/i.test(roadRaw) ? roadRaw : null;
    const parts = [roadClean, addr.city || addr.county || addr.state_district].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    if (closest && closestDist < 3) return `Near ${closest.shortName}`;
    return (data?.display_name || '').split(',').slice(0, 2).join(',').trim() || null;
  } catch {
    return closest && closestDist < 3 ? `Near ${closest.shortName}` : null;
  }
}
