import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

function makeCaptainIcon(c) {
  const isCar = c.vehicle_type === 'car';
  const online = c.is_online !== false;
  const bg = !online ? '#64748B' : isCar ? '#0284C7' : '#009E4D';
  const dot = online ? '#4ADE80' : '#CBD5E1';
  const glyph = isCar
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;

  return L.divIcon({
    className: 'safargo-div-icon',
    iconSize: [38, 30],
    iconAnchor: [19, 15],
    popupAnchor: [0, -16],
    html: `
      <div style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:9999px;background:${bg};color:#fff;font-size:10px;font-weight:800;border:2px solid #fff;box-shadow:0 4px 12px rgba(15,23,42,0.28);white-space:nowrap;">
        <span style="width:6px;height:6px;border-radius:9999px;background:${dot};display:inline-block;"></span>
        ${glyph}
        <span>${isCar ? 'CAR' : 'BIKE'}</span>
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
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const callbacksRef = useRef({ interactive, activePinMode, onMapPick, onPinDrag });
  callbacksRef.current = { interactive, activePinMode, onMapPick, onPinDrag };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center = pickup?.lat && pickup?.lng ? [pickup.lat, pickup.lng] : [34.3335, 73.1995];
    const map = L.map(containerRef.current, {
      center,
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

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
    };
  }, []);

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
    for (const c of captains || []) {
      if (c.lat == null || c.lng == null) continue;
      const m = L.marker([c.lat, c.lng], { icon: makeCaptainIcon(c) }).addTo(layer);
      const title = c.full_name || c.display_name || 'SafarGo Captain';
      m.bindPopup(
        `<div style="font-size:12px;line-height:1.4;">
          <strong>${esc(title)}</strong><br/>
          ${esc(c.vehicle_type === 'car' ? 'Car' : 'Bike')}: ${esc(c.bike_model || '')} ${c.bike_plate ? `(${esc(c.bike_plate)})` : ''}<br/>
          Area: ${esc(c.zone_name || '-')}<br/>
          ${c.distance_km != null ? `Distance: <strong>${esc(c.distance_km)} km (~${esc(c.eta_min || 3)} min)</strong><br/>` : ''}
          Status: <strong>${c.is_online !== false ? 'ONLINE' : 'OFFLINE'}</strong>
          ${c.active_booking_code ? `<br/>Active Trip: <strong>${esc(c.active_booking_code)}</strong>` : ''}
        </div>`
      );
      if (bounds.length === 0 || activeBookings?.length > 0) {
        bounds.push([c.lat, c.lng]);
      }
    }

    if (bounds.length >= 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    }
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
  ]);

  return (
    <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-100`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
