import React, { useState } from 'react';
import { Bike, Car, CheckCircle2, FileCheck2, KeyRound, MapPin, Pencil, Trash2, X, XCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { StatusBadge } from '../StatusBadge';
import { CaptainPhotoUploads } from '../CaptainPhotoUploads';

export function AdminPeoplePanel({
  mode, // 'riders' | 'customers'
  riders,
  customers,
  zones,
  onReloadRiders,
  onReloadCustomers,
  onNotify,
}) {
  // Password & Verification Docs Review Modals
  const [pwTarget, setPwTarget] = useState(null); // { id, name, role }
  const [newPassword, setNewPassword] = useState('');
  const [tripsRiderId, setTripsRiderId] = useState(null);
  const [docsRiderId, setDocsRiderId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  // Rider Form State (Create or Edit)
  const [editingRiderId, setEditingRiderId] = useState(null);
  const [riderForm, setRiderForm] = useState({
    full_name: '',
    phone: '',
    password: 'rider123',
    vehicle_type: 'bike',
    bike_model: 'Honda CD-70',
    bike_plate: '',
    cnic_number: '',
    license_no: '',
    zone_name: zones?.[0]?.name || 'Main Bazar / Lari Adda',
    credit_limit: 1500,
    custom_commission_type: 'none',
    custom_commission_value: '',
  });

  // Customer Form State (Create or Edit)
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [custForm, setCustForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: 'user123',
  });

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!pwTarget) return;
    try {
      await apiRequest(`/api/admin/users/${pwTarget.id}/password`, {
        method: 'PATCH',
        body: { new_password: newPassword },
      });
      onNotify(`Password updated for ${pwTarget.name}!`);
      setPwTarget(null);
      setNewPassword('');
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const resetRiderForm = () => {
    setEditingRiderId(null);
    setRiderForm({
      full_name: '',
      phone: '',
      password: 'rider123',
      vehicle_type: 'bike',
      bike_model: 'Honda CD-70',
      bike_plate: '',
      cnic_number: '',
      license_no: '',
      zone_name: zones?.[0]?.name || 'Main Bazar / Lari Adda',
      credit_limit: 1500,
      custom_commission_type: 'none',
      custom_commission_value: '',
    });
  };

  const handleSaveRider = async (e) => {
    e.preventDefault();
    try {
      if (editingRiderId) {
        await apiRequest(`/api/admin/riders/${editingRiderId}`, {
          method: 'PATCH',
          body: {
            full_name: riderForm.full_name,
            phone: riderForm.phone,
            vehicle_type: riderForm.vehicle_type,
            bike_model: riderForm.bike_model,
            bike_plate: riderForm.bike_plate,
            cnic_number: riderForm.cnic_number || null,
            license_no: riderForm.license_no || null,
            zone_name: riderForm.zone_name,
            credit_limit: Number(riderForm.credit_limit),
            custom_commission_type: riderForm.custom_commission_type || 'none',
            custom_commission_value:
              riderForm.custom_commission_type !== 'none' && riderForm.custom_commission_value !== ''
                ? Number(riderForm.custom_commission_value)
                : null,
          },
        });
        onNotify(`${riderForm.vehicle_type === 'car' ? 'AC Car' : 'Bike'} Captain details updated!`);
      } else {
        await apiRequest('/api/admin/riders', {
          method: 'POST',
          body: {
            full_name: riderForm.full_name,
            phone: riderForm.phone,
            password: riderForm.password,
            vehicle_type: riderForm.vehicle_type,
            bike_model: riderForm.bike_model,
            bike_plate: riderForm.bike_plate,
            cnic_number: riderForm.cnic_number || null,
            license_no: riderForm.license_no || null,
            zone_name: riderForm.zone_name,
            credit_limit: Number(riderForm.credit_limit),
            custom_commission_type:
              riderForm.custom_commission_type !== 'none' ? riderForm.custom_commission_type : null,
            custom_commission_value:
              riderForm.custom_commission_type !== 'none' && riderForm.custom_commission_value !== ''
                ? Number(riderForm.custom_commission_value)
                : null,
            is_verified: false,
          },
        });
        onNotify(`New ${riderForm.vehicle_type === 'car' ? 'AC Car' : 'Bike'} Captain registered! Upload all 4 verification docs before Admin approval.`);
      }
      resetRiderForm();
      onReloadRiders();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleDeleteRider = async (r) => {
    if (!window.confirm(`Delete Captain ${r.full_name} (${r.bike_plate}) and their ledger?`)) return;
    try {
      await apiRequest(`/api/admin/riders/${r.id}`, { method: 'DELETE' });
      onNotify(`Captain ${r.full_name} deleted.`);
      onReloadRiders();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomerId) {
        await apiRequest(`/api/admin/customers/${editingCustomerId}`, {
          method: 'PATCH',
          body: {
            full_name: custForm.full_name,
            phone: custForm.phone,
            email: custForm.email || null,
          },
        });
        onNotify('Customer details updated!');
      } else {
        await apiRequest('/api/admin/customers', {
          method: 'POST',
          body: {
            full_name: custForm.full_name,
            phone: custForm.phone,
            email: custForm.email || null,
            password: custForm.password,
          },
        });
        onNotify('New Customer added!');
      }
      setEditingCustomerId(null);
      setCustForm({ full_name: '', phone: '', email: '', password: 'user123' });
      onReloadCustomers();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleDeleteCustomer = async (c) => {
    if (!window.confirm(`Delete Customer ${c.full_name} and all their bookings?`)) return;
    try {
      await apiRequest(`/api/admin/customers/${c.id}`, { method: 'DELETE' });
      onNotify(`Customer ${c.full_name} deleted.`);
      onReloadCustomers();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Admin-Only Password Reset Modal */}
      {pwTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={handlePasswordSubmit} className="bg-white border border-slate-200/80 rounded-2xl p-5 w-full max-w-sm space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-sm text-slate-900">
                Change Password ({pwTarget.name})
              </div>
              <button type="button" onClick={() => setPwTarget(null)} className="text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-500">
              Only Admin can change passwords for Admins, Motorbike Captains, and Customers.
            </p>
            <input
              type="text"
              required
              minLength={4}
              placeholder="Enter new password (min 4 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#009E4D] text-white font-bold">
                Update Password
              </button>
              <button type="button" onClick={() => setPwTarget(null)} className="px-4 py-2.5 rounded-xl border">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {mode === 'riders' ? (
        <>
          {/* Captain Document Verification Modal (Shared identically for Bike & Car Captains) */}
          {docsRiderId && (() => {
            const dr = riders.find((r) => r.id === docsRiderId);
            if (!dr) return null;
            const isCar = dr.vehicle_type === 'car';
            const missingList = [
              !dr.rider_photo && 'Captain Selfie / Photo',
              !dr.vehicle_photo && (isCar ? 'Car Photo' : 'Bike Photo'),
              !dr.cnic_front_photo && 'CNIC Front Photo',
              !dr.cnic_back_photo && 'CNIC Back / Driving License',
              !(dr.cnic_number || '').trim() && 'CNIC Number',
              !(dr.bike_model || '').trim() && 'Vehicle Model',
              !(dr.bike_plate || '').trim() && 'Number Plate',
            ].filter(Boolean);
            const allDocsComplete = missingList.length === 0;
            return (
              <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-3xl p-5 w-full max-w-2xl space-y-4 shadow-2xl my-auto">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                        {isCar ? <Car className="w-4 h-4 text-sky-600" /> : <Bike className="w-4 h-4 text-[#009E4D]" />}
                        <span>
                          Verification Review — {dr.full_name} ({isCar ? 'AC Car Captain' : 'Bike Captain'})
                        </span>
                        <StatusBadge value={dr.is_verified ? 'verified' : dr.verification_status || 'pending'} />
                      </div>
                      <div className="text-slate-500 mono-num mt-0.5">
                        {dr.phone} · {dr.bike_model} ({dr.bike_plate}) · CNIC: {dr.cnic_number || 'N/A'} · Lic: {dr.license_no || 'N/A'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDocsRiderId(null);
                        setRejectNote('');
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <CaptainPhotoUploads
                    vehicleType={dr.vehicle_type || 'bike'}
                    photos={{
                      rider_photo: dr.rider_photo,
                      vehicle_photo: dr.vehicle_photo,
                      cnic_front_photo: dr.cnic_front_photo,
                      cnic_back_photo: dr.cnic_back_photo,
                    }}
                    onChangePhoto={async (slotKey, dataUrl) => {
                      try {
                        await apiRequest(`/api/admin/riders/${dr.id}`, {
                          method: 'PATCH',
                          body: { [slotKey]: dataUrl },
                        });
                        onNotify(`Updated ${slotKey.replace(/_/g, ' ')} for ${dr.full_name}.`);
                        onReloadRiders();
                      } catch (err) {
                        onNotify(err.message, true);
                      }
                    }}
                  />

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    {!allDocsComplete && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px] font-bold">
                        Incomplete Documents — Admin cannot verify yet. Missing: <span className="text-rose-700">{missingList.join(', ')}</span>
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="Optional note or rejection reason (e.g. Upload clearer CNIC front)"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!allDocsComplete}
                        onClick={async () => {
                          try {
                            await apiRequest(`/api/admin/riders/${dr.id}`, {
                              method: 'PATCH',
                              body: { is_verified: true, verification_status: 'verified' },
                            });
                            onNotify(`${dr.full_name} verified and unlocked for live rides!`);
                            setDocsRiderId(null);
                            setRejectNote('');
                            onReloadRiders();
                          } catch (err) {
                            onNotify(err.message, true);
                          }
                        }}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-[#009E4D] hover:bg-[#008741] disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-extrabold inline-flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {allDocsComplete ? 'Approve & Verify Captain ✓' : 'Complete All Docs to Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/riders/${dr.id}`, {
                            method: 'PATCH',
                            body: {
                              is_verified: false,
                              verification_status: 'rejected',
                              verification_note: rejectNote.trim() || 'Please re-upload clear Selfie, Vehicle & CNIC photos.',
                            },
                          });
                          onNotify(`Returned docs to ${dr.full_name} for re-upload.`);
                          setDocsRiderId(null);
                          setRejectNote('');
                          onReloadRiders();
                        }}
                        className="py-2.5 px-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject Docs
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <form onSubmit={handleSaveRider} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-slate-900">
                {editingRiderId ? 'Edit Bike / AC Car Captain' : '+ Register New Bike / AC Car Captain (Admin Verifies After Docs)'}
              </span>
              {editingRiderId && (
                <button type="button" onClick={resetRiderForm} className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Cancel Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input
                type="text"
                required
                placeholder="Captain Full Name"
                value={riderForm.full_name}
                onChange={(e) => setRiderForm({ ...riderForm, full_name: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
              <input
                type="text"
                required
                placeholder="Mobile (03...)"
                value={riderForm.phone}
                onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
              <select
                value={riderForm.vehicle_type}
                onChange={(e) => setRiderForm({ ...riderForm, vehicle_type: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-bold"
              >
                <option value="bike">Bike Captain</option>
                <option value="car">Car Captain</option>
              </select>
              <input
                type="text"
                required
                placeholder="Model (CD-70 / Alto)"
                value={riderForm.bike_model}
                onChange={(e) => setRiderForm({ ...riderForm, bike_model: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
              <input
                type="text"
                required
                placeholder="Bike Plate (MNA-1234)"
                value={riderForm.bike_plate}
                onChange={(e) => setRiderForm({ ...riderForm, bike_plate: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="CNIC"
                value={riderForm.cnic_number}
                onChange={(e) => setRiderForm({ ...riderForm, cnic_number: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
              <select
                value={riderForm.zone_name}
                onChange={(e) => setRiderForm({ ...riderForm, zone_name: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.name}>{z.name}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Credit Cap (Rs.)"
                value={riderForm.credit_limit}
                onChange={(e) => setRiderForm({ ...riderForm, credit_limit: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
              />
              <select
                value={riderForm.custom_commission_type}
                onChange={(e) => setRiderForm({ ...riderForm, custom_commission_type: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              >
                <option value="none">Global Comm. Rate</option>
                <option value="percent">Custom %</option>
                <option value="fixed">Custom Flat Rs.</option>
              </select>
              {riderForm.custom_commission_type !== 'none' ? (
                <input
                  type="number"
                  step="0.5"
                  placeholder="Custom Comm Val"
                  value={riderForm.custom_commission_value}
                  onChange={(e) => setRiderForm({ ...riderForm, custom_commission_value: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 mono-num font-bold"
                />
              ) : !editingRiderId ? (
                <input
                  type="text"
                  placeholder="Initial Password"
                  value={riderForm.password}
                  onChange={(e) => setRiderForm({ ...riderForm, password: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
                />
              ) : (
                <div />
              )}
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#009E4D] text-white font-bold">
              {editingRiderId ? 'Save Captain Changes' : 'Save New Captain'}
            </button>
          </form>

          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="p-3.5">Captain &amp; Vehicle</th>
                  <th className="p-3.5">Zone &amp; Docs Status</th>
                  <th className="p-3.5">Trips / Rating</th>
                  <th className="p-3.5">Due / Cap</th>
                  <th className="p-3.5">Commission</th>
                  <th className="p-3.5">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {riders.map((r) => {
                  const docCount = [r.rider_photo, r.vehicle_photo, r.cnic_front_photo, r.cnic_back_photo].filter(Boolean).length;
                  const canApproveRow = docCount === 4 && Boolean(r.has_required_docs && (r.cnic_number || '').trim() && (r.bike_model || '').trim() && (r.bike_plate || '').trim());
                  const isCar = r.vehicle_type === 'car';
                  return (
                  <tr key={r.id}>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        {r.rider_photo ? (
                          <img src={r.rider_photo} alt={r.full_name} className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-extrabold text-slate-600 shrink-0">
                            {(r.full_name || 'C')[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{r.full_name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${isCar ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-emerald-50 text-[#008741] border border-emerald-200'}`}>
                              {isCar ? 'CAR' : 'BIKE'}
                            </span>
                          </div>
                          <div className="mono-num text-slate-500">{r.phone} · {r.bike_model} ({r.bike_plate})</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div>{r.zone_name}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${r.is_verified ? 'bg-emerald-50 text-[#008741]' : r.verification_status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                          {r.is_verified ? 'Verified ✓' : r.verification_status === 'rejected' ? 'Rejected' : 'Pending Review'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-bold ${r.is_active ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-600'}`}>
                          {r.is_active ? 'Active' : 'Suspended'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setDocsRiderId(r.id);
                            setRejectNote(r.verification_note || '');
                          }}
                          className={`px-2 py-0.5 rounded-full font-bold border inline-flex items-center gap-1 ${
                            canApproveRow ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <FileCheck2 className="w-3 h-3" />
                          Docs ({docCount}/4)
                        </button>
                      </div>
                    </td>
                    <td className="p-3.5 mono-num">
                      <div className="font-bold text-slate-900">{r.total_trips} trips · <span className="text-sky-700">{r.total_distance_km ?? 0} km</span></div>
                      <div className="text-amber-600 font-bold">★ {r.rating_avg}</div>
                      {(r.recent_trips || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTripsRiderId(tripsRiderId === r.id ? null : r.id)}
                          className="mt-1 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 font-bold text-[10px] hover:bg-sky-100"
                        >
                          {tripsRiderId === r.id ? 'Hide Trips' : `View Per-Trip km (${r.recent_trips.length})`}
                        </button>
                      )}
                    </td>
                    <td className="p-3.5 mono-num">
                      <div className="font-bold text-amber-600">Due: Rs. {r.balance_due_to_admin}</div>
                      <div className="text-slate-500">Cap: Rs. {r.credit_limit}</div>
                    </td>
                    <td className="p-3.5 mono-num">
                      {r.custom_commission_type
                        ? `${r.custom_commission_value} (${r.custom_commission_type})`
                        : 'Global Rule'}
                    </td>
                    <td className="p-3.5 whitespace-nowrap space-x-1.5">
                      {!r.is_verified && (
                        canApproveRow ? (
                          <button
                            onClick={async () => {
                              try {
                                await apiRequest(`/api/admin/riders/${r.id}`, {
                                  method: 'PATCH',
                                  body: { is_verified: true, verification_status: 'verified' },
                                });
                                onNotify(`${r.full_name} verified!`);
                                onReloadRiders();
                              } catch (err) {
                                onNotify(err.message, true);
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-[#009E4D] text-white font-bold"
                          >
                            Verify
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setDocsRiderId(r.id);
                              setRejectNote(r.verification_note || '');
                            }}
                            className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                            title="Upload all 4 documents + CNIC before Admin verification"
                          >
                            Docs ({docCount}/4)
                          </button>
                        )
                      )}
                      <button
                        onClick={async () => {
                          await apiRequest(`/api/admin/riders/${r.id}`, { method: 'PATCH', body: { is_active: !r.is_active } });
                          onReloadRiders();
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-200/80 font-bold"
                      >
                        {r.is_active ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingRiderId(r.id);
                          setRiderForm({
                            full_name: r.full_name,
                            phone: r.phone,
                            password: '',
                            vehicle_type: r.vehicle_type || 'bike',
                            bike_model: r.bike_model || 'Honda CD-70',
                            bike_plate: r.bike_plate || '',
                            cnic_number: r.cnic_number || '',
                            license_no: r.license_no || '',
                            zone_name: r.zone_name || zones?.[0]?.name || '',
                            credit_limit: r.credit_limit ?? 1500,
                            custom_commission_type: r.custom_commission_type || 'none',
                            custom_commission_value: r.custom_commission_value ?? '',
                          });
                        }}
                        className="p-1.5 rounded-lg bg-slate-50/80 text-slate-700 hover:bg-slate-200"
                        title="Edit Captain"
                      >
                        <Pencil className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        onClick={() => setPwTarget({ id: r.id, name: r.full_name, role: 'rider' })}
                        className="p-1.5 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100"
                        title="Change Captain Password"
                      >
                        <KeyRound className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        onClick={() => handleDeleteRider(r)}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="Delete Captain"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {tripsRiderId && (() => {
            const target = riders.find((r) => r.id === tripsRiderId);
            if (!target) return null;
            return (
              <div className="bg-white border border-sky-200 rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">
                      Per-Trip Distance Log — {target.full_name} ({target.bike_plate})
                    </div>
                    <div className="text-slate-500 mono-num">
                      Completed Distance: <strong>{target.total_distance_km ?? 0} km</strong> across {target.total_trips} trips
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTripsRiderId(null)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Close
                  </button>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {(target.recent_trips || []).map((t) => (
                    <div key={t.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                          <span className="mono-num">{t.booking_code}</span>
                          <span className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-extrabold mono-num">
                            <MapPin className="w-3 h-3 inline mr-0.5" />
                            {t.distance_km} km
                          </span>
                          <StatusBadge value={t.status} />
                        </div>
                        <div className="text-slate-600 mt-0.5">{t.pickup_zone} → {t.drop_zone}</div>
                      </div>
                      <div className="text-right mono-num">
                        <div className="font-bold text-slate-900">Fare: Rs. {t.final_fare}</div>
                        <div className="text-[11px] text-[#008741] font-semibold">
                          Captain Net: Rs. {t.rider_earning} · Comm: Rs. {t.commission_amount}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      ) : (
        <>
          <form onSubmit={handleSaveCustomer} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-slate-900">
                {editingCustomerId ? 'Edit Customer Account' : '+ Add New Customer'}
              </span>
              {editingCustomerId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCustomerId(null);
                    setCustForm({ full_name: '', phone: '', email: '', password: 'user123' });
                  }}
                  className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancel Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="Customer Full Name"
                value={custForm.full_name}
                onChange={(e) => setCustForm({ ...custForm, full_name: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
              <input
                type="text"
                required
                placeholder="Mobile (03...)"
                value={custForm.phone}
                onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={custForm.email}
                onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
              {!editingCustomerId && (
                <input
                  type="text"
                  required
                  placeholder="Initial Password"
                  value={custForm.password}
                  onChange={(e) => setCustForm({ ...custForm, password: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
                />
              )}
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#009E4D] text-white font-bold">
              {editingCustomerId ? 'Save Customer Changes' : 'Create Customer'}
            </button>
          </form>

          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Phone / Email</th>
                  <th className="p-3.5">Bookings</th>
                  <th className="p-3.5">Total Spend</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="p-3.5 font-bold text-slate-900">{c.full_name}</td>
                    <td className="p-3.5">
                      <div className="mono-num">{c.phone}</div>
                      {c.email && <div className="text-slate-500">{c.email}</div>}
                    </td>
                    <td className="p-3.5 mono-num">{c.total_bookings}</td>
                    <td className="p-3.5 mono-num font-bold text-[#009E4D]">Rs. {c.total_spent}</td>
                    <td className="p-3.5">
                      <button
                        onClick={async () => {
                          await apiRequest(`/api/admin/customers/${c.id}/toggle-active`, { method: 'PATCH' });
                          onReloadCustomers();
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold ${
                          c.is_active ? 'bg-emerald-50 text-[#008741]' : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {c.is_active ? 'Active' : 'Blocked'}
                      </button>
                    </td>
                    <td className="p-3.5 whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingCustomerId(c.id);
                          setCustForm({
                            full_name: c.full_name,
                            phone: c.phone,
                            email: c.email || '',
                            password: '',
                          });
                        }}
                        className="p-1.5 rounded-lg bg-slate-50/80 text-slate-700 hover:bg-slate-200"
                        title="Edit Customer"
                      >
                        <Pencil className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        onClick={() => setPwTarget({ id: c.id, name: c.full_name, role: 'customer' })}
                        className="p-1.5 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100"
                        title="Change Customer Password"
                      >
                        <KeyRound className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(c)}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="Delete Customer"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
