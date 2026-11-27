import React from 'react';

const STATUS_STYLES = {
  pending: 'bg-emerald-50 text-[#008741] border-emerald-200',
  assigned: 'bg-sky-50 text-sky-700 border-sky-200',
  arrived: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-teal-50 text-teal-700 border-teal-200',
  completed: 'bg-emerald-50 text-[#008741] border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  open: 'bg-rose-50 text-rose-700 border-rose-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paid: 'bg-emerald-100 text-[#008741] border-emerald-300 font-extrabold',
  submitted: 'bg-sky-50 text-sky-700 border-sky-200',
  pending_approval: 'bg-amber-50 text-amber-800 border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  incomplete: 'bg-slate-100 text-slate-700 border-slate-300',
  verified: 'bg-emerald-100 text-[#008741] border-emerald-300 font-extrabold',
  unpaid: 'bg-amber-50 text-amber-800 border-amber-200',
};

const LABELS = {
  pending: 'Open · Finding Captain',
  assigned: 'Captain Matched',
  arrived: 'Captain Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paid: 'Paid ✓',
  submitted: 'Payment Sent',
  pending_approval: 'Pending Approval',
  unpaid: 'Payment Pending',
  rejected: 'Rejected',
  incomplete: 'Docs Required',
  verified: 'Verified ✓',
  bike_ride: 'Bike Ride',
  car_ride: 'AC Car Ride',
  parcel: 'Parcel',
  errand: 'Errand',
};

export function StatusBadge({ value }) {
  const cls = STATUS_STYLES[value] || 'bg-slate-100 text-slate-700 border-slate-200';
  const label = LABELS[value] || value?.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${cls}`}>
      {label}
    </span>
  );
}
