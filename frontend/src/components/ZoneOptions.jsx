import React from 'react';
import { groupZonesByCity } from '../utils/zones';

export function ZoneOptions({ zones = [], showTag = true, prefix = '' }) {
  const grouped = groupZonesByCity(zones);
  return (
    <>
      {grouped.map(([groupLabel, list]) => (
        <optgroup key={groupLabel} label={groupLabel}>
          {list.map((z) => (
            <option key={z.id} value={z.name}>
              {prefix}
              {z.name}
              {showTag ? ` (${z.area_tag})` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
