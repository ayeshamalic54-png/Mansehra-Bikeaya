import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  HardDrive,
  KeyRound,
  Mail,
  Pencil,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiRequest, downloadAuthenticatedCsv, uploadAuthenticatedFile } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../StatusBadge';
import { getSupportCategoryMeta } from '../../utils/supportCategories';

export function AdminOperationsPanel({ subpage, onNotify, onRefreshBootstrap }) {
  const { user, refreshMe } = useAuth();

  // Releases state
  const [releases, setReleases] = useState([]);
  const [editingReleaseId, setEditingReleaseId] = useState(null);
  const [relForm, setRelForm] = useState({
    platform: 'android_apk',
    version: '1.0.1',
    file_name: 'SafarGo-v1.0.1.apk',
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

  // Database Backup & Restore state
  const [backupState, setBackupState] = useState(null);
  const [backupEmailForm, setBackupEmailForm] = useState({
    backup_email: 'gosafar4@gmail.com',
    backup_smtp_user: 'gosafar4@gmail.com',
    backup_smtp_pass: '',
    backup_webhook_url: '',
    backup_resend_key: '',
  });
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(null);
  const [restoreSuccess, setRestoreSuccess] = useState(null);
  const [showAppsScript, setShowAppsScript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

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
      } else if (subpage === 'backups') {
        const [bk, cfg] = await Promise.all([
          apiRequest('/api/admin/backups'),
          apiRequest('/api/admin/settings'),
        ]);
        setBackupState(bk);
        setSysSettings(cfg);
        setBackupEmailForm({
          backup_email: cfg.backup_email || bk.backup_email || 'gosafar4@gmail.com',
          backup_smtp_user: cfg.backup_smtp_user || bk.smtp_user || 'gosafar4@gmail.com',
          backup_smtp_pass: '',
          backup_webhook_url: '',
          backup_resend_key: '',
        });
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
          file_name: 'SafarGo-v1.0.1.apk',
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
            No customer feedback or support complaints submitted yet.
          </div>
        ) : (
          tickets.map((t) => {
            const catMeta = getSupportCategoryMeta(t.category);
            return (
              <div key={t.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                <div className="flex flex-wrap justify-between items-center gap-2 font-bold">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${catMeta.badgeClass}`}>
                      {catMeta.label}
                    </span>
                    {t.booking_code && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 mono-num">
                        {t.booking_code}
                      </span>
                    )}
                    <span className="text-slate-900">
                      {t.subject} — {t.user_name} ({t.user_phone})
                    </span>
                  </div>
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
                <p className="text-slate-600 leading-relaxed">{t.message}</p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const reply = e.target.reply.value;
                    await apiRequest(`/api/admin/tickets/${t.id}`, {
                      method: 'PATCH',
                      body: { status: 'resolved', admin_reply: reply },
                    });
                    onNotify('Reply sent & ticket resolved!');
                    await loadSubpage();
                  }}
                  className="flex gap-2 pt-1"
                >
                  <input
                    name="reply"
                    required
                    defaultValue={t.admin_reply || ''}
                    placeholder="Type reply to customer / resolve..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
                  />
                  <button type="submit" className="px-4 py-2 rounded-xl bg-[#009E4D] text-white font-bold">
                    Reply &amp; Resolve
                  </button>
                </form>
              </div>
            );
          })
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
          onNotify('City / Zone updated!');
        } else {
          await apiRequest('/api/admin/zones', { method: 'POST', body });
          onNotify('City / Zone added!');
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
            <span className="font-extrabold text-sm">Cities &amp; Zones</span>
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

  if (subpage === 'backups') {
    const backups = backupState?.backups || [];
    const webhookConfigured = sysSettings?.backup_webhook_url_configured === 'true';
    const resendConfigured = sysSettings?.backup_resend_key_configured === 'true';
    const httpsRelayConfigured =
      Boolean(backupState?.https_relay_configured) || webhookConfigured || resendConfigured;
    const smtpConfigured = Boolean(backupState?.smtp_configured) || sysSettings?.backup_smtp_pass_configured === 'true';
    const emailReady = Boolean(backupState?.email_configured) || httpsRelayConfigured || smtpConfigured;

    const APPS_SCRIPT_SNIPPET = `function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  var bytes = Utilities.base64Decode(d.contentBase64);
  var blob = Utilities.newBlob(bytes, d.mimeType || 'application/gzip', d.filename || 'safargo-backup.json.gz');
  GmailApp.sendEmail(d.to, d.subject, d.body, { attachments: [blob], name: 'SafarGo Backups' });
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}`;

    const handleCopyAppsScript = async () => {
      try {
        await navigator.clipboard.writeText(APPS_SCRIPT_SNIPPET);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2500);
        onNotify('Google Apps Script copy ho gaya — ab script.google.com par deploy karein!');
      } catch {
        setShowAppsScript(true);
      }
    };

    const handleRunManualBackup = async () => {
      setBackupBusy(true);
      try {
        const created = await apiRequest('/api/admin/backups/run', { method: 'POST' });
        if (created.email_status === 'sent') {
          onNotify(
            `Full DB Backup (${created.total_rows} rows, ${created.size_kb} KB) saved locally & emailed to ${created.emailed_to}!`
          );
        } else if (created.email_status === 'failed') {
          onNotify(
            `Backup (${created.total_rows} rows, ${created.size_kb} KB) app folder mein save ho gaya, lekin email failed: ${created.email_error || 'Network unreachable'}. Neeche HTTPS Gmail Relay setup karein.`,
            true
          );
        } else {
          onNotify(
            `Full DB Backup (${created.total_rows} rows, ${created.size_kb} KB) app folder & DB mein save ho gaya! (${created.email_status})`
          );
        }
        await loadSubpage();
      } catch (err) {
        onNotify(err.message, true);
      } finally {
        setBackupBusy(false);
      }
    };

    const handleSaveEmailConfig = async (e) => {
      e.preventDefault();
      try {
        const ops = [
          apiRequest('/api/admin/settings/backup_email', {
            method: 'PUT',
            body: { value: backupEmailForm.backup_email.trim() || 'gosafar4@gmail.com' },
          }),
          apiRequest('/api/admin/settings/backup_smtp_user', {
            method: 'PUT',
            body: { value: backupEmailForm.backup_smtp_user.trim() || 'gosafar4@gmail.com' },
          }),
        ];
        if (backupEmailForm.backup_smtp_pass.trim()) {
          ops.push(
            apiRequest('/api/admin/settings/backup_smtp_pass', {
              method: 'PUT',
              body: { value: backupEmailForm.backup_smtp_pass.trim() },
            })
          );
        }
        if (backupEmailForm.backup_webhook_url.trim()) {
          ops.push(
            apiRequest('/api/admin/settings/backup_webhook_url', {
              method: 'PUT',
              body: { value: backupEmailForm.backup_webhook_url.trim() },
            })
          );
        }
        if (backupEmailForm.backup_resend_key.trim()) {
          ops.push(
            apiRequest('/api/admin/settings/backup_resend_key', {
              method: 'PUT',
              body: { value: backupEmailForm.backup_resend_key.trim() },
            })
          );
        }
        await Promise.all(ops);
        onNotify('Backup Email & HTTPS Relay settings saved successfully!');
        await loadSubpage();
      } catch (err) {
        onNotify(err.message, true);
      }
    };

    const handleUploadRestoreFile = (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setRestoreConfirm({
        type: 'file',
        file,
        label: file.name,
        subtitle: `${(file.size / 1024).toFixed(1)} KB local backup file`,
      });
    };

    const executeConfirmedRestore = async () => {
      if (!restoreConfirm) return;
      const target = restoreConfirm;
      setRestoreBusy(true);
      try {
        const res =
          target.type === 'id'
            ? await apiRequest(`/api/admin/backups/${target.id}/restore`, { method: 'POST' })
            : await uploadAuthenticatedFile('/api/admin/backups/restore-file', target.file);
        setRestoreConfirm(null);
        setRestoreSuccess(res);
        onNotify(
          `Database Restored Successfully (${res.total_restored_rows} rows)! Safety backup saved locally: ${res.safety_backup_file}`
        );
        onRefreshBootstrap?.();
        await loadSubpage();
      } catch (err) {
        onNotify(err.message, true);
      } finally {
        setRestoreBusy(false);
      }
    };

    return (
      <div className="space-y-4 text-xs">
        {/* In-App Professional Restore Safety Confirmation Modal */}
        {restoreConfirm && (
          <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-amber-300 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Confirm Full Database Restore
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Safety snapshot will be saved automatically before restoring
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={restoreBusy}
                  onClick={() => setRestoreConfirm(null)}
                  className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Selected Restore Point
                </div>
                <div className="font-extrabold text-sm text-slate-900 break-all">
                  {restoreConfirm.label}
                </div>
                {restoreConfirm.subtitle && (
                  <div className="text-[11px] text-slate-600 font-semibold mono-num">
                    {restoreConfirm.subtitle}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 space-y-1 text-[11px]">
                <div className="font-extrabold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#009E4D]" />
                  Automatic Safety Guarantee
                </div>
                <p>
                  1. Pehle current live database ka <strong>Pre-Restore Safety Snapshot</strong> app folder mein{' '}
                  <em>Saved Locally (Pre-Restore)</em> mark ke saath mehfooz kiya jayega.
                </p>
                <p>
                  2. Phir Users, Captains, Photos, Bookings, Ledger, Zones aur Settings clean atomic transaction mein restore honge.
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={restoreBusy}
                  onClick={() => setRestoreConfirm(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={restoreBusy}
                  onClick={executeConfirmedRestore}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold inline-flex items-center gap-2 disabled:opacity-60"
                >
                  <RotateCcw className={`w-4 h-4 ${restoreBusy ? 'animate-spin' : ''}`} />
                  {restoreBusy ? 'Restoring Database...' : 'Yes, Restore Database Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-[11px]">
              <HardDrive className="w-3.5 h-3.5" />
              Daily Auto Backup: {backupState?.schedule_pkt || '04:00 AM PKT (Asia/Karachi)'}
            </div>
            <h2 className="text-base font-extrabold">
              Full SafarGo Database Backup &amp; Restore Center
            </h2>
            <p className="text-slate-300">
              Next scheduled backup: <strong className="text-white">{backupState?.next_backup_pkt || '04:00 AM PKT'}</strong> · App folder:{' '}
              <span className="font-mono text-emerald-300">{backupState?.app_backup_dir || 'backups/'}</span> · Email:{' '}
              <strong className="text-amber-300">{backupState?.backup_email || 'gosafar4@gmail.com'}</strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={backupBusy}
              onClick={handleRunManualBackup}
              className="px-4 py-2.5 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-extrabold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${backupBusy ? 'animate-spin' : ''}`} />
              {backupBusy ? 'Creating Backup...' : 'Take Full Backup & Email Now'}
            </button>
          </div>
        </div>

        {/* Professional Prominent Restore Confirmation Summary Banner */}
        {restoreSuccess && (
          <div className="bg-gradient-to-r from-emerald-50 via-white to-sky-50 border-2 border-[#009E4D] rounded-2xl p-5 shadow-md space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#009E4D] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-base font-extrabold text-slate-900">
                    Database Restored Successfully ✓
                  </div>
                  <div className="text-xs text-slate-600 font-semibold">
                    Tamam SafarGo records safely restore ho chuke hain ({restoreSuccess.restored_at_pkt || 'Just now PKT'}).
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreSuccess(null)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
              <div className="p-3 rounded-xl bg-white border border-emerald-200">
                <div className="text-slate-500 font-bold uppercase text-[10px]">Total Restored Records</div>
                <div className="text-base font-extrabold text-[#008741] mono-num mt-0.5">
                  {restoreSuccess.total_restored_rows} rows
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <div className="text-slate-500 font-bold uppercase text-[10px]">Restored From Snapshot</div>
                <div className="font-bold text-slate-900 mt-0.5 truncate">
                  {restoreSuccess.source_backup_pkt || 'Uploaded Backup File'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <div className="text-slate-500 font-bold uppercase text-[10px]">Pre-Restore Safety Copy</div>
                <div className="font-mono font-bold text-slate-800 mt-0.5 truncate" title={restoreSuccess.safety_backup_file}>
                  {restoreSuccess.safety_backup_file} ({restoreSuccess.safety_backup_status === 'local_only' ? 'Saved Locally' : restoreSuccess.safety_backup_status})
                </div>
              </div>
            </div>

            {restoreSuccess.restored_counts && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(restoreSuccess.restored_counts)
                  .filter(([, count]) => Number(count) > 0)
                  .map(([tbl, count]) => (
                    <span
                      key={tbl}
                      className="px-2.5 py-1 rounded-full bg-white border border-emerald-200 text-slate-700 font-bold text-[10px] mono-num"
                    >
                      {tbl}: {count}
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Email & App Directory Dual Delivery Settings */}
          <form onSubmit={handleSaveEmailConfig} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[#009E4D]" />
                Dual Save: App Folder + Gmail ({backupEmailForm.backup_email})
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  webhookConfigured || resendConfigured
                    ? 'bg-emerald-100 text-[#008741]'
                    : smtpConfigured
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {webhookConfigured
                  ? 'HTTPS Gmail Relay Active ✓'
                  : resendConfigured
                  ? 'Resend HTTPS Active ✓'
                  : smtpConfigured
                  ? 'SMTP Active (Local PC)'
                  : 'Setup HTTPS Relay / Email'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 text-[11px] space-y-1">
              <div className="font-extrabold">
                Cloud Hosting Note (Fix for [Errno 101] Network is unreachable):
              </div>
              <p>
                Render cloud servers Gmail SMTP ports (465/587) block karte hain. Cloud par reliable{' '}
                <strong>gosafar4@gmail.com</strong> email ke liye neeche <strong>Google Apps Script HTTPS Webhook URL</strong>{' '}
                (HTTPS port 443 — hamesha chalta hai) ya <strong>Resend API Key</strong> enter karein. Local PC 4 AM task SMTP bhi use karta hai.
              </p>
              <button
                type="button"
                onClick={() => setShowAppsScript((v) => !v)}
                className="font-extrabold text-sky-800 underline hover:text-sky-950"
              >
                {showAppsScript
                  ? 'Hide Free 6-Line Gmail HTTPS Script ▲'
                  : 'Get Free 6-Line Google Apps Script (Sends via gosafar4@gmail.com) ▼'}
              </button>
              {showAppsScript && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-900 text-emerald-300 space-y-2">
                  <div className="text-[10px] text-slate-200 leading-relaxed">
                    1. Open <strong>script.google.com</strong> logged in as <strong>gosafar4@gmail.com</strong> → New Project.<br />
                    2. Paste code below → <strong>Deploy → New deployment → Web app</strong> (Execute as: <em>Me</em>, Access: <em>Anyone</em>).<br />
                    3. Copy Web App URL (`https://script.google.com/macros/s/.../exec`) &amp; paste below.
                  </div>
                  <pre className="text-[10px] font-mono overflow-x-auto bg-slate-950 p-2 rounded-lg text-emerald-200">
                    {APPS_SCRIPT_SNIPPET}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopyAppsScript}
                    className="px-3 py-1.5 rounded-lg bg-[#009E4D] text-white font-bold inline-flex items-center gap-1.5"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? 'Copied Script!' : 'Copy Google Apps Script'}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Backup Receiver Email</label>
                  <input
                    type="email"
                    required
                    value={backupEmailForm.backup_email}
                    onChange={(e) => setBackupEmailForm({ ...backupEmailForm, backup_email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Gmail HTTPS Webhook URL {webhookConfigured ? '(Saved ✓)' : '(Recommended on Render)'}
                  </label>
                  <input
                    type="url"
                    placeholder={
                      webhookConfigured
                        ? '•••••••• (Saved ✓ — leave blank to keep)'
                        : 'https://script.google.com/macros/s/.../exec'
                    }
                    value={backupEmailForm.backup_webhook_url}
                    onChange={(e) => setBackupEmailForm({ ...backupEmailForm, backup_webhook_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Resend API Key {resendConfigured ? '(Saved ✓)' : '(Optional HTTPS)'}
                  </label>
                  <input
                    type="password"
                    placeholder={resendConfigured ? '•••••••• (Saved ✓)' : 're_xxxxxxxxx'}
                    value={backupEmailForm.backup_resend_key}
                    onChange={(e) => setBackupEmailForm({ ...backupEmailForm, backup_resend_key: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Gmail Sender (Local SMTP)</label>
                  <input
                    type="email"
                    required
                    value={backupEmailForm.backup_smtp_user}
                    onChange={(e) => setBackupEmailForm({ ...backupEmailForm, backup_smtp_user: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Gmail App Password {smtpConfigured ? '(Saved ✓)' : '(16 chars)'}
                  </label>
                  <input
                    type="password"
                    placeholder={smtpConfigured ? '•••••••• (Saved ✓)' : 'xxxx xxxx xxxx xxxx'}
                    value={backupEmailForm.backup_smtp_pass}
                    onChange={(e) => setBackupEmailForm({ ...backupEmailForm, backup_smtp_pass: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="submit" className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold">
                Save Email Backup Settings
              </button>
              {!emailReady && (
                <span className="text-[11px] font-bold text-amber-700">
                  HTTPS Relay or Gmail App Password needed for cloud email
                </span>
              )}
            </div>
          </form>

          {/* Restore Database from Backup File */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                Restore Full Database from Backup File
              </div>
              <p className="text-[11px] text-slate-500">
                App folder (<code className="bg-slate-100 px-1 rounded">backups/</code>) ya <strong>gosafar4@gmail.com</strong> se download ki gayi <code className="bg-slate-100 px-1 rounded">.json.gz</code> / <code className="bg-slate-100 px-1 rounded">.json</code> file upload karke poora database restore karein. System pehle safety snapshot khud save karta hai.
              </p>
            </div>
            <label className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 hover:bg-amber-50 cursor-pointer text-center transition">
              <Upload className="w-6 h-6 text-amber-600 mb-1.5" />
              <span className="font-extrabold text-slate-900">
                {restoreBusy ? 'Restoring Database...' : 'Select SafarGo Backup File (.json.gz / .json)'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                Restores Users, Captains, Photos, Bookings, Ledger, Zones &amp; Settings
              </span>
              <input
                type="file"
                accept=".gz,.json,application/gzip,application/json"
                disabled={restoreBusy}
                className="hidden"
                onChange={handleUploadRestoreFile}
              />
            </label>
          </div>
        </div>

        {/* Saved Snapshots Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-x-auto">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <span className="font-extrabold text-sm text-slate-900">
              Saved Full Backups ({backups.length}) — PKT Timestamps
            </span>
            <span className="text-[11px] text-slate-500">Auto-retention: 30 days on disk · 7 snapshots instant download</span>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="p-3.5">Date &amp; Time (PKT)</th>
                <th className="p-3.5">Trigger / File</th>
                <th className="p-3.5">Rows / Size</th>
                <th className="p-3.5">Email (gosafar4@gmail.com)</th>
                <th className="p-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No backup snapshots yet — click <strong>Take Full Backup &amp; Email Now</strong> above.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id}>
                    <td className="p-3.5 mono-num font-bold text-slate-900">
                      <div>{b.created_at_pkt || b.backup_date_pkt}</div>
                      <div className="text-[10px] text-slate-400">SHA: {b.sha256?.slice(0, 12)}...</div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          b.trigger_type === 'scheduled_pkt'
                            ? 'bg-emerald-50 text-[#008741]'
                            : b.trigger_type === 'pre_restore'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-sky-50 text-sky-700'
                        }`}
                      >
                        {b.trigger_type === 'scheduled_pkt'
                          ? 'Daily 04:00 AM PKT'
                          : b.trigger_type === 'pre_restore'
                          ? 'Pre-Restore Safety'
                          : 'Manual'}
                      </span>
                      <div className="text-[11px] text-slate-600 font-mono mt-1">{b.file_name}</div>
                    </td>
                    <td className="p-3.5 mono-num">
                      <div className="font-bold text-slate-900">{b.total_rows} rows</div>
                      <div className="text-slate-500">{b.size_kb} KB (.json.gz)</div>
                    </td>
                    <td className="p-3.5 max-w-xs">
                      {(() => {
                        const effectiveEmailStatus =
                          b.trigger_type === 'pre_restore' && b.email_status === 'pending'
                            ? 'local_only'
                            : b.email_status;
                        return (
                          <>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                effectiveEmailStatus === 'sent'
                                  ? 'bg-emerald-100 text-[#008741]'
                                  : effectiveEmailStatus === 'local_only'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : effectiveEmailStatus === 'failed'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {effectiveEmailStatus === 'sent'
                                ? `Sent to ${b.emailed_to}`
                                : effectiveEmailStatus === 'local_only'
                                ? 'Saved Locally (Pre-Restore)'
                                : effectiveEmailStatus === 'smtp_not_configured'
                                ? 'Relay / SMTP Needed'
                                : effectiveEmailStatus === 'failed'
                                ? 'Email Failed'
                                : effectiveEmailStatus}
                            </span>
                            {b.email_error && effectiveEmailStatus !== 'sent' && effectiveEmailStatus !== 'local_only' && (
                              <div className="text-[10px] text-rose-700 mt-1 leading-snug break-words" title={b.email_error}>
                                {b.email_error}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="p-3.5 whitespace-nowrap space-x-1.5">
                      {b.has_download && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await downloadAuthenticatedCsv(`/api/admin/backups/${b.id}/download`, b.file_name);
                            } catch (err) {
                              onNotify(err.message, true);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </button>
                      )}
                      {b.has_download && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await apiRequest(`/api/admin/backups/${b.id}/email`, { method: 'POST' });
                              onNotify(
                                res.email_status === 'sent'
                                  ? `Backup emailed to ${res.emailed_to}!`
                                  : `Email failed: ${res.email_error || res.email_status}`,
                                res.email_status !== 'sent'
                              );
                              await loadSubpage();
                            } catch (err) {
                              onNotify(err.message, true);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-bold inline-flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" />
                          Email
                        </button>
                      )}
                      {b.has_download && (
                        <button
                          type="button"
                          disabled={restoreBusy}
                          onClick={() =>
                            setRestoreConfirm({
                              type: 'id',
                              id: b.id,
                              label: b.created_at_pkt || b.file_name,
                              subtitle: `${b.file_name} (${b.total_rows} rows · ${b.size_kb} KB)`,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 font-bold inline-flex items-center gap-1 disabled:opacity-60"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <div>
          <div className="font-extrabold text-sm text-slate-900">
            Office Address, Helpline &amp; Business Settings
          </div>
          <p className="text-slate-500 mt-0.5">
            Changes here automatically show on the SafarGo Home Page bottom footer and Support sections.
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const fields = [
                'office_address',
                'support_phone',
                'support_whatsapp',
                'emergency_rescue_number',
                'emergency_police_number',
                'office_hours',
                'business_name',
                'city',
                'default_credit_limit',
                'rider_topup_required',
                'rider_topup_rides_count',
                'rider_topup_package_fee',
                'rider_topup_car_package_fee',
              ];
              await Promise.all(
                fields.map((key) =>
                  apiRequest(`/api/admin/settings/${key}`, {
                    method: 'PUT',
                    body: { value: String(sysSettings[key] ?? '').trim() },
                  })
                )
              );
              onNotify('Office address, WhatsApp & helpline saved!');
              onRefreshBootstrap();
            } catch (err) {
              onNotify(err.message, true);
            }
          }}
          className="space-y-3"
        >
          {[
            { key: 'office_address', label: 'Office Address', placeholder: 'e.g. Main Bazar / Shahrah-e-Resham, Mansehra' },
            { key: 'support_phone', label: 'Helpline Phone #', placeholder: 'e.g. +92 300 1111111' },
            { key: 'support_whatsapp', label: 'WhatsApp Number', placeholder: 'e.g. +92 300 1111111' },
            { key: 'emergency_rescue_number', label: 'Rescue Helpline #', placeholder: '1122' },
            { key: 'emergency_police_number', label: 'Police Emergency #', placeholder: '15' },
            { key: 'office_hours', label: 'Office & Dispatch Hours', placeholder: 'e.g. 24/7 Dispatch · 8 AM – 11 PM' },
            { key: 'business_name', label: 'Brand Name', placeholder: 'SafarGo' },
            { key: 'city', label: 'Operating Cities', placeholder: 'Hazara & Intercity' },
            { key: 'default_credit_limit', label: 'Default Rider Limit (Rs.)', placeholder: '1500' },
            {
              key: 'rider_topup_required',
              label: 'Captain Top-Up Mode',
              type: 'select',
              options: [
                { value: 'true', label: 'ON — Pre-Paid Top-Up Required (10 Rides = Rs. 100)' },
                { value: 'false', label: 'OFF — Free / No Pre-Paid Top-Up Required' },
              ],
            },
            { key: 'rider_topup_rides_count', label: 'Top-Up Rides Count', placeholder: '10' },
            { key: 'rider_topup_package_fee', label: 'Top-Up Package Fee (Rs.)', placeholder: '100' },
            { key: 'rider_topup_car_package_fee', label: 'Car Top-Up Fee (opt. Rs.)', placeholder: 'Blank = Same as Bike (100)' },
          ].map((f) => (
            <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
              <label className="sm:w-44 font-semibold text-slate-700 shrink-0">{f.label}</label>
              {f.type === 'select' ? (
                <select
                  value={String(sysSettings[f.key] ?? 'true').toLowerCase() === 'false' ? 'false' : 'true'}
                  onChange={(e) => setSysSettings({ ...sysSettings, [f.key]: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50/70 font-bold text-slate-900 focus:bg-white focus:border-[#009E4D] focus:outline-none"
                >
                  {f.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={f.placeholder}
                  value={sysSettings[f.key] ?? ''}
                  onChange={(e) => setSysSettings({ ...sysSettings, [f.key]: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 focus:bg-white focus:border-[#009E4D] focus:outline-none"
                />
              )}
            </div>
          ))}
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-bold transition"
          >
            Save Office &amp; Contact Settings
          </button>
        </form>
      </div>
    </div>
  );
}
