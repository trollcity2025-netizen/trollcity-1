export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

export function safeFormatDate(input) {
  try {
    const d = new Date(input);
    const ok = !isNaN(d.getTime());
    return ok ? d.toLocaleDateString() : "N/A";
  } catch (_) {
    return "N/A";
  }
}

export function safeToLocaleString(value) {
  try {
    if (value == null) return "0";
    const n = Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString();
  } catch (_) {
    return String(value ?? "0");
  }
}

export function formatCurrency(amount, currency = "USD") {
  try {
    const n = Number(amount) || 0;
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch (_) {
    return `$${Number(amount) || 0}`;
  }
}

