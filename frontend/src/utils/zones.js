const INTERCITY_DISTANCE = {
  'Mansehra|Abbottabad': 25,
  'Mansehra|Haripur': 60,
  'Mansehra|Battagram': 65,
  'Mansehra|Islamabad Airport': 125,
  'Abbottabad|Haripur': 40,
  'Abbottabad|Battagram': 90,
  'Abbottabad|Islamabad Airport': 115,
  'Haripur|Battagram': 125,
  'Haripur|Islamabad Airport': 70,
  'Battagram|Islamabad Airport': 185,
};

export function getZoneCity(zone) {
  if (!zone) return 'Mansehra';
  const name = zone.name || '';
  const tag = zone.area_tag || '';
  if (name.startsWith('Abbottabad —') || name.startsWith('Abbottabad (')) {
    return 'Abbottabad';
  }
  if (tag.startsWith('Abbottabad') || tag === 'Galyat Hills') return 'Abbottabad';
  if (name.startsWith('Haripur')) return 'Haripur';
  if (name.startsWith('Battagram')) return 'Battagram';
  if (name.startsWith('Islamabad') || tag === 'Airport Transfer') return 'Islamabad Airport';
  return 'Mansehra';
}

export function groupZonesByCity(zones = []) {
  const groups = {
    'Mansehra City & Tehsil': [],
    'Abbottabad City & Cantt': [],
    'Haripur · Battagram · Islamabad Airport': [],
  };

  for (const z of zones) {
    const city = getZoneCity(z);
    if (city === 'Abbottabad') {
      groups['Abbottabad City & Cantt'].push(z);
    } else if (city === 'Mansehra') {
      groups['Mansehra City & Tehsil'].push(z);
    } else {
      groups['Haripur · Battagram · Islamabad Airport'].push(z);
    }
  }

  return Object.entries(groups).filter(([, list]) => list.length > 0);
}

export function resolveSmartRoute(zones, pickupName, dropName, currentDistance, currentServiceType) {
  const p = zones?.find((z) => z.name === pickupName);
  const d = zones?.find((z) => z.name === dropName);
  if (!p || !d) return { distanceKm: null, suggestedService: null };

  const cityA = getZoneCity(p);
  const cityB = getZoneCity(d);

  if (cityA !== cityB) {
    const key1 = `${cityA}|${cityB}`;
    const key2 = `${cityB}|${cityA}`;
    const km = INTERCITY_DISTANCE[key1] ?? INTERCITY_DISTANCE[key2] ?? 45;
    return {
      distanceKm: km,
      suggestedService: km >= 40 && currentServiceType === 'bike_ride' ? 'car_ride' : null,
    };
  }

  // Same-city route: check for outer hill/tehsil towns (ignore city-center Intercity Hub entry)
  const localKm = Math.max(
    p.area_tag === 'Intercity Hub' ? 0 : p.approx_km_from_center || 0,
    d.area_tag === 'Intercity Hub' ? 0 : d.approx_km_from_center || 0
  );
  if (localKm >= 15) {
    return {
      distanceKm: Math.round(localKm),
      suggestedService: localKm >= 35 && currentServiceType === 'bike_ride' ? 'car_ride' : null,
    };
  }

  if (currentDistance > 15) {
    return { distanceKm: 4, suggestedService: null };
  }
  return { distanceKm: null, suggestedService: null };
}
