export const SUPPORT_CATEGORIES = [
  {
    id: 'feedback',
    label: 'Feedback / Suggestion',
    placeholder: 'Share your feedback or suggestions to improve SafarGo...',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'ride_complaint',
    label: 'Ride Complaint',
    placeholder: 'Describe what went wrong during your ride or pickup...',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    id: 'fare_dispute',
    label: 'Fare Issue',
    placeholder: 'Mention expected vs charged fare and ride details...',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    id: 'captain_conduct',
    label: 'Captain Behavior',
    placeholder: 'Tell us about captain behavior or driving conduct...',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  {
    id: 'lost_item',
    label: 'Lost Item',
    placeholder: 'Describe the lost item and which ride it was left in...',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    id: 'app_issue',
    label: 'App / Map Issue',
    placeholder: 'Tell us about map location, search, or app issue...',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
];

const FALLBACK_CATEGORIES = {
  customer: {
    label: 'Customer Support',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  rider: {
    label: 'Captain Support',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  general: {
    label: 'General',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export function getSupportCategoryMeta(category) {
  return (
    SUPPORT_CATEGORIES.find((c) => c.id === category) ||
    FALLBACK_CATEGORIES[category] || {
      label: category ? category.replace(/_/g, ' ') : 'General',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  );
}
