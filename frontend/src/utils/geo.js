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

export async function searchPakistanPlaces(query) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=pk&limit=5&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((item) => ({
      id: item.place_id,
      label: item.display_name,
      shortName: (item.display_name || '').split(',').slice(0, 2).join(',').trim(),
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));
  } catch {
    return [];
  }
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
