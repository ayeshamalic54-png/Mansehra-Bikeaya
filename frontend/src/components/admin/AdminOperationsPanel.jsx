import React, { useEffect, useState } from 'react';
import { KeyRound, Pencil, ShieldCheck, Trash2, X } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../StatusBadge';

export function AdminOperationsPanel({ subpage, onNotify, onRefreshBootstrap }) {
  const { user, refreshMe } = useAuth();

  // Releases state
  const [releases, setReleases] = useState([]);
  const [editingReleaseId, setEditingReleaseId] = useState(null);
  const [relForm, setRelForm] = useState({
    platform: 'android_apk',
    version: '1.0.1',
    file_name: 'MansehraBikeaya-v1.0.1.apk',
    download_url: '',
    file_size_mb: 14.5,
    release_notes: '',
    is_latest: true,
  });

  // Tickets state
  const [tickets, setTickets] = useState([]);

  // Zones & Promos state
  const [zones, setZones] = useState([]);
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    area_tag: 'City Area',
    approx_km_from_center: 3,
    surcharge: 0,
  });

  const [promos, setPromos] = useState([]);
  const [editingPromoId, setEditingPromoId] = useState(null);
  const [promoForm, setPromoForm] = useState({
    code: '',
    discount_type: 'fixed',
    discount_value: 20,
    max_discount: 50,
    min_fare: 100,
  });

  // Admin Profile, Password & System Settings state
  const [adminProfile, setAdminProfile] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [sysSettings, setSysSettings] = useState({});

  const loadSubpage = async () => {
    try {
      if (subpage === 'releases') {
        setReleases(await apiRequest('/api/admin/releases'));
      } else if (subpage === 'tickets') {
        setTickets(await apiRequest('/api/admin/tickets'));
      } else if (subpage === 'zones') {
        const [z, p] = await Promise.all([apiRequest('/api/admin/zones'), apiRequest('/api/admin/promos')]);
        setZones(z);
        setPromos(p);
      } else if (subpage === 'settings') {
        setSysSettings(await apiRequest('/api/admin/settings'));
      }
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  useEffect(() => {
    loadSubpage();
  }, [subpage]);

  if (subpage === 'releases') {
    const handleSaveRelease = async (e) => {
      e.preventDefault();
      try {
        const body = { ...relForm, file_size_mb: Number(relForm.file_size_mb) };
        if (editingReleaseId) {
          await apiRequest(`/api/admin/releases/${editingReleaseId}`, { method: 'PATCH', body });
          onNotify('App release updated!');
        } else {
          await apiRequest('/api/admin/releases', { method: 'POST', body });
          onNotify('App release published to /downloads!');
        }
        setEditingReleaseId(null);
        setRelForm({
          platform: 'android_apk',
          version: '1.0.1',
          file_name: 'MansehraBikeaya-v1.0.1.apk',
          download_url: '',
          file_size_mb: 14.5,
          release_notes: '',
          is_latest: true,
        });
        await loadSubpage();
        onRefreshBootstrap();
      } catch (err) {
        onNotify(err.message, true);
      }
    };

    return (
      <div className="space-y-4 text-xs">
        <form onSubmit={handleSaveRelease} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-sm text-slate-900">
              {editingReleaseId ? 'Edit Release Build' : 'Publish Android (.apk) or Windows (.exe) Build'}
            </span>
            {editingReleaseId && (
              <button type="button" onClick={() => setEditingReleaseId(null)} className="text-slate-500">
                <X className="w-4 h-4 inline" /> Cancel
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={relForm.platform}
              onChange={(e) => setRelForm({ ...relForm, platform: e.target.value })}
              className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-bold"
            >
              <option value="android_apk">Android (.apk)</option>
              <option value="windows_exe">Windows (.exe)</option>
            </select>
            <input
              type="text"
              required
              placeholder="Version (1.0.1)"
              value={relForm.version}
              onChange={(e) => setRelForm({ ...relForm, version: e.target.value })}
              className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
            />
            <input
              type="text"
              required
              placeholder="File Name"
              value={relForm.file_name}
              onChange={(e) => setRelForm({ ...relForm, file_name: e.target.value })}
              className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
            />
            <input
              type="number"
              step="0.1"
              placeholder="Size MB"
              value={relForm.file_size_mb}
              onChange={(e) => setRelForm({ ...relForm, file_size_mb: e.target.value })}
              className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
            />
          </div>
          <input
            type="text"
            required
            placeholder="Download URL"
            value={relForm.download_url}
            onChange={(e) => setRelForm({ ...relForm, download_url: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
          />
          <input
            type="text"
            placeholder="Release Notes"
            value={relForm.release_notes}
            onChange={(e) => setRelForm({ ...relForm, release_notes: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
          />
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#009E4D] text-white font-bold">
            {editingReleaseId ? 'Save Release Changes' : 'Publish to /downloads Page'}
          </button>
        </form>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2">
          <div className="font-extrabold text-sm">Published Builds</div>
          {releases.map((rel) => (
            <div key={rel.id} className="p-3 rounded-xl bg-slate-50/80 flex flex-wrap justify-between items-center gap-2">
              <div>
                <div className="font-bold">
                  {rel.file_name} (v{rel.version}) · {rel.platform}{' '}
                  {rel.is_latest && <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#008741]">Latest</span>}
                </div>
                <div className="text-slate-500">{rel.download_url}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="mono-num font-bold">{rel.download_count} downloads</span>
                <button
                  onClick={() => {
                    setEditingReleaseId(rel.id);
                    setRelForm({
                      platform: rel.platform,
                      version: rel.version,
                      file_name: rel.file_name,
                      download_url: rel.download_url,
                      file_size_mb: rel.file_size_mb,
                      release_notes: rel.release_notes || '',
                      is_latest: rel.is_latest,
                    });
                  }}
                  className="p-1.5 rounded-lg bg-white border border-slate-200/80"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Delete this app release?')) return;
                    await apiRequest(`/api/admin/releases/${rel.id}`, { method: 'DELETE' });
                    onNotify('Release deleted.');
                    await loadSubpage();
                    onRefreshBootstrap();
                  }}
                  className="p-1.5 rounded-lg bg-rose-50 text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (subpage === 'tickets') {
    return (
      <div className="space-y-3 text-xs">
        {tickets.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 text-center text-slate-500">
            No support complaints submitted yet.
          </div>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center font-bold">
                <span>{t.subject} — {t.user_name} ({t.user_phone})</span>
                <div className="flex items-center gap-2">
                  <StatusBadge value={t.status} />
                  <button
                    onClick={async () => {
                      if (!window.confirm('Delete this ticket?')) return;
                      await apiRequest(`/api/admin/tickets/${t.id}`, { method: 'DELETE' });
                      onNotify('Ticket deleted.');
                      await loadSubpage();
                    }}
                    className="p-1 text-rose-500 hover:text-rose-700"
                    title="Delete Ticket"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-slate-600">{t.message}</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const reply = e.target.reply.value;
                  await apiRequest(`/api/admin/tickets/${t.id}`, {
                    method: 'PATCH',
                    body: { status: 'resolved', admin_reply: reply },
                  });
                  onNotify('Ticket resolved!');
                  await loadSubpage();
                }}
                className="flex gap-2 pt-1"
              >
                <input
                  name="reply"
                  required
                  defaultValue={t.admin_reply || ''}
                  placeholder="Type reply to resolve..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#009E4D] text-white font-bold">
                  Reply &amp; Resolve
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    );
  }

  if (subpage === 'zones') {
    const handleSaveZone = async (e) => {
      e.preventDefault();
      try {
        const body = {
          ...zoneForm,
          approx_km_from_center: Number(zoneForm.approx_km_from_center),
          surcharge: Number(zoneForm.surcharge),
        };
        if (editingZoneId) {
          await apiRequest(`/api/admin/zones/${editingZoneId}`, { method: 'PATCH', body });
          onNotify('Mansehra zone updated!');
        } else {
          await apiRequest('/api/admin/zones', { method: 'POST', body });
          onNotify('Mansehra zone added!');
        }
        setEditingZoneId(null);
        setZoneForm({ name: '', area_tag: 'City Area', approx_km_from_center: 3, surcharge: 0 });
        await loadSubpage();
        onRefreshBootstrap();
      } catch (err) {
        onNotify(err.message, true);
      }
    };

    const handleSavePromo = async (e) => {
      e.preventDefault();
      try {
        const body = {
          ...promoForm,
          discount_value: Number(promoForm.discount_value),
          max_discount: Number(promoForm.max_discount),
          min_fare: Number(promoForm.min_fare),
        };
        if (editingPromoId) {
          await apiRequest(`/api/admin/promos/${editingPromoId}`, { method: 'PATCH', body });
          onNotify('Promo code updated!');
        } else {
          await apiRequest('/api/admin/promos', { method: 'POST', body });
          onNotify('Promo code created!');
        }
        setEditingPromoId(null);
        setPromoForm({ code: '', discount_type: 'fixed', discount_value: 20, max_discount: 50, min_fare: 100 });
        await loadSubpage();
      } catch (err) {
        onNotify(err.message, true);
      }
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
        {/* Zones CRUD */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-extrabold text-sm">Mansehra Zones</span>
            {editingZoneId && (
              <button onClick={() => setEditingZoneId(null)} className="text-slate-500">Cancel Edit</button>
            )}
          </div>
          <form onSubmit={handleSaveZone} className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="Zone Name"
              value={zoneForm.name}
              onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
            />
            <input
              placeholder="Area Tag (e.g. City Core)"
              value={zoneForm.area_tag}
              onChange={(e) => setZoneForm({ ...zoneForm, area_tag: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
            />
            <input
              type="number"
              step="0.5"
              placeholder="Approx Km"
              value={zoneForm.approx_km_from_center}
              onChange={(e) => setZoneForm({ ...zoneForm, approx_km_from_center: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
            />
            <input
              type="number"
              placeholder="Surcharge Rs."
              value={zoneForm.surcharge}
              onChange={(e) => setZoneForm({ ...zoneForm, surcharge: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
            />
            <button type="submit" className="col-span-2 py-2 rounded-xl bg-[#009E4D] text-white font-bold">
              {editingZoneId ? 'Save Zone Changes' : '+ Add Zone'}
            </button>
          </form>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {zones.map((z) => (
              <div key={z.id} className="py-2.5 flex justify-between items-center gap-2">
                <div>
                  <strong>{z.name}</strong> <span className="text-slate-500">({z.area_tag})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono-num">Rs.{z.surcharge}</span>
                  <button
                    onClick={() => {
                      setEditingZoneId(z.id);
                      setZoneForm({
                        name: z.name,
                        area_tag: z.area_tag,
                        approx_km_from_center: z.approx_km_from_center,
                        surcharge: z.surcharge,
                      });
                    }}
                    className="p-1 text-slate-600 hover:text-slate-900"
                    title="Edit Zone"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Delete zone ${z.name}?`)) return;
                      await apiRequest(`/api/admin/zones/${z.id}`, { method: 'DELETE' });
                      onNotify('Zone deleted.');
                      await loadSubpage();
                      onRefreshBootstrap();
                    }}
                    className="p-1 text-rose-500 hover:text-rose-700"
                    title="Delete Zone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Promos CRUD */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-extrabold text-sm">Promo Codes</span>
            {editingPromoId && (
              <button onClick={() => setEditingPromoId(null)} className="text-slate-500">Cancel Edit</button>
            )}
          </div>
          <form onSubmit={handleSavePromo} className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="Code (EID50)"
              value={promoForm.code}
              onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
              className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num uppercase"
            />
            <select
              value={promoForm.discount_type}
              onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
            >
              <option value="fixed">Fixed (Rs.)</option>
              <option value="percent">Percent (%)</option>
            </select>
            <input
              type="number"
              required
              placeholder="Discount Value"
              value={promoForm.discount_value}
              onChange={(e) => setPromoForm({ ...promoForm, discount_value: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
            />
            <input
              type="number"
              required
              placeholder="Min Fare Rs."
              value={promoForm.min_fare}
              onChange={(e) => setPromoForm({ ...promoForm, min_fare: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
            />
            <button type="submit" className="col-span-2 py-2 rounded-xl bg-teal-600 text-white font-bold">
              {editingPromoId ? 'Save Promo Changes' : '+ Add Promo'}
            </button>
          </form>
          <div className="divide-y divide-slate-100">
            {promos.map((p) => (
              <div key={p.id} className="py-2.5 flex justify-between items-center gap-2">
                <div>
                  <strong className="mono-num">{p.code}</strong> · {p.discount_value} ({p.discount_type}) · Uses: {p.uses_count}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      await apiRequest(`/api/admin/promos/${p.id}/toggle`, { method: 'PATCH' });
                      await loadSubpage();
                    }}
                    className={`px-2 py-1 rounded-lg font-bold ${p.is_active ? 'bg-emerald-50 text-[#008741]' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {p.is_active ? 'Active' : 'Off'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPromoId(p.id);
                      setPromoForm({
                        code: p.code,
                        discount_type: p.discount_type,
                        discount_value: p.discount_value,
                        max_discount: p.max_discount,
                        min_fare: p.min_fare,
                      });
                    }}
                    className="p-1 text-slate-600"
                    title="Edit Promo"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Delete promo ${p.code}?`)) return;
                      await apiRequest(`/api/admin/promos/${p.id}`, { method: 'DELETE' });
                      onNotify('Promo deleted.');
                      await loadSubpage();
                    }}
                    className="p-1 text-rose-500"
                    title="Delete Promo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Admin Security, Own Password, & System Settings
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
          <ShieldCheck className="w-4 h-4 text-[#009E4D]" />
          Admin Profile &amp; Password Control
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiRequest('/api/admin/profile', { method: 'PATCH', body: adminProfile });
              await refreshMe();
              onNotify('Admin profile updated!');
            } catch (err) {
              onNotify(err.message, true);
            }
          }}
          className="space-y-2.5"
        >
          <input
            type="text"
            required
            placeholder="Admin Full Name"
            value={adminProfile.full_name}
            onChange={(e) => setAdminProfile({ ...adminProfile, full_name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
          />
          <input
            type="text"
            required
            placeholder="Admin Phone Login"
            value={adminProfile.phone}
            onChange={(e) => setAdminProfile({ ...adminProfile, phone: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
          />
          <input
            type="email"
            placeholder="Admin Email"
            value={adminProfile.email}
            onChange={(e) => setAdminProfile({ ...adminProfile, email: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
          />
          <button type="submit" className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold">
            Save Admin Profile
          </button>
        </form>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiRequest(`/api/admin/users/${user.id}/password`, {
                method: 'PATCH',
                body: { new_password: adminNewPassword },
              });
              setAdminNewPassword('');
              onNotify('Admin password updated!');
            } catch (err) {
              onNotify(err.message, true);
            }
          }}
          className="pt-3 border-t border-slate-100 space-y-2.5"
        >
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-teal-600" />
            Change Admin Login Password
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              required
              minLength={4}
              placeholder="New Admin Password (min 4 chars)"
              value={adminNewPassword}
              onChange={(e) => setAdminNewPassword(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
            />
            <button type="submit" className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold">
              Update Password
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
        <div className="font-extrabold text-sm text-slate-900">Business Settings</div>
        {Object.entries(sysSettings).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-36 font-semibold capitalize text-slate-600">{k.replace(/_/g, ' ')}</span>
            <input
              type="text"
              value={v}
              onChange={(e) => setSysSettings({ ...sysSettings, [k]: e.target.value })}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
            />
            <button
              onClick={async () => {
                await apiRequest(`/api/admin/settings/${k}`, { method: 'PUT', body: { value: sysSettings[k] } });
                onNotify(`Saved ${k}!`);
                onRefreshBootstrap();
              }}
              className="px-3 py-2 rounded-xl bg-[#009E4D] text-white font-bold"
            >
              Save
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
