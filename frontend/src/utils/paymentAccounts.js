export const PAYMENT_METHOD_OPTIONS = [
  { id: 'cash', label: 'Cash to Captain (Bike / Car)', shortLabel: 'Cash', isDigital: false },
  { id: 'easypaisa', label: 'EasyPaisa (Pay to SafarGo)', shortLabel: 'EasyPaisa', isDigital: true },
  { id: 'upaisa', label: 'UPaisa (Pay to SafarGo)', shortLabel: 'UPaisa', isDigital: true },
  { id: 'jazzcash', label: 'JazzCash (Pay to SafarGo)', shortLabel: 'JazzCash', isDigital: true },
  { id: 'bank', label: 'Bank Transfer (Pay to SafarGo)', shortLabel: 'Bank Transfer', isDigital: true },
];

export const DIGITAL_PAYMENT_CHANNELS = PAYMENT_METHOD_OPTIONS.filter((m) => m.isDigital);

export function getSafarGoAccountTitle(settings) {
  const raw = (settings?.payment_account_title || '').trim();
  if (!raw || /admin|owner/i.test(raw)) {
    return 'SafarGo';
  }
  return raw;
}

export function getSafarGoAccounts(settings = {}) {
  const title = getSafarGoAccountTitle(settings);
  return {
    title,
    channels: {
      easypaisa: {
        id: 'easypaisa',
        label: 'EasyPaisa',
        accountNumber: (settings.payment_easypaisa || '').trim(),
        title,
      },
      upaisa: {
        id: 'upaisa',
        label: 'UPaisa',
        accountNumber: (settings.payment_upaisa || '').trim(),
        title,
      },
      jazzcash: {
        id: 'jazzcash',
        label: 'JazzCash',
        accountNumber: (settings.payment_jazzcash || '').trim(),
        title,
      },
      bank: {
        id: 'bank',
        label: (settings.payment_bank_name || '').trim() || 'Bank Account',
        accountNumber: (settings.payment_bank_account || '').trim(),
        title,
      },
    },
  };
}

export function formatPaymentMethodLabel(method) {
  const found = PAYMENT_METHOD_OPTIONS.find((m) => m.id === method);
  if (!found) return method ? method.toUpperCase() : 'Cash';
  return found.isDigital ? `${found.shortLabel} · SafarGo` : 'Cash';
}

export function getRidePaymentBadgeState(booking) {
  if (booking?.payment_status === 'paid') return 'paid';
  if (booking?.payment_status === 'submitted') return 'submitted';
  return 'unpaid';
}
