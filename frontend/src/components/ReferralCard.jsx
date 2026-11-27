import React, { useState } from 'react';
import { Check, Copy, Gift, Share2, Sparkles, Users } from 'lucide-react';
import { apiRequest } from '../api/client';

export function ReferralCard({ data, onReload, role = 'customer' }) {
  const [applyInput, setApplyInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (!data) return null;

  const policy = data.policy || {};
  const isCaptain = role === 'rider';
  const trackActive = isCaptain ? Boolean(policy.captain_active) : Boolean(policy.customer_active);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.referral_code || '');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleApplyCode = async (e) => {
    e.preventDefault();
    if (!applyInput.trim()) return;
    setApplying(true);
    setMsg('');
    setErr('');
    try {
      await apiRequest('/api/referrals/apply', {
        method: 'POST',
        body: { referral_code: applyInput.trim().toUpperCase() },
      });
      setApplyInput('');
      setMsg(
        isCaptain
          ? 'Referral code linked! Your referrer gets rewarded once you verify & activate.'
          : `Referral code linked! Complete your 1st ride (Rs. ${policy.min_fare || 120}+) to unlock rewards.`
      );
      if (onReload) await onReload();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setApplying(false);
    }
  };

  const shareText = isCaptain
    ? `Join SafarGo as a Verified Bike/Car Captain with my referral code ${data.referral_code} and start earning!`
    : `Book rides on SafarGo! Use my referral code ${data.referral_code} to get Rs. ${policy.friend_discount || 30} off your first ride (min Rs. ${policy.min_fare || 120}).`;

  return (
    <div className="bg-white border-2 border-indigo-200/80 rounded-3xl p-4 sm:p-5 space-y-3.5 text-xs shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 font-extrabold text-sm text-slate-900">
            <Gift className="w-4 h-4 text-indigo-600" />
            <span>{isCaptain ? 'Captain Referral Bonus (+Free App Access Rides)' : 'Refer & Earn Ride Discounts'}</span>
          </div>
          <p className="text-slate-600 mt-1 leading-relaxed">
            {!policy.program_enabled ? (
              <span className="text-slate-500 font-semibold">
                Referral program is currently turned OFF by Admin.
              </span>
            ) : !trackActive ? (
              <span className="text-slate-500 font-semibold">
                {isCaptain ? 'Captain referrals are currently paused by Admin.' : 'Customer referrals are currently paused by Admin.'}
              </span>
            ) : isCaptain ? (
              <>
                Invite a new Bike or AC Car Captain using your code. Once Admin verifies them and approves their 1st App Access Top-Up, you earn{' '}
                <strong className="text-indigo-700">+{policy.captain_bonus_rides || 5} Free App Access Rides</strong>!
              </>
            ) : (
              <>
                Share your code: friends get{' '}
                <strong className="text-emerald-700">Rs. {policy.friend_discount || 30} off</strong> their 1st ride (min Rs.{' '}
                {policy.min_fare || 120}). Once their 1st ride completes, you earn{' '}
                <strong className="text-indigo-700">Rs. {policy.referrer_reward || 30} ride credit</strong>!
              </>
            )}
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
            trackActive ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {trackActive ? 'REFERRAL ACTIVE' : 'PAUSED'}
        </span>
      </div>

      {/* Shareable Referral Code Box */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 text-white flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-indigo-200 font-bold">Your SafarGo Referral Code</div>
          <div className="text-xl font-extrabold mono-num tracking-widest text-amber-300 mt-0.5">
            {data.referral_code}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 rounded-xl bg-white text-slate-950 hover:bg-amber-300 font-extrabold inline-flex items-center gap-1.5 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold inline-flex items-center gap-1.5 transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            WhatsApp Share
          </a>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-2 mono-num text-center">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="text-[10px] text-slate-500 font-semibold">Invited</div>
          <div className="text-base font-extrabold text-slate-900">{data.stats?.total_referred || 0}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="text-[10px] text-slate-500 font-semibold">Rewarded</div>
          <div className="text-base font-extrabold text-emerald-700">{data.stats?.rewarded_count || 0}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200">
          <div className="text-[10px] text-indigo-700 font-bold">
            {isCaptain ? 'Bonus Rides Earned' : 'Available Credit'}
          </div>
          <div className="text-base font-extrabold text-indigo-800">
            {isCaptain
              ? `+${data.stats?.total_rides_earned || 0} Rides`
              : `Rs. ${Number(data.referral_discount_balance || 0).toFixed(0)}`}
          </div>
        </div>
      </div>

      {data.invited_by ? (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-emerald-900">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <Sparkles className="w-4 h-4 text-[#009E4D]" />
            Invited by {data.invited_by.referrer_name} ({data.invited_by.referral_code_used})
          </span>
          <span className="px-2 py-0.5 rounded-full bg-white border border-emerald-300 text-[10px] font-extrabold uppercase">
            {data.invited_by.status === 'rewarded'
              ? 'Reward Unlocked ✓'
              : data.invited_by.friend_discount_available > 0
              ? `Rs. ${data.invited_by.friend_discount_available} Off 1st Ride Ready`
              : 'Pending Activation'}
          </span>
        </div>
      ) : (
        trackActive && (
          <form onSubmit={handleApplyCode} className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Have a friend's referral code? Enter here"
              value={applyInput}
              onChange={(e) => setApplyInput(e.target.value.toUpperCase())}
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 mono-num uppercase font-bold"
            />
            <button
              type="submit"
              disabled={applying || !applyInput.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold"
            >
              {applying ? 'Applying...' : 'Apply Code'}
            </button>
          </form>
        )
      )}

      {msg && <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">{msg}</div>}
      {err && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">{err}</div>}

      {(data.referrals || []).length > 0 && (
        <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
          <div className="font-bold text-slate-800 inline-flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            Invited Friends &amp; Reward History
          </div>
          <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
            {data.referrals.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">
                    {r.referred_name} <span className="text-[10px] uppercase text-slate-500">({r.track})</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mono-num">
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right mono-num">
                  {r.status === 'rewarded' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#008741] font-extrabold text-[10px]">
                      {r.reward_type === 'app_fee_rides'
                        ? `+${r.reward_rides} Free Rides ✓`
                        : `+Rs. ${Number(r.reward_amount || 0).toFixed(0)} Earned ✓`}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                      Pending {r.track === 'captain' ? 'Activation' : '1st Ride'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
