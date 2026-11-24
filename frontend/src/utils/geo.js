const LOCAL_LANDMARKS = [
  { id: 'lm-pakhwal', name: 'Pakhwal Chowk, Mansehra', shortName: 'Pakhwal Chowk, Mansehra', lat: 34.3230, lng: 73.1940, zone: 'Mansehra — Pakhwal Chowk' },
  { id: 'lm-pakhal-ch', name: 'Pakhal Chowk, Mansehra', shortName: 'Pakhal Chowk, Mansehra', lat: 34.3230, lng: 73.1940, zone: 'Mansehra — Pakhwal Chowk' },
  { id: 'lm-nogazia', name: 'Nogazia Chowk, Mansehra', shortName: 'Nogazia Chowk, Mansehra', lat: 34.3270, lng: 73.1930, zone: 'Mansehra — Nogazia Chowk' },
  { id: 'lm-safdar', name: 'Safdar Road / Dab No. 1, Mansehra', shortName: 'Safdar Road, Mansehra', lat: 34.3342, lng: 73.2016, zone: 'Mansehra — Safdar Road / Dab No. 1' },
  { id: 'lm-opf', name: 'OPF Public School, Safdar Road, Mansehra', shortName: 'OPF School, Safdar Road, Mansehra', lat: 34.3350, lng: 73.2020, zone: 'Mansehra — Safdar Road / Dab No. 1' },
  { id: 'lm-punjab', name: 'Punjab Chowk, Mansehra', shortName: 'Punjab Chowk, Mansehra', lat: 34.3328, lng: 73.2008, zone: 'Mansehra — Punjab Chowk' },
  { id: 'lm-dab2', name: 'Dab No. 2 / Madina Colony, Mansehra', shortName: 'Dab No. 2, Mansehra', lat: 34.3210, lng: 73.1965, zone: 'Ghazikot Township' },
  { id: 'lm-kachehri', name: 'Kachehri / Tehsil Office, Mansehra', shortName: 'Kachehri Road, Mansehra', lat: 34.3352, lng: 73.1978, zone: 'Mansehra — Kachehri / Tehsil Road' },
  { id: 'lm-ghazi', name: 'Ghazikot Township Markaz, Mansehra', shortName: 'Ghazikot Township, Mansehra', lat: 34.3168, lng: 73.1920, zone: 'Ghazikot Township' },
  { id: 'lm-lari', name: 'Lari Adda / Main Bazar, Mansehra', shortName: 'Lari Adda / Main Bazar, Mansehra', lat: 34.3335, lng: 73.1995, zone: 'Main Bazar / Lari Adda' },
  { id: 'lm-kah', name: 'King Abdullah Teaching Hospital, Mansehra', shortName: 'King Abdullah Hospital, Mansehra', lat: 34.3275, lng: 73.1975, zone: 'King Abdullah Hospital' },
  { id: 'lm-fawara', name: 'Fawara Chowk, Main City, Abbottabad', shortName: 'Fawara Chowk, Abbottabad', lat: 34.1495, lng: 73.2145, zone: 'Abbottabad (City / Fawara Chowk)' },
  { id: 'lm-supply', name: 'Supply Bazar, Abbottabad', shortName: 'Supply Bazar, Abbottabad', lat: 34.1558, lng: 73.2185, zone: 'Abbottabad — Supply Bazar' },
  { id: 'lm-mandian', name: 'Mandian / KKH, Abbottabad', shortName: 'Mandian, Abbottabad', lat: 34.1852, lng: 73.2315, zone: 'Abbottabad — Mandian / KKH' },
  { id: 'lm-jinnahabad', name: 'Jinnahabad, Abbottabad', shortName: 'Jinnahabad, Abbottabad', lat: 34.1815, lng: 73.2412, zone: 'Abbottabad — Jinnahabad' },
  { id: 'lm-amc', name: 'Ayub Medical Complex (AMC), Abbottabad', shortName: 'Ayub Medical Complex, Abbottabad', lat: 34.1982, lng: 73.2375, zone: 'Abbottabad — Ayub Medical Complex (AMC)' },
  { id: 'lm-comsats', name: 'COMSATS University, Abbottabad', shortName: 'COMSATS, Abbottabad', lat: 34.1975, lng: 73.2435, zone: 'Abbottabad — COMSATS University / Tobe Camp' },
  { id: 'lm-pma', name: 'PMA Kakul Gate, Abbottabad', shortName: 'PMA Kakul, Abbottabad', lat: 34.1795, lng: 73.2575, zone: 'Abbottabad — PMA Kakul Road / Kakul' },
  { id: 'lm-haripur', name: 'Haripur City / GT Road', shortName: 'Haripur City', lat: 33.9978, lng: 72.9348, zone: 'Haripur (City / GT Road)' },
  { id: 'lm-battagram', name: 'Battagram City Center', shortName: 'Battagram City', lat: 34.6775, lng: 73.0255, zone: 'Battagram (City Center)' },
  { id: 'lm-isb', name: 'Islamabad International Airport (New IIA)', shortName: 'Islamabad Airport (New IIA)', lat: 33.5607, lng: 72.8516, zone: 'Islamabad Airport (New IIA)' },
];

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

