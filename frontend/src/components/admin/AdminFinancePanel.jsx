import React, { useEffect, useState } from 'react';
import { CheckCircle2, Landmark, Pencil, Plus, Receipt, Trash2, X } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../StatusBadge';
import { getSafarGoAccountTitle } from '../../utils/paymentAccounts';

export function AdminFinancePanel({ subpage, onNotify, onRefreshBootstrap }) {
  const { bootstrap } = useAuth();
  const [balances, setBalances] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [settlementRequests, setSettlementRequests] = useState([]);
  const [topupRequests, setTopupRequests] = useState([]);
  const [topupPolicy, setTopupPolicy] = useState({
    rider_topup_required: 'true',
    rider_topup_rides_count: '10',
    rider_topup_package_fee: '100',
    rider_topup_car_package_fee: '',
  });
  const [topupEdits, setTopupEdits] = useState({});
  const [savingTopupPolicy, setSavingTopupPolicy] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [payAccounts, setPayAccounts] = useState({
    payment_account_title: 'SafarGo',
    payment_easypaisa: '',
    payment_upaisa: '',
    payment_jazzcash: '',
    payment_bank_name: '',
    payment_bank_account: '',
  });

  useEffect(() => {
    const s = bootstrap?.settings || {};
    setPayAccounts({
      payment_account_title: getSafarGoAccountTitle(s),
      payment_easypaisa: s.payment_easypaisa || '',
      payment_upaisa: s.payment_upaisa || '',
      payment_jazzcash: s.payment_jazzcash || '',
      payment_bank_name: s.payment_bank_name || '',
      payment_bank_account: s.payment_bank_account || '',
    });
    setTopupPolicy({
      rider_topup_required: String(s.rider_topup_required ?? 'true').toLowerCase() === 'false' ? 'false' : 'true',
      rider_topup_rides_count: String(s.rider_topup_rides_count || '10'),
      rider_topup_package_fee: String(s.rider_topup_package_fee || '100'),
      rider_topup_car_package_fee: s.rider_topup_car_package_fee != null ? String(s.rider_topup_car_package_fee) : '',
    });
  }, [bootstrap?.settings]);

  const [settForm, setSettForm] = useState({
    rider_id: '',
    amount: '',
    entry_type: 'settlement_to_admin',
    payment_channel: 'cash',
    reference_no: '',
    note: '',
  });

  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expForm, setExpForm] = useState({
    title: '',
    category: 'office_rent',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    note: '',
  });

  const [editingLedgerId, setEditingLedgerId] = useState(null);
  const [ledgerNoteDraft, setLedgerNoteDraft] = useState('');

  const loadFinanceData = async () => {
    try {
      const [bal, led, exp, prc, reqs, topups] = await Promise.all([
        apiRequest('/api/finance/rider-balances'),
        apiRequest('/api/finance/ledger'),
        apiRequest('/api/finance/expenses'),
        apiRequest('/api/admin/pricing'),
        apiRequest('/api/finance/settlement-requests'),
        apiRequest('/api/finance/topup-requests'),
      ]);
      setBalances(bal);
      setLedger(led);
      setExpenses(exp);
      setPricing(prc);
      setSettlementRequests(reqs);
      setTopupRequests(topups || []);
      if (!settForm.rider_id && bal.length > 0) {
        setSettForm((prev) => ({ ...prev, rider_id: String(bal[0].rider_id) }));
      }
    } catch (e) {
      onNotify(e.message, true);
    }
  };

  const handleSaveTopupPolicy = async (e) => {
    e.preventDefault();
    setSavingTopupPolicy(true);
    try {
      const updates = [
        ['rider_topup_required', String(topupPolicy.rider_topup_required === 'false' ? 'false' : 'true')],
        ['rider_topup_rides_count', String(Math.max(1, Number(topupPolicy.rider_topup_rides_count || 10)))],
        ['rider_topup_package_fee', String(Math.max(1, Number(topupPolicy.rider_topup_package_fee || 100)))],
        ['rider_topup_car_package_fee', String(topupPolicy.rider_topup_car_package_fee ?? '').trim()],
      ];
      await Promise.all(
        updates.map(([key, value]) => apiRequest(`/api/admin/settings/${key}`, { method: 'PUT', body: { value } }))
      );
      onNotify(
        topupPolicy.rider_topup_required === 'false'
          ? 'Top-Up OFF kar diya gaya — Captains ab baghair advance top-up ke rides kar sakein ge!'
          : `Top-Up ON & saved (${updates[1][1]} Rides = Rs. ${updates[2][1]})! Unpaid captains offline & hidden rahein ge.`
      );
      if (onRefreshBootstrap) await onRefreshBootstrap();
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    } finally {
      setSavingTopupPolicy(false);
    }
  };

  const handleApproveTopupReq = async (req) => {
    const draft = topupEdits[req.id] || {};
    const ridesVal = draft.rides !== undefined && draft.rides !== '' ? Number(draft.rides) : undefined;
    const amountVal = draft.amount !== undefined && draft.amount !== '' ? Number(draft.amount) : undefined;
    try {
      const res = await apiRequest(`/api/finance/topup-requests/${req.id}/approve`, {
        method: 'POST',
        body: {
          rides_granted: ridesVal,
          amount: amountVal,
          admin_note: (draft.admin_note || '').trim() || null,
        },
      });
      onNotify(
        `Top-Up approved! ${req.rider_name} ko +${res.rides_approved} rides mil gayein (Total left: ${res.remaining_paid_rides}).`
      );
      if (onRefreshBootstrap) await onRefreshBootstrap();
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleRejectTopupReq = async (req) => {
    const draft = topupEdits[req.id] || {};
    try {
      await apiRequest(`/api/finance/topup-requests/${req.id}/reject`, {
        method: 'POST',
        body: {
          admin_note: (draft.admin_note || '').trim() || null,
        },
      });
      onNotify(`Top-Up request (#${req.id}) rejected.`);
      if (onRefreshBootstrap) await onRefreshBootstrap();
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleAskTopupProof = async (req) => {
    const draft = topupEdits[req.id] || {};
    try {
      await apiRequest(`/api/finance/topup-requests/${req.id}/request-proof`, {
        method: 'POST',
        body: {
          admin_note: (draft.admin_note || '').trim() || null,
        },
      });
      onNotify(`${req.rider_name} se TID / payment proof maang liya gaya hai.`);
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleSavePayAccounts = async (e) => {
    e.preventDefault();
    try {
      const sanitizedTitle = getSafarGoAccountTitle({ payment_account_title: payAccounts.payment_account_title });
      const entries = [
        ['payment_account_title', sanitizedTitle],
        ['payment_easypaisa', payAccounts.payment_easypaisa.trim()],
        ['payment_upaisa', payAccounts.payment_upaisa.trim()],
        ['payment_jazzcash', payAccounts.payment_jazzcash.trim()],
        ['payment_bank_name', payAccounts.payment_bank_name.trim()],
        ['payment_bank_account', payAccounts.payment_bank_account.trim()],
      ];
      await Promise.all(
        entries.map(([key, value]) => apiRequest(`/api/admin/settings/${key}`, { method: 'PUT', body: { value } }))
      );
      onNotify('SafarGo receiving payment accounts saved!');
      if (onRefreshBootstrap) await onRefreshBootstrap();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleApproveSettlementReq = async (reqId) => {
    try {
      await apiRequest(`/api/finance/settlement-requests/${reqId}/mark-paid`, { method: 'POST' });
      onNotify('Payment confirmed as PAID and rider balance updated!');
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleRejectSettlementReq = async (reqId) => {
    try {
      await apiRequest(`/api/finance/settlement-requests/${reqId}/reject`, { method: 'POST' });
      onNotify('Settlement proof rejected.');
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  useEffect(() => {
    loadFinanceData();
  }, [subpage]);

  const handleSettlement = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/finance/settlements', {
        method: 'POST',
        body: {
          rider_id: Number(settForm.rider_id),
          amount: Number(settForm.amount),
          entry_type: settForm.entry_type,
          payment_channel: settForm.payment_channel,
          reference_no: settForm.reference_no || null,
          note: settForm.note || null,
        },
      });
      setSettForm((prev) => ({ ...prev, amount: '', reference_no: '', note: '' }));
      onNotify('Settlement recorded and rider balance updated!');
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: expForm.title,
        category: expForm.category,
        amount: Number(expForm.amount),
        expense_date: expForm.expense_date,
        note: expForm.note || null,
      };
      if (editingExpenseId) {
        await apiRequest(`/api/finance/expenses/${editingExpenseId}`, {
          method: 'PATCH',
          body: payload,
        });
        onNotify('Expense updated.');
      } else {
        await apiRequest('/api/finance/expenses', { method: 'POST', body: payload });
        onNotify('Expense added to P&L ledger.');
      }
      setEditingExpenseId(null);
      setExpForm({
        title: '',
        category: 'office_rent',
        amount: '',
        expense_date: new Date().toISOString().slice(0, 10),
        note: '',
      });
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense entry?')) return;
    try {
      await apiRequest(`/api/finance/expenses/${id}`, { method: 'DELETE' });
      onNotify('Expense removed.');
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleSaveLedgerNote = async (entryId) => {
    try {
      await apiRequest(`/api/finance/ledger/${entryId}`, {
        method: 'PATCH',
        body: { note: ledgerNoteDraft },
      });
      setEditingLedgerId(null);
      onNotify('Ledger note updated.');
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleDeleteLedgerEntry = async (entryId) => {
    if (!window.confirm('Delete this manual settlement entry and recalculate rider balance?')) return;
    try {
      await apiRequest(`/api/finance/ledger/${entryId}`, { method: 'DELETE' });
      onNotify('Manual ledger entry deleted and balance recalculated.');
      await loadFinanceData();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const handleSavePricing = async (rule) => {
    try {
      await apiRequest(`/api/admin/pricing/${rule.service_type}`, {
        method: 'PATCH',
        body: {
          display_name: rule.display_name,
          base_fare: Number(rule.base_fare),
          per_km_rate: Number(rule.per_km_rate),
          min_fare: Number(rule.min_fare),
          city_flat_km: Number(rule.city_flat_km || 0),
          city_flat_fare: Number(rule.city_flat_fare || 0),
          wait_free_minutes: Number(rule.wait_free_minutes ?? 5),
          wait_charge_per_min: Number(rule.wait_charge_per_min ?? 10),
          commission_type: rule.commission_type,
          commission_value: Number(rule.commission_value),
          peak_multiplier: Number(rule.peak_multiplier),
          is_active: rule.is_active,
        },
      });
      onNotify(`Updated ${rule.display_name} fare & commission rules!`);
      await loadFinanceData();
      if (onRefreshBootstrap) onRefreshBootstrap();
    } catch (err) {
      onNotify(err.message, true);
    }
  };

  const updateRuleField = (idx, field, val) => {
    setPricing((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  };

  if (subpage === 'pricing') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-[#008741] font-medium">
          <strong>Live Commission &amp; Fare Control:</strong> Adjust Base Fare, Per Km, City Fix Slab (e.g. Mansehra Parcel Rs. 250 / 3 km), Customer Late Wait Fee (Rs./min after free grace min), Commission %, or pause any service anytime.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {pricing.map((rule, idx) => (
            <div key={rule.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                <input
                  type="text"
                  value={rule.display_name}
                  onChange={(e) => updateRuleField(idx, 'display_name', e.target.value)}
                  className="font-extrabold text-sm text-slate-900 bg-transparent border-b border-transparent focus:border-[#009E4D] focus:outline-none w-full"
                />
                <button
                  type="button"
                  onClick={() => updateRuleField(idx, 'is_active', !rule.is_active)}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 ${
                    rule.is_active ? 'bg-emerald-50 text-[#008741]' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {rule.is_active ? 'Active' : 'Paused'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="text-slate-500 font-semibold">Base Fare (Rs.)</span>
                  <input
                    type="number"
                    value={rule.base_fare}
                    onChange={(e) => updateRuleField(idx, 'base_fare', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500 font-semibold">Per Km (Rs.)</span>
                  <input
                    type="number"
                    value={rule.per_km_rate}
                    onChange={(e) => updateRuleField(idx, 'per_km_rate', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500 font-semibold">Min Fare (Rs.)</span>
                  <input
                    type="number"
                    value={rule.min_fare}
                    onChange={(e) => updateRuleField(idx, 'min_fare', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500 font-semibold">Peak Multiplier</span>
                  <input
                    type="number"
                    step="0.1"
                    value={rule.peak_multiplier}
                    onChange={(e) => updateRuleField(idx, 'peak_multiplier', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500 font-semibold">Free Wait (min)</span>
                  <input
                    type="number"
                    min="0"
                    value={rule.wait_free_minutes ?? 5}
                    onChange={(e) => updateRuleField(idx, 'wait_free_minutes', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500 font-semibold">Late Fee / min (Rs.)</span>
                  <input
                    type="number"
                    min="0"
                    value={rule.wait_charge_per_min ?? 10}
                    onChange={(e) => updateRuleField(idx, 'wait_charge_per_min', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500 font-semibold">City Fix Km (0=off)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={rule.city_flat_km ?? 0}
                    onChange={(e) => updateRuleField(idx, 'city_flat_km', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500 font-semibold">City Fix Fare (Rs.)</span>
                  <input
                    type="number"
                    min="0"
                    value={rule.city_flat_fare ?? 0}
                    onChange={(e) => updateRuleField(idx, 'city_flat_fare', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500 font-semibold">Commission Type</span>
                  <select
                    value={rule.commission_type}
                    onChange={(e) => updateRuleField(idx, 'commission_type', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 font-bold"
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="fixed">Fixed (Rs.)</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500 font-semibold">Admin Share</span>
                  <input
                    type="number"
                    step="0.5"
                    value={rule.commission_value}
                    onChange={(e) => updateRuleField(idx, 'commission_value', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 mono-num font-extrabold text-[#008741]"
                  />
                </label>
              </div>

              <button
                onClick={() => handleSavePricing(rule)}
                className="w-full py-2.5 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-bold inline-flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save {rule.display_name}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (subpage === 'expenses') {
    return (
      <div className="space-y-5">
        <form onSubmit={handleSaveExpense} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-sm text-slate-900">
              {editingExpenseId ? 'Edit Business Expense' : 'Log Business Expense (Deducted in Net Profit Report)'}
            </span>
            {editingExpenseId && (
              <button
                type="button"
                onClick={() => {
                  setEditingExpenseId(null);
                  setExpForm({
                    title: '',
                    category: 'office_rent',
                    amount: '',
                    expense_date: new Date().toISOString().slice(0, 10),
                    note: '',
                  });
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
              placeholder="Title (e.g. Office Rent, Flyers)"
              value={expForm.title}
              onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
              className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
            />
            <select
              value={expForm.category}
              onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
              className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-semibold"
            >
              <option value="office_rent">Office Rent</option>
              <option value="marketing">Marketing / Ads</option>
              <option value="staff">Staff Salary</option>
              <option value="phone_internet">Phone &amp; Internet</option>
              <option value="rider_bonus">Rider Bonus</option>
              <option value="other">Other</option>
            </select>
            <input
              type="number"
              required
              min="1"
              placeholder="Amount (Rs.)"
              value={expForm.amount}
              onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
              className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
            />
            <input
              type="date"
              required
              value={expForm.expense_date}
              onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })}
              className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {editingExpenseId ? 'Save Expense Changes' : 'Add Expense'}
          </button>
        </form>

        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Title</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((ex) => (
                <tr key={ex.id}>
                  <td className="p-3.5 mono-num">{ex.expense_date}</td>
                  <td className="p-3.5 font-bold text-slate-900">{ex.title}</td>
                  <td className="p-3.5 capitalize">{ex.category.replace(/_/g, ' ')}</td>
                  <td className="p-3.5 mono-num font-bold text-rose-600">Rs. {ex.amount}</td>
                  <td className="p-3.5 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditingExpenseId(ex.id);
                        setExpForm({
                          title: ex.title,
                          category: ex.category,
                          amount: String(ex.amount),
                          expense_date: ex.expense_date,
                          note: ex.note || '',
                        });
                      }}
                      className="text-slate-600 hover:text-slate-900 p-1"
                      title="Edit Expense"
                    >
                      <Pencil className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => handleDeleteExpense(ex.id)} className="text-rose-500 hover:text-rose-700 p-1" title="Delete Expense">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Default: settlements & lain-dain ledger
  return (
    <div className="space-y-5">
      {/* SafarGo Digital Payment Accounts Setup (Always Branded as SafarGo — Never Admin Personal Name) */}
      <form onSubmit={handleSavePayAccounts} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
            <Landmark className="w-4 h-4 text-[#009E4D]" />
            SafarGo Payment Receiving Accounts (Bank / EasyPaisa / UPaisa / JazzCash)
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#008741] font-bold">
            Public Sender Title: {getSafarGoAccountTitle(payAccounts)}
          </span>
        </div>
        <p className="text-slate-500">
          When customers or captains send digital payments, they see <strong>Account Title: SafarGo</strong> instead of Admin&apos;s personal name.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <input
            type="text"
            placeholder="EasyPaisa Account #"
            value={payAccounts.payment_easypaisa}
            onChange={(e) => setPayAccounts({ ...payAccounts, payment_easypaisa: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
          />
          <input
            type="text"
            placeholder="UPaisa Account #"
            value={payAccounts.payment_upaisa}
            onChange={(e) => setPayAccounts({ ...payAccounts, payment_upaisa: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
          />
          <input
            type="text"
            placeholder="JazzCash Account #"
            value={payAccounts.payment_jazzcash}
            onChange={(e) => setPayAccounts({ ...payAccounts, payment_jazzcash: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
          />
          <input
            type="text"
            placeholder="Bank Name (e.g. Meezan / HBL)"
            value={payAccounts.payment_bank_name}
            onChange={(e) => setPayAccounts({ ...payAccounts, payment_bank_name: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
          />
          <input
            type="text"
            placeholder="Bank Account / IBAN #"
            value={payAccounts.payment_bank_account}
            onChange={(e) => setPayAccounts({ ...payAccounts, payment_bank_account: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
          />
        </div>
        <button type="submit" className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold">
          Save SafarGo Payment Accounts
        </button>
      </form>

      {/* Captain Pre-Paid Top-Up Policy & ON/OFF Toggle */}
      <form onSubmit={handleSaveTopupPolicy} className="bg-white border-2 border-emerald-200 rounded-2xl p-5 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-extrabold text-sm text-slate-900">
              Captain Pre-Paid Top-Up Package &amp; Mode Toggle (Bike + Car)
            </div>
            <p className="text-slate-500 mt-0.5">
              <strong>ON</strong> karne par naye/0-ride captains customer map aur ride requests se hidden rahein ge jab tak Top-Up pay karke approve na hon.{' '}
              <strong>OFF</strong> karne par sab verified captains baghair top-up free rides kar sakte hain.
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full font-extrabold text-[11px] ${
              topupPolicy.rider_topup_required === 'false'
                ? 'bg-slate-200 text-slate-800'
                : 'bg-[#009E4D] text-white'
            }`}
          >
            {topupPolicy.rider_topup_required === 'false' ? 'TOP-UP OFF (FREE MODE)' : 'TOP-UP ON (LOCKED)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Top-Up Requirement</label>
            <select
              value={topupPolicy.rider_topup_required}
              onChange={(e) => setTopupPolicy({ ...topupPolicy, rider_topup_required: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 font-extrabold text-slate-900"
            >
              <option value="true">ON — Top-Up Required First</option>
              <option value="false">OFF — Free (No Top-Up)</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Rides per Package</label>
            <input
              type="number"
              min="1"
              value={topupPolicy.rider_topup_rides_count}
              onChange={(e) => setTopupPolicy({ ...topupPolicy, rider_topup_rides_count: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
              Package Fee (Rs.) · ≈ Rs.{' '}
              {(
                Number(topupPolicy.rider_topup_package_fee || 100) /
                Math.max(1, Number(topupPolicy.rider_topup_rides_count || 10))
              ).toFixed(1)}
              /ride
            </label>
            <input
              type="number"
              min="1"
              value={topupPolicy.rider_topup_package_fee}
              onChange={(e) => setTopupPolicy({ ...topupPolicy, rider_topup_package_fee: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Car Package Fee (opt. Rs.)</label>
            <input
              type="number"
              min="0"
              placeholder={`Same as Bike (Rs. ${topupPolicy.rider_topup_package_fee || 100})`}
              value={topupPolicy.rider_topup_car_package_fee}
              onChange={(e) => setTopupPolicy({ ...topupPolicy, rider_topup_car_package_fee: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={savingTopupPolicy}
          className="px-4 py-2 rounded-xl bg-[#009E4D] hover:bg-[#008741] disabled:opacity-60 text-white font-extrabold"
        >
          {savingTopupPolicy ? 'Saving...' : 'Save Top-Up Package & Toggle'}
        </button>
      </form>

      {/* Captain Pre-Paid Top-Up Approvals Queue */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-extrabold text-sm text-slate-900">
            Captain Pre-Paid Top-Up Approvals ({topupRequests.filter((r) => r.status === 'pending').length} pending)
          </span>
          <span className="text-[11px] text-slate-500">
            Approve karne par Captain ke wallet mein paid rides aur balance foran add ho jayega.
          </span>
        </div>
        {topupRequests.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-500 text-center">
            Abhi tak kisi captain ki top-up request nahi aayi.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {topupRequests.map((req) => {
              const draft = topupEdits[req.id] || {};
              return (
                <div key={req.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                      <span>{req.rider_name} ({req.rider_phone})</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          req.vehicle_type === 'car'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-emerald-50 text-[#008741] border border-emerald-200'
                        }`}
                      >
                        {req.vehicle_type === 'car' ? 'CAR' : 'BIKE'}
                      </span>
                      <span className="text-slate-500 font-normal">· {req.bike_plate}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] mono-num">
                        Left: {req.current_remaining_paid_rides} rides
                      </span>
                    </div>
                    <div className="text-slate-700 mono-num">
                      Requested: <strong>Rs. {req.amount}</strong> ({req.rides_requested} rides) ·{' '}
                      <span className="uppercase font-bold">{req.payment_channel}</span> ·{' '}
                      {req.reference_no ? (
                        <>TID/Ref: <strong className="text-[#008741]">{req.reference_no}</strong></>
                      ) : (
                        <span className="text-slate-500 font-semibold">Direct Request (No TID submitted)</span>
                      )}
                    </div>
                    {(req.note || req.admin_note) && (
                      <div className="text-[11px] text-amber-800 font-semibold">
                        {req.note ? `Captain Note: ${req.note}` : ''}{' '}
                        {req.admin_note ? `· Admin Note: ${req.admin_note}` : ''}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {req.status === 'pending' ? (
                      <>
                        <input
                          type="number"
                          min="1"
                          placeholder={`${req.rides_requested} rides`}
                          value={draft.rides ?? ''}
                          onChange={(e) =>
                            setTopupEdits((prev) => ({
                              ...prev,
                              [req.id]: { ...(prev[req.id] || {}), rides: e.target.value },
                            }))
                          }
                          className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 mono-num font-bold"
                          title="Override Rides Count"
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder={`Rs. ${req.amount}`}
                          value={draft.amount ?? ''}
                          onChange={(e) =>
                            setTopupEdits((prev) => ({
                              ...prev,
                              [req.id]: { ...(prev[req.id] || {}), amount: e.target.value },
                            }))
                          }
                          className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 mono-num font-bold"
                          title="Override Amount Rs."
                        />
                        <input
                          type="text"
                          placeholder="Admin note (opt.)"
                          value={draft.admin_note ?? ''}
                          onChange={(e) =>
                            setTopupEdits((prev) => ({
                              ...prev,
                              [req.id]: { ...(prev[req.id] || {}), admin_note: e.target.value },
                            }))
                          }
                          className="w-32 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={() => handleApproveTopupReq(req)}
                          className="px-3 py-1.5 rounded-lg bg-[#009E4D] hover:bg-[#008741] text-white font-extrabold"
                        >
                          Approve &amp; Add Rides
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskTopupProof(req)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-bold"
                          title="If payment not found, ask captain for TID / Proof"
                        >
                          Ask Proof
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectTopupReq(req)}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <StatusBadge value={req.status === 'approved' ? 'paid' : 'rejected'} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Captain Submitted Payment Proofs */}
      {settlementRequests.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-sm text-slate-900">
              Captain Payments Sent to SafarGo ({settlementRequests.filter((r) => r.status === 'pending').length} pending)
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {settlementRequests.map((req) => (
              <div key={req.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">
                    {req.rider_name} ({req.rider_phone}) · <span className="uppercase">{req.payment_channel}</span> → SafarGo
                  </div>
                  <div className="text-slate-500 mono-num">
                    Rs. {req.amount} {req.reference_no ? `· TID/Ref: ${req.reference_no}` : ''} {req.note ? `· ${req.note}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={req.status} />
                  {req.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApproveSettlementReq(req.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#009E4D] hover:bg-[#008741] text-white font-bold inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirm Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectSettlementReq(req.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSettlement} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 text-xs">
        <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
          <Receipt className="w-4 h-4 text-[#009E4D]" />
          Record Captain Payment / Settlement (Lain-Dain → Paid)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            required
            value={settForm.rider_id}
            onChange={(e) => setSettForm({ ...settForm, rider_id: e.target.value })}
            className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-bold"
          >
            {balances.map((b) => (
              <option key={b.rider_id} value={b.rider_id}>
                {b.full_name} (Due: Rs.{b.balance_due_to_admin})
              </option>
            ))}
          </select>

          <select
            value={settForm.entry_type}
            onChange={(e) => setSettForm({ ...settForm, entry_type: e.target.value })}
            className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-semibold"
          >
            <option value="settlement_to_admin">Captain Paid SafarGo (Collect)</option>
            <option value="payout_to_rider">SafarGo Paid Captain (Payout)</option>
            <option value="adjustment_reduce">Manual Adjust (Reduce Due)</option>
            <option value="adjustment_add">Manual Adjust (Add Due)</option>
          </select>

          <input
            type="number"
            required
            min="1"
            step="0.5"
            placeholder="Amount (Rs.)"
            value={settForm.amount}
            onChange={(e) => setSettForm({ ...settForm, amount: e.target.value })}
            className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
          />

          <select
            value={settForm.payment_channel}
            onChange={(e) => setSettForm({ ...settForm, payment_channel: e.target.value })}
            className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-semibold"
          >
            <option value="cash">Cash Handover</option>
            <option value="easypaisa">EasyPaisa (SafarGo)</option>
            <option value="upaisa">UPaisa (SafarGo)</option>
            <option value="jazzcash">JazzCash (SafarGo)</option>
            <option value="bank">Bank Transfer (SafarGo)</option>
          </select>

          <input
            type="text"
            placeholder="TID / Ref # / Note"
            value={settForm.note}
            onChange={(e) => setSettForm({ ...settForm, note: e.target.value })}
            className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-bold"
        >
          Confirm &amp; Mark Paid
        </button>
      </form>

      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden text-xs">
        <div className="p-4 border-b border-slate-200/80 font-extrabold text-sm text-slate-900">
          Rider Hisab Summary (Who Owes How Much)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="p-3.5">Captain</th>
                <th className="p-3.5">Trips</th>
                <th className="p-3.5">Rides Left / Top-Up</th>
                <th className="p-3.5">Gross Collected</th>
                <th className="p-3.5">Rider Net</th>
                <th className="p-3.5">Admin Comm.</th>
                <th className="p-3.5">Settled</th>
                <th className="p-3.5">Current Due</th>
                <th className="p-3.5">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {balances.map((r) => (
                <tr key={r.rider_id}>
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{r.full_name}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          r.vehicle_type === 'car'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-emerald-50 text-[#008741] border border-emerald-200'
                        }`}
                      >
                        {r.vehicle_type === 'car' ? 'CAR' : 'BIKE'}
                      </span>
                    </div>
                    <div className="text-slate-500 mono-num">{r.bike_plate} · {r.phone}</div>
                  </td>
                  <td className="p-3.5 mono-num font-bold">{r.total_trips}</td>
                  <td className="p-3.5 mono-num">
                    <div className={`font-extrabold ${(r.remaining_paid_rides || 0) > 0 ? 'text-[#008741]' : 'text-rose-600'}`}>
                      {r.remaining_paid_rides ?? 0} rides left
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Bal: Rs. {Number(r.topup_wallet_balance || 0).toFixed(0)} · Paid: Rs. {Number(r.total_topups_paid || 0).toFixed(0)}
                    </div>
                  </td>
                  <td className="p-3.5 mono-num">Rs. {r.total_gross_collected}</td>
                  <td className="p-3.5 mono-num text-[#009E4D] font-bold">Rs. {r.total_net_earned}</td>
                  <td className="p-3.5 mono-num font-bold">Rs. {r.total_commission_generated}</td>
                  <td className="p-3.5 mono-num">Rs. {r.total_settled_to_admin}</td>
                  <td className="p-3.5 mono-num font-extrabold">
                    <span className={r.is_over_limit ? 'text-rose-600' : r.balance_due_to_admin > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                      Rs. {r.balance_due_to_admin}
                    </span>
                    {r.balance_due_to_admin <= 0 && r.total_settled_to_admin > 0 && (
                      <div className="mt-0.5"><StatusBadge value="paid" /></div>
                    )}
                    {r.is_over_limit && <div className="text-[10px] text-rose-600">OVER LIMIT!</div>}
                  </td>
                  <td className="p-3.5">
                    {r.balance_due_to_admin > 0 && (
                      <button
                        onClick={() =>
                          setSettForm({
                            ...settForm,
                            rider_id: String(r.rider_id),
                            amount: String(r.balance_due_to_admin),
                            entry_type: 'settlement_to_admin',
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#008741] font-bold border border-emerald-200"
                      >
                        Fill Full Due
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden text-xs">
        <div className="p-4 border-b border-slate-200/80 font-extrabold text-sm text-slate-900">
          Complete Ledger Audit Log (Edit Note / Void Manual Entry)
        </div>
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {ledger.map((e) => (
            <div key={e.id} className="p-3.5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-900">
                  <span>{e.rider_name}</span>
                  {(e.entry_type === 'settlement_to_admin' || e.entry_type === 'payout_to_rider') && (
                    <StatusBadge value="paid" />
                  )}
                  <span>·</span>{' '}
                  {editingLedgerId === e.id ? (
                    <span className="inline-flex gap-1.5 items-center mt-1">
                      <input
                        type="text"
                        value={ledgerNoteDraft}
                        onChange={(ev) => setLedgerNoteDraft(ev.target.value)}
                        className="px-2 py-1 rounded border border-slate-200/80 bg-slate-50/80 font-normal"
                      />
                      <button
                        onClick={() => handleSaveLedgerNote(e.id)}
                        className="px-2 py-1 rounded bg-[#009E4D] text-white"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingLedgerId(null)} className="px-2 py-1 rounded border">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span className="text-slate-500 font-normal">{e.note}</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mono-num">
                  {new Date(e.created_at).toLocaleString()} · Channel: {e.payment_channel} · Processed by: SafarGo
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right mono-num">
                  <div className={`font-extrabold ${e.signed_delta > 0 ? 'text-amber-600' : 'text-[#009E4D]'}`}>
                    {e.signed_delta > 0 ? `+Rs. ${e.signed_delta}` : `-Rs. ${Math.abs(e.signed_delta)}`}
                  </div>
                  <div className="text-[11px] text-slate-500">Bal: Rs. {e.balance_after}</div>
                </div>
                <button
                  onClick={() => {
                    setEditingLedgerId(e.id);
                    setLedgerNoteDraft(e.note || '');
                  }}
                  className="text-slate-500 hover:text-slate-900 p-1"
                  title="Edit Note"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {!e.booking_id && (
                  <button
                    onClick={() => handleDeleteLedgerEntry(e.id)}
                    className="text-rose-500 hover:text-rose-700 p-1"
                    title="Delete Manual Entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
