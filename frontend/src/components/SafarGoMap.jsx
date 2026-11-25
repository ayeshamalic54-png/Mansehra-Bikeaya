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
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16],
      html: `
        <div style="position:relative;width:30px;height:30px;">
          <div style="width:30px;height:30px;border-radius:9999px;border:2.5px solid ${ring};background:#fff;box-shadow:0 3px 10px rgba(15,23,42,0.34);overflow:hidden;">
            <img src="${photoUrl}" alt="${shortName}" style="width:100%;height:100%;object-fit:cover;display:block;" />
          </div>
          <span style="position:absolute;bottom:-1px;right:-1px;width:9px;height:9px;border-radius:9999px;background:${dot};border:1.5px solid #fff;"></span>
        </div>
      `,
    });
  }

  const glyph = isCar
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;

  return L.divIcon({
    className: 'safargo-div-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    html: `
      <div style="position:relative;width:28px;height:28px;border-radius:9999px;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 3px 10px rgba(15,23,42,0.28);">
        ${glyph}
        <span style="position:absolute;bottom:-1px;right:-1px;width:8px;height:8px;border-radius:9999px;background:${dot};border:1.5px solid #fff;"></span>
      </div>
    `,
  });
}

export function SafarGoMap({
  pickup = null,
  drop = null,
  routeCoords = null,
  routeSource = 'estimate',
  captains = [],
  activeBookings = [],
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
  const [selectedIdx, setSelectedIdx] = useState(0);
  const callbacksRef = useRef({ interactive, activePinMode, onMapPick, onPinDrag });
  callbacksRef.current = { interactive, activePinMode, onMapPick, onPinDrag };

  const visibleCaptains = (captains || []).filter((c) => c && c.lat != null && c.lng != null);
  const safeSelectedIdx =
    visibleCaptains.length === 0 ? 0 : Math.min(selectedIdx, visibleCaptains.length - 1);
  const activeCaptain = visibleCaptains[safeSelectedIdx] || null;
  const hasSidebar = showCaptainSidebar && visibleCaptains.length > 0;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center = pickup?.lat && pickup?.lng ? [pickup.lat, pickup.lng] : [34.3335, 73.1995];
    const map = L.map(containerRef.current, {
      center,
      zoom: 13,
      zoomControl: true,
    });

    const streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    });
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

    streetLayer.addTo(map);
    baseLayersRef.current = { streetLayer, satelliteLayer, satelliteLabels, satelliteRoads };

    const group = L.layerGroup().addTo(map);
    map.on('click', (ev) => {
      const cb = callbacksRef.current;
      if (cb.interactive && cb.onMapPick) {
        cb.onMapPick(cb.activePinMode, ev.latlng.lat, ev.latlng.lng);
      }
    });

    mapRef.current = map;
    layerRef.current = group;

    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => {
      clearTimeout(timer);
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
    if (mapStyle === 'satellite') {
      if (map.hasLayer(layers.streetLayer)) map.removeLayer(layers.streetLayer);
      if (!map.hasLayer(layers.satelliteLayer)) layers.satelliteLayer.addTo(map);
      if (!map.hasLayer(layers.satelliteRoads)) layers.satelliteRoads.addTo(map);
      if (!map.hasLayer(layers.satelliteLabels)) layers.satelliteLabels.addTo(map);
    } else {
      if (map.hasLayer(layers.satelliteLayer)) map.removeLayer(layers.satelliteLayer);
      if (map.hasLayer(layers.satelliteRoads)) map.removeLayer(layers.satelliteRoads);
      if (map.hasLayer(layers.satelliteLabels)) map.removeLayer(layers.satelliteLabels);
      if (!map.hasLayer(layers.streetLayer)) layers.streetLayer.addTo(map);
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
      const m = L.marker([c.lat, c.lng], {
        icon: makeCaptainIcon(c, idx === safeSelectedIdx),
      }).addTo(layer);
      m.on('click', () => setSelectedIdx(idx));
      const title = c.full_name || c.display_name || 'SafarGo Captain';
      const riderImg = safePhotoUrl(c.rider_photo);
      const vehImg = safePhotoUrl(c.vehicle_photo);
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
        bounds.push([c.lat, c.lng]);
      }
    });

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
    interactive,
    fitSignature,
    safeSelectedIdx,
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

  return (
    <div className={hasSidebar ? 'flex flex-col md:flex-row gap-3 items-stretch' : ''}>
      <div className={`relative ${hasSidebar ? 'flex-1 min-w-0' : 'w-full'} ${heightClass} rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-100`}>
        <div ref={containerRef} className="w-full h-full" />

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
          className="absolute bottom-2.5 left-2.5 z-[400] px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200 shadow-sm text-[10px] font-extrabold text-slate-800 hover:border-[#009E4D] hover:text-[#008741] transition"
        >
          Open in Google Maps ↗
        </a>
      </div>

      {/* Side-Wise Clear Captain Photo Showcase Panel (never covers map labels or pins) */}
      {hasSidebar && activeCaptain && (
        <aside className="w-full md:w-64 lg:w-72 shrink-0 rounded-2xl border border-slate-200/90 bg-white p-3.5 flex flex-col justify-between gap-3 shadow-xs">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Live Captain Pin ({safeSelectedIdx + 1}/{visibleCaptains.length})
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
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              {visibleCaptains.slice(0, 6).map((c, idx) => (
                <button
                  key={c.id || c.rider_id || idx}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                    idx === safeSelectedIdx
                      ? 'bg-[#009E4D] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {(c.full_name || c.display_name || `C${idx + 1}`).split(' ')[0]}
                </button>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