export async function searchPakistanPlaces(query, zones = [], biasLat = 34.3335, biasLng = 73.1995) {
  const q = (query || '').trim().toLowerCase();
  if (q.length < 2) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const matchesText = (hay) => tokens.every((t) => hay.toLowerCase().includes(t));

  // 1. Instant local matches across landmarks & seeded DB places
  const localItems = [];
  for (const lm of LOCAL_LANDMARKS) {
    if (matchesText(`${lm.name} ${lm.zone}`)) {
      localItems.push({
        id: lm.id,
        label: lm.name,
        shortName: lm.shortName,
        lat: lm.lat,
        lng: lm.lng,
        zoneName: lm.zone,
        badge: 'Mansehra/Hazara',
      });
    }
  }
  for (const z of zones || []) {
    if (z.lat == null || z.lng == null) continue;
    if (matchesText(`${z.name} ${z.area_tag}`)) {
      localItems.push({
        id: `zone-${z.id}`,
        label: z.name,
        shortName: z.name,
        lat: z.lat,
        lng: z.lng,
        zoneName: z.name,
        badge: z.area_tag || 'Hub',
      });
    }
  }

  // 2. Live multi-provider geocoding: ArcGIS (great for Pakhwal/local Pakistani places) + Photon + Nominatim
  const remoteItems = [];
  const fetchJson = async (url) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const [arcgisData, photonData, nominatimLocal] = await Promise.all([
    fetchJson(
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&countryCode=PAK&location=${biasLng},${biasLat}&maxLocations=5&SingleLine=${encodeURIComponent(query)}`
    ),
    fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${biasLat}&lon=${biasLng}&limit=5`),
    fetchJson(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=pk&viewbox=72.5,34.9,73.9,33.4&bounded=1&limit=4&q=${encodeURIComponent(query)}`
    ),
  ]);

  if (Array.isArray(arcgisData?.candidates)) {
    for (let i = 0; i < arcgisData.candidates.length; i += 1) {
      const c = arcgisData.candidates[i];
      const lat = c.location?.y;
      const lng = c.location?.x;
      if (lat == null || lng == null || !c.address) continue;
      const distKm = haversineKm(biasLat, biasLng, lat, lng);
      remoteItems.push({
        id: `arc-${i}-${lat.toFixed(4)}`,
        label: c.address,
        shortName: c.address.split(',').slice(0, 2).join(',').trim(),
        lat: Number(lat),
        lng: Number(lng),
        badge: distKm !== null && distKm < 35 ? 'Nearby' : 'Pakistan',
        _dist: distKm ?? 999,
      });
    }
  }

  if (Array.isArray(nominatimLocal)) {
    for (const item of nominatimLocal) {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      const distKm = haversineKm(biasLat, biasLng, lat, lng);
      remoteItems.push({
        id: `nom-${item.place_id}`,
        label: item.display_name,
        shortName: (item.display_name || '').split(',').slice(0, 2).join(',').trim(),
        lat,
        lng,
        badge: 'Map Pin',
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
      if (distKm !== null && distKm > 350) continue;
      const parts = [p.name, p.street, p.city || p.county || p.state].filter(Boolean);
      const label = parts.join(', ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      remoteItems.push({
        id: `ph-${p.osm_id || `${lat}-${lon}`}`,
        label,
        shortName: parts.slice(0, 2).join(', ') || label,
        lat: Number(lat),
        lng: Number(lon),
        badge: distKm !== null && distKm < 35 ? 'Nearby' : 'Pakistan',
        _dist: distKm ?? 999,
      });
    }
  }

  remoteItems.sort((a, b) => (a._dist ?? 999) - (b._dist ?? 999));

  const combined = [...localItems, ...remoteItems];
  const seen = new Set();
  const deduped = [];
  for (const item of combined) {
    const key = `${item.shortName.toLowerCase()}-${item.lat.toFixed(3)}-${item.lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 8) break;
  }
  return deduped;
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address || {};
    const parts = [
      addr.road || addr.neighbourhood || addr.suburb || addr.village || addr.town,
      addr.city || addr.county || addr.state_district,
    ].filter(Boolean);
    return parts.length > 0
      ? parts.join(', ')
      : (data?.display_name || '').split(',').slice(0, 2).join(',').trim() || null;
  } catch {
    return null;
  }
}
