import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safePhotoUrl(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (
    val.startsWith('data:image/') ||
    val.startsWith('https://') ||
    val.startsWith('http://') ||
    val.startsWith('/')
  ) {
    return val.replace(/["'<>]/g, '');
  }
  return '';
}

function makePinIcon(bg, badge, subtitle) {
  return L.divIcon({
    className: 'safargo-div-icon',
    iconSize: [34, 42],
    iconAnchor: [17, 38],
    popupAnchor: [0, -34],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:30px;height:30px;border-radius:9999px;background:${bg};color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(15,23,42,0.32);">
          ${esc(badge)}
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${bg};margin-top:-2px;"></div>
        ${subtitle ? `<div style="margin-top:2px;padding:1px 6px;border-radius:9999px;background:rgba(15,23,42,0.85);color:#fff;font-size:10px;font-weight:700;white-space:nowrap;">${esc(subtitle)}</div>` : ''}
      </div>
    `,
  });
}

function makeCaptainIcon(c, isSelected = false) {
  const isCar = c.vehicle_type === 'car';
  const online = c.is_online !== false;
  const bg = !online ? '#64748B' : isCar ? '#0284C7' : '#009E4D';
  const dot = online ? '#4ADE80' : '#CBD5E1';
  const photoUrl = safePhotoUrl(c.rider_photo);
  const shortName = esc((c.full_name || c.display_name || (isCar ? 'CAR' : 'BIKE')).split(' ')[0]);
  const ring = isSelected ? '#F59E0B' : bg;

  if (photoUrl) {
    return L.divIcon({
      className: 'safargo-div-icon',
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -20],
      html: `
        <div style="position:relative;width:38px;height:38px;">
          <div style="width:36px;height:36px;border-radius:9999px;border:3px solid ${ring};background-color:#ffffff;background-image:url('${photoUrl}');background-size:cover;background-position:center;box-shadow:0 3px 10px rgba(15,23,42,0.38);overflow:hidden;">
            <img src="${photoUrl}" alt="${shortName}" style="width:30px;height:30px;min-width:30px;min-height:30px;border-radius:9999px;object-fit:cover;display:block;" />
          </div>
          <span style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:9999px;background:${dot};border:2px solid #fff;"></span>
        </div>
      `,
    });
  }

  const glyph = isCar
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;

  return L.divIcon({
    className: 'safargo-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    html: `
      <div style="position:relative;width:32px;height:32px;border-radius:9999px;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;border:2.5px solid ${isSelected ? '#F59E0B' : '#fff'};box-shadow:0 3px 10px rgba(15,23,42,0.28);">
        ${glyph}
        <span style="position:absolute;bottom:-1px;right:-1px;width:9px;height:9px;border-radius:9999px;background:${dot};border:1.5px solid #fff;"></span>
      </div>
    `,
  });
}

function getCaptainKey(c, fallbackIdx = 0) {
  return String(c?.id ?? c?.rider_id ?? c?.phone ?? fallbackIdx);
}

function resolveMinHeightPx(heightClass) {
  const match = String(heightClass || '').match(/h-\[(\d+)px\]/);
  if (match) return Number(match[1]);
  if (String(heightClass).includes('h-72')) return 288;
  if (String(heightClass).includes('h-64')) return 256;
  if (String(heightClass).includes('h-60')) return 240;
  if (String(heightClass).includes('h-56')) return 224;
  if (String(heightClass).includes('h-48')) return 192;
  if (String(heightClass).includes('h-44')) return 176;
  if (String(heightClass).includes('h-40')) return 160;
  return 240;
}

function getSpreadPosition(c, idx, allList) {
  let duplicatesBefore = 0;
  for (let i = 0; i < idx; i += 1) {
    const other = allList[i];
    if (
      Math.abs(Number(other.lat) - Number(c.lat)) < 0.00018 &&
      Math.abs(Number(other.lng) - Number(c.lng)) < 0.00018
    ) {
      duplicatesBefore += 1;
    }
  }
  if (duplicatesBefore === 0) return [Number(c.lat), Number(c.lng)];
  const angle = duplicatesBefore * 2.39996; // golden angle in radians
  const radius = 0.00028 * Math.sqrt(duplicatesBefore);
  return [
    Number(c.lat) + radius * Math.sin(angle),
    Number(c.lng) + radius * Math.cos(angle),
  ];
}

export function SafarGoMap({
  pickup = null,
  drop = null,
  routeCoords = null,
  routeSource = 'estimate',
  captains = [],
  activeBookings = [],
  sosAlerts = [],
  interactive = false,
  activePinMode = 'pickup',
  onMapPick = null,
  onPinDrag = null,
  heightClass = 'h-64 sm:h-72',
  fitSignature = '',
  showCaptainSidebar = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const baseLayersRef = useRef(null);
  const [mapStyle, setMapStyle] = useState('street'); // street | satellite
  const [selectedKey, setSelectedKey] = useState(null);
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetFilter, setFleetFilter] = useState('all'); // all | online | bike | car
  const callbacksRef = useRef({ interactive, activePinMode, onMapPick, onPinDrag });
  callbacksRef.current = { interactive, activePinMode, onMapPick, onPinDrag };

  const visibleCaptains = (captains || []).filter((c) => c && c.lat != null && c.lng != null);
  const defaultCaptain =
    visibleCaptains.find((c) => Boolean(safePhotoUrl(c.rider_photo))) || visibleCaptains[0] || null;
  const activeCaptain =
    visibleCaptains.find((c, i) => getCaptainKey(c, i) === selectedKey) || defaultCaptain;
  const activeCaptainKey = activeCaptain
    ? getCaptainKey(activeCaptain, visibleCaptains.indexOf(activeCaptain))
    : null;
  const hasSidebar = showCaptainSidebar && visibleCaptains.length > 0;

  const filteredRoster = visibleCaptains.filter((c) => {
    if (fleetFilter === 'online' && c.is_online === false) return false;
    if (fleetFilter === 'bike' && (c.vehicle_type || 'bike') !== 'bike') return false;
    if (fleetFilter === 'car' && c.vehicle_type !== 'car') return false;
    const q = fleetSearch.trim().toLowerCase();
    if (!q) return true;
    return [c.full_name, c.display_name, c.bike_plate, c.bike_model, c.zone_name]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center = pickup?.lat && pickup?.lng ? [pickup.lat, pickup.lng] : [34.3335, 73.1995];
    const map = L.map(containerRef.current, {
      center,
      zoom: 13,
      zoomControl: true,
    });

    // Primary: OpenStreetMap street tiles (detailed Mansehra roads & chowks, 0 watermarks)
    // Auto-failover: Esri World Street Map CDN if OSM tiles fail on any mobile network
    const streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    });
    const backupStreetLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri &amp; Contributors', maxZoom: 19 }
    );
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri World Imagery', maxZoom: 19 }
    );
    const satelliteLabels = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    );
    const satelliteRoads = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    );

    let activeStreetLayer = streetLayer;
    let errCount = 0;
    streetLayer.on('tileerror', () => {
      errCount += 1;
      if (errCount >= 4 && map.hasLayer(streetLayer) && !map.hasLayer(satelliteLayer)) {
        map.removeLayer(streetLayer);
        backupStreetLayer.addTo(map);
        activeStreetLayer = backupStreetLayer;
      }
    });

    activeStreetLayer.addTo(map);
    baseLayersRef.current = {
      getActiveStreet: () => activeStreetLayer,
      streetLayer,
      backupStreetLayer,
      satelliteLayer,
      satelliteLabels,
      satelliteRoads,
    };

    const group = L.layerGroup().addTo(map);
    map.on('click', (ev) => {
      const cb = callbacksRef.current;
      if (cb.interactive && cb.onMapPick) {
        cb.onMapPick(cb.activePinMode, ev.latlng.lat, ev.latlng.lng);
      }
    });

    mapRef.current = map;
    layerRef.current = group;

    const triggerInvalidate = () => {
      try {
        map.invalidateSize({ pan: false });
      } catch {
        // ignore if unmounted
      }
    };
    map.whenReady(() => setTimeout(triggerInvalidate, 60));
    const timer1 = setTimeout(triggerInvalidate, 180);
    const timer2 = setTimeout(triggerInvalidate, 550);
    window.addEventListener('resize', triggerInvalidate);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => triggerInvalidate());
      ro.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', triggerInvalidate);
      if (ro) ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      baseLayersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = baseLayersRef.current;
    if (!map || !layers) return;
    const activeStreet = layers.getActiveStreet();
    if (mapStyle === 'satellite') {
      if (map.hasLayer(layers.streetLayer)) map.removeLayer(layers.streetLayer);
      if (map.hasLayer(layers.backupStreetLayer)) map.removeLayer(layers.backupStreetLayer);
      if (!map.hasLayer(layers.satelliteLayer)) layers.satelliteLayer.addTo(map);
      if (!map.hasLayer(layers.satelliteRoads)) layers.satelliteRoads.addTo(map);
      if (!map.hasLayer(layers.satelliteLabels)) layers.satelliteLabels.addTo(map);
    } else {
      if (map.hasLayer(layers.satelliteLayer)) map.removeLayer(layers.satelliteLayer);
      if (map.hasLayer(layers.satelliteRoads)) map.removeLayer(layers.satelliteRoads);
      if (map.hasLayer(layers.satelliteLabels)) map.removeLayer(layers.satelliteLabels);
      if (!map.hasLayer(activeStreet)) activeStreet.addTo(map);
    }
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds = [];

    // 1. Route Line (OSRM road path or dashed estimate)
    if (routeCoords && routeCoords.length >= 2) {
      L.polyline(routeCoords, {
        color: '#009E4D',
        weight: routeSource === 'osrm' ? 5 : 3.5,
        opacity: 0.9,
        dashArray: routeSource === 'osrm' ? null : '8 6',
      }).addTo(layer);
    } else if (pickup?.lat != null && drop?.lat != null) {
      L.polyline(
        [
          [pickup.lat, pickup.lng],
          [drop.lat, drop.lng],
        ],
        { color: '#009E4D', weight: 3.5, opacity: 0.8, dashArray: '8 6' }
      ).addTo(layer);
    }

    // 2. Pickup Pin
    if (pickup?.lat != null && pickup?.lng != null) {
      const pMarker = L.marker([pickup.lat, pickup.lng], {
        icon: makePinIcon('#009E4D', 'P', null),
        draggable: interactive && Boolean(onPinDrag),
      }).addTo(layer);
      pMarker.bindPopup(`<strong>Pickup:</strong> ${esc(pickup.label || 'Customer Pickup')}`);
      if (interactive && onPinDrag) {
        pMarker.on('dragend', () => {
          const ll = pMarker.getLatLng();
          callbacksRef.current.onPinDrag?.('pickup', ll.lat, ll.lng);
        });
      }
      bounds.push([pickup.lat, pickup.lng]);
    }

    // 3. Drop Pin
    if (drop?.lat != null && drop?.lng != null) {
      const dMarker = L.marker([drop.lat, drop.lng], {
        icon: makePinIcon('#0F172A', 'D', null),
        draggable: interactive && Boolean(onPinDrag),
      }).addTo(layer);
      dMarker.bindPopup(`<strong>Drop:</strong> ${esc(drop.label || 'Destination')}`);
      if (interactive && onPinDrag) {
        dMarker.on('dragend', () => {
          const ll = dMarker.getLatLng();
          callbacksRef.current.onPinDrag?.('drop', ll.lat, ll.lng);
        });
      }
      bounds.push([drop.lat, drop.lng]);
    }

    // 4. Active Customer Bookings (Admin Live Operations Map)
    for (const b of activeBookings || []) {
      if (b.pickup_lat != null && b.pickup_lng != null) {
        const pColor = b.status === 'pending' ? '#D97706' : '#0D9488';
        const cMarker = L.marker([b.pickup_lat, b.pickup_lng], {
          icon: makePinIcon(pColor, 'C', b.booking_code),
        }).addTo(layer);
        cMarker.bindPopup(
          `<div style="font-size:12px;line-height:1.4;">
            <strong>${esc(b.booking_code)} (${esc(b.status)})</strong><br/>
            Customer: ${esc(b.customer_name)} ${b.customer_phone ? `(${esc(b.customer_phone)})` : ''}<br/>
            From: ${esc(b.pickup_zone)} (${esc(b.pickup_address)})<br/>
            To: ${esc(b.drop_zone)} (${esc(b.drop_address)})<br/>
            <strong>${esc(b.distance_km)} km · Rs. ${esc(b.final_fare)}</strong>
            ${b.rider_name ? `<br/>Captain: ${esc(b.rider_name)}` : '<br/><span style="color:#D97706;font-weight:700;">Waiting Captain</span>'}
            <br/><a href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${b.pickup_lat},${b.pickup_lng}`)}&destination=${encodeURIComponent(`${b.drop_lat ?? b.pickup_lat},${b.drop_lng ?? b.pickup_lng}`)}&travelmode=driving" target="_blank" rel="noopener noreferrer" style="color:#009E4D;font-weight:700;text-decoration:underline;">Open in Google Maps ↗</a>
          </div>`
        );
        bounds.push([b.pickup_lat, b.pickup_lng]);

        if (b.drop_lat != null && b.drop_lng != null) {
          L.polyline(
            [
              [b.pickup_lat, b.pickup_lng],
              [b.drop_lat, b.drop_lng],
            ],
            { color: pColor, weight: 2.5, opacity: 0.7, dashArray: '6 5' }
          ).addTo(layer);
          L.circleMarker([b.drop_lat, b.drop_lng], {
            radius: 5,
            color: '#0F172A',
            fillColor: '#FFFFFF',
            fillOpacity: 1,
            weight: 2,
          })
            .bindPopup(`<strong>Drop (${esc(b.booking_code)}):</strong> ${esc(b.drop_zone)}`)
            .addTo(layer);
          bounds.push([b.drop_lat, b.drop_lng]);
        }
      }
    }

    // 5. Captains Layer (Nearby Riders/Cars for Customer, or All Fleet for Admin)
    visibleCaptains.forEach((c, idx) => {
      const capKey = getCaptainKey(c, idx);
      const isSelected = capKey === activeCaptainKey;
      const riderImg = safePhotoUrl(c.rider_photo);
      const [plotLat, plotLng] = getSpreadPosition(c, idx, visibleCaptains);
      const m = L.marker([plotLat, plotLng], {
        icon: makeCaptainIcon(c, isSelected),
        zIndexOffset: isSelected ? 1200 : riderImg ? 900 : 650,
      }).addTo(layer);
      m.on('click', () => setSelectedKey(capKey));
      const title = c.full_name || c.display_name || 'SafarGo Captain';
      m.bindPopup(
        `<div style="font-size:12px;line-height:1.4;min-width:170px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            ${riderImg ? `<img src="${riderImg}" alt="${esc(title)}" style="width:32px;height:32px;border-radius:9999px;object-fit:cover;border:2px solid #009E4D;flex-shrink:0;" />` : ''}
            <div>
              <strong>${esc(title)}</strong><br/>
              <span style="font-size:11px;color:#475569;">${esc(c.vehicle_type === 'car' ? 'AC Car' : 'Bike')}: ${esc(c.bike_model || '')} ${c.bike_plate ? `(${esc(c.bike_plate)})` : ''}</span>
            </div>
          </div>
          Area: <strong>${esc(c.zone_name || '-')}</strong><br/>
          ${c.distance_km != null ? `Distance: <strong>${esc(c.distance_km)} km (~${esc(c.eta_min || 3)} min)</strong><br/>` : ''}
          Status: <strong>${c.is_online !== false ? 'ONLINE' : 'OFFLINE'}</strong>
          ${c.is_verified === false ? ' · <span style="color:#D97706;font-weight:700;">Unverified Docs</span>' : ''}
          ${c.active_booking_code ? `<br/>Active Trip: <strong>${esc(c.active_booking_code)}</strong>` : ''}
        </div>`
      );
      if (bounds.length === 0 || activeBookings?.length > 0) {
        bounds.push([plotLat, plotLng]);
      }
    });

    // 6. Active Emergency SOS Pins (Admin Radar)
    for (const s of sosAlerts || []) {
      if (s.lat != null && s.lng != null) {
        const sMarker = L.marker([s.lat, s.lng], {
          icon: makePinIcon('#DC2626', 'SOS', s.user_name),
          zIndexOffset: 1500,
        }).addTo(layer);
        sMarker.bindPopup(
          `<div style="font-size:12px;line-height:1.4;">
            <strong style="color:#DC2626;">EMERGENCY SOS (${esc(s.status?.toUpperCase())})</strong><br/>
            <strong>${esc(s.user_name)}</strong> (${esc(s.user_phone)})<br/>
            Type: ${esc(s.emergency_type)} · ${esc(s.zone_name || '')}<br/>
            ${s.note ? `Note: ${esc(s.note)}<br/>` : ''}
            <a href="tel:${esc(s.user_phone)}" style="color:#DC2626;font-weight:700;">Call Reporter</a> ·
            <a href="tel:15" style="color:#DC2626;font-weight:700;">Police 15</a> ·
            <a href="tel:1122" style="color:#B45309;font-weight:700;">Rescue 1122</a>
          </div>`
        );
        bounds.push([s.lat, s.lng]);
      }
    }

    if (bounds.length >= 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    }
    const resizeTimer = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(resizeTimer);
  }, [
    pickup?.lat,
    pickup?.lng,
    pickup?.label,
    drop?.lat,
    drop?.lng,
    drop?.label,
    routeCoords,
    routeSource,
    captains,
    activeBookings,
    sosAlerts,
    interactive,
    fitSignature,
    activeCaptainKey,
  ]);

  const googleMapsUrl =
    pickup?.lat != null && drop?.lat != null
      ? `https://www.google.com/maps/dir/?api=1&origin=${pickup.lat},${pickup.lng}&destination=${drop.lat},${drop.lng}&travelmode=driving`
      : pickup?.lat != null
      ? `https://www.google.com/maps/search/?api=1&query=${pickup.lat},${pickup.lng}`
      : activeCaptain
      ? `https://www.google.com/maps/search/?api=1&query=${activeCaptain.lat},${activeCaptain.lng}`
      : 'https://www.google.com/maps/@34.3335,73.1995,13z';

  const activeRiderImg = safePhotoUrl(activeCaptain?.rider_photo);
  const activeVehicleImg = safePhotoUrl(activeCaptain?.vehicle_photo);
  const minHeightPx = resolveMinHeightPx(heightClass);

  return (
    <div className={hasSidebar ? 'flex flex-col md:flex-row gap-3 items-stretch' : ''}>
      <div
        className={`relative z-10 isolate ${
          hasSidebar ? 'w-full shrink-0 md:shrink md:flex-1 md:min-w-0' : 'w-full'
        } ${heightClass} rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-100`}
        style={{ minHeight: `${minHeightPx}px` }}
      >
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: `${minHeightPx}px` }}
        />

        {/* Top-Right: Free Street / Satellite View Switcher */}
        <div className="absolute top-2.5 right-2.5 z-[400] inline-flex rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200 shadow-sm p-0.5 text-[10px] font-extrabold">
          <button
            type="button"
            onClick={() => setMapStyle('street')}
            className={`px-2 py-1 rounded-md transition ${
              mapStyle === 'street' ? 'bg-[#009E4D] text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Street
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('satellite')}
            className={`px-2 py-1 rounded-md transition ${
              mapStyle === 'satellite' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Satellite
          </button>
        </div>

        {/* Bottom-Left: Free Official Google Maps Turn-by-Turn Navigation Link */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-6 left-2.5 z-[400] px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200 shadow-sm text-[10px] font-extrabold text-slate-800 hover:border-[#009E4D] hover:text-[#008741] transition"
        >
          Open in Google Maps ↗
        </a>
      </div>

      {/* Side-Wise Clear Captain Photo Showcase Panel + Scalable Roster for Growing Fleet */}
      {hasSidebar && activeCaptain && (
        <aside className="w-full md:w-72 lg:w-80 shrink-0 rounded-2xl border border-slate-200/90 bg-white p-3.5 flex flex-col justify-between gap-3 shadow-xs">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Live Captain Pin ({visibleCaptains.findIndex((c, i) => getCaptainKey(c, i) === activeCaptainKey) + 1}/{visibleCaptains.length})
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeCaptain.is_online !== false
                    ? 'bg-emerald-100 text-[#008741]'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {activeCaptain.is_online !== false ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* Large Clear Side Captain Portrait + Vehicle Photo */}
            <div className="flex items-center gap-2.5">
              {activeRiderImg ? (
                <img
                  src={activeRiderImg}
                  alt={activeCaptain.full_name || activeCaptain.display_name || 'Captain'}
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-[#009E4D] shadow-sm shrink-0 bg-slate-100"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-2xl font-extrabold text-[#008741] shrink-0">
                  {(activeCaptain.full_name || activeCaptain.display_name || 'C')[0]}
                </div>
              )}
              {activeVehicleImg && (
                <img
                  src={activeVehicleImg}
                  alt={activeCaptain.bike_model || 'Vehicle'}
                  className="w-20 h-24 rounded-2xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                />
              )}
            </div>

            <div>
              <div className="text-sm font-extrabold text-slate-900">
                {activeCaptain.full_name || activeCaptain.display_name || 'SafarGo Captain'}
              </div>
              <div className="text-[11px] font-semibold text-slate-600">
                {activeCaptain.vehicle_type === 'car' ? 'AC Car' : 'Bike'}:{' '}
                {activeCaptain.bike_model || '-'}{' '}
                {activeCaptain.bike_plate ? `(${activeCaptain.bike_plate})` : ''}
              </div>
              <div className="text-[11px] font-bold text-[#008741] mt-1">
                Location: {activeCaptain.zone_name || `${Number(activeCaptain.lat).toFixed(4)}, ${Number(activeCaptain.lng).toFixed(4)}`}
              </div>
              {activeCaptain.distance_km != null && (
                <div className="text-[11px] text-slate-500 mono-num mt-0.5">
                  {activeCaptain.distance_km} km away (~{activeCaptain.eta_min || 3} min)
                </div>
              )}
              {activeCaptain.is_verified === false && (
                <div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                  Docs Pending Verification
                </div>
              )}
            </div>
          </div>

          {visibleCaptains.length > 1 && (
            <div className="pt-2.5 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Fleet ({filteredRoster.length}/{visibleCaptains.length})
                </span>
                <div className="flex gap-1">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'online', label: 'Online' },
                    { id: 'bike', label: 'Bike' },
                    { id: 'car', label: 'Car' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFleetFilter(f.id)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        fleetFilter === f.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {visibleCaptains.length > 3 && (
                <input
                  type="text"
                  placeholder="Search captain, plate, chowk..."
                  value={fleetSearch}
                  onChange={(e) => setFleetSearch(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium"
                />
              )}

              <div className="max-h-40 overflow-y-auto pr-1 space-y-1">
                {filteredRoster.length === 0 ? (
                  <div className="text-[11px] text-slate-400 text-center py-2">No matching captains</div>
                ) : (
                  filteredRoster.map((c) => {
                    const origIdx = visibleCaptains.indexOf(c);
                    const capKey = getCaptainKey(c, origIdx);
                    const isSel = capKey === activeCaptainKey;
                    const thumb = safePhotoUrl(c.rider_photo);
                    return (
                      <button
                        key={capKey}
                        type="button"
                        onClick={() => {
                          setSelectedKey(capKey);
                          mapRef.current?.panTo([Number(c.lat), Number(c.lng)], { animate: true });
                        }}
                        className={`w-full p-1.5 rounded-xl border text-left flex items-center justify-between gap-2 transition ${
                          isSel
                            ? 'bg-emerald-50 border-[#009E4D]'
                            : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={c.full_name || c.display_name || 'Captain'}
                              className="w-7 h-7 rounded-full object-cover border border-emerald-300 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 text-[11px] font-extrabold flex items-center justify-center shrink-0">
                              {(c.full_name || c.display_name || 'C')[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-slate-900 truncate">
                              {c.full_name || c.display_name || 'Captain'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {c.bike_plate || c.vehicle_type} · {c.zone_name || 'Live GPS'}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            c.is_online !== false ? 'bg-[#009E4D]' : 'bg-slate-400'
                          }`}
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
