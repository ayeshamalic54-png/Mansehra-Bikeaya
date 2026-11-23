import React, { useEffect, useState } from 'react';
import { CheckCircle2, Pencil, Plus, Receipt, Trash2, X } from 'lucide-react';
import { apiRequest } from '../../api/client';

export function AdminFinancePanel({ subpage, onNotify, onRefreshBootstrap }) {
  const [balances, setBalances] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [pricing, setPricing] = useState([]);

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
      const [bal, led, exp, prc] = await Promise.all([
        apiRequest('/api/finance/rider-balances'),
        apiRequest('/api/finance/ledger'),
        apiRequest('/api/finance/expenses'),
        apiRequest('/api/admin/pricing'),
      ]);
      setBalances(bal);
      setLedger(led);
      setExpenses(exp);
      setPricing(prc);
      if (!settForm.rider_id && bal.length > 0) {
        setSettForm((prev) => ({ ...prev, rider_id: String(bal[0].rider_id) }));
      }
    } catch (e) {
      onNotify(e.message, true);
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
          <strong>Live Commission &amp; Fare Control:</strong> Adjust your Admin Commission (% or Fixed Rs.), service name, rates, or enable/pause any service anytime. Past completed rides keep their historical snapshot.
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
      <form onSubmit={handleSettlement} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 text-xs">
        <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
          <Receipt className="w-4 h-4 text-[#009E4D]" />
          Record Rider Cash Collection / Settlement (Lain-Dain)
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
            <option value="settlement_to_admin">Rider Paid Admin (Collect Cash)</option>
            <option value="payout_to_rider">Admin Paid Rider (Digital Payout)</option>
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
            <option value="easypaisa">EasyPaisa</option>
            <option value="jazzcash">JazzCash</option>
            <option value="bank">Bank Transfer</option>
          </select>

          <input
            type="text"
            placeholder="Ref # / Note"
            value={settForm.note}
            onChange={(e) => setSettForm({ ...settForm, note: e.target.value })}
            className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-bold"
        >
          Confirm &amp; Update Rider Ledger
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
                    <div className="font-bold text-slate-900">{r.full_name}</div>
                    <div className="text-slate-500 mono-num">{r.bike_plate} · {r.phone}</div>
                  </td>
                  <td className="p-3.5 mono-num font-bold">{r.total_trips}</td>
                  <td className="p-3.5 mono-num">Rs. {r.total_gross_collected}</td>
                  <td className="p-3.5 mono-num text-[#009E4D] font-bold">Rs. {r.total_net_earned}</td>
                  <td className="p-3.5 mono-num font-bold">Rs. {r.total_commission_generated}</td>
                  <td className="p-3.5 mono-num">Rs. {r.total_settled_to_admin}</td>
                  <td className="p-3.5 mono-num font-extrabold">
                    <span className={r.is_over_limit ? 'text-rose-600' : r.balance_due_to_admin > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                      Rs. {r.balance_due_to_admin}
                    </span>
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
                <div className="font-bold text-slate-900">
                  {e.rider_name} ·{' '}
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
                  {new Date(e.created_at).toLocaleString()} · Channel: {e.payment_channel} · By: {e.recorded_by}
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
