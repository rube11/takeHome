// How numbers and dates are written across the app. Negative numbers use a typographic
// minus sign (−) rather than a hyphen.

const numberFormat = (options: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat('en-US', options).format;

const dollars = numberFormat({ style: 'currency', currency: 'USD' });
const signedDollars = numberFormat({
  style: 'currency',
  currency: 'USD',
  signDisplay: 'exceptZero',
});
const signedPercent = numberFormat({
  style: 'percent',
  signDisplay: 'exceptZero',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const tinySignedPercent = numberFormat({
  style: 'percent',
  signDisplay: 'exceptZero',
  maximumSignificantDigits: 1,
});

const withMinusSign = (text: string) => text.replace(/^-/, '−');

/** $342.56 */
export const formatPrice = dollars;

/** +$1.78 or −$6.65 */
export const formatPriceChange = (move: number) =>
  withMinusSign(signedDollars(move));

/** Shortened dollars for large amounts: $4.12T */
export const formatCompactDollars = numberFormat({
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

/** A whole number with thousands separators: 36,629,759 */
export const formatCount = numberFormat({});

/** +0.51% or −1.90%. A move under 0.01% keeps one digit instead of rounding to 0.00%. */
export function formatPercentChange(change: number) {
  const tiny = change !== 0 && Math.abs(change) < 0.0001;
  return withMinusSign(
    tiny ? tinySignedPercent(change) : signedPercent(change),
  );
}

/** +6.5% or −40.5%, with one decimal place: the derby's compact labels. */
export function formatShortPercent(change: number) {
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  return sign + Math.abs(change * 100).toFixed(1) + '%';
}

/** Formats a YYYY-MM-DD trading date; by default as "Friday, November 20, 2026". */
function formatDate(
  day: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'full' },
) {
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: 'UTC',
  }).format(new Date(day + 'T00:00:00Z'));
}

/** "Nov 20, 2026" */
export const formatDateWithYear = (day: string) =>
  formatDate(day, { month: 'short', day: 'numeric', year: 'numeric' });

/** "Nov 20" */
export const formatShortDate = (day: string) =>
  formatDate(day, { month: 'short', day: 'numeric' });

/** The CSS class that colours a change: green when up, red when down, grey when flat. */
export function toneClass(change: number) {
  if (change > 0) return 'positive';
  if (change < 0) return 'negative';
  return 'neutral';
}

// ---- Gridlines for a % axis, shared by the derby and the stock chart ----
// Each chooses its own step (how far apart the lines are); these place the lines and label them.

/** Round steps between gridlines, as fractions: 0.005 is 0.5%, 0.1 is 10%. */
export const gridSteps = [
  0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1,
];

// Floating-point arithmetic leaves dust like 0.30000000000000004; these tolerances ignore it.
const dust = 1e-9;

/** How many gridlines a step would draw between low and high. */
export const gridlineCount = (low: number, high: number, step: number) =>
  Math.floor(high / step + dust) - Math.ceil(low / step - dust) + 1;

/**
 * A gridline at every multiple of `step` between low and high, each with its label: "0%",
 * "+10%", "−2.5%". Labels show a decimal place only when the step needs one.
 */
export function gridlines(low: number, high: number, step: number) {
  const decimals = Number.isInteger(Math.round(step * 1e4) / 100) ? 0 : 1;
  const lines: { value: number; label: string }[] = [];
  for (let i = Math.ceil(low / step - dust); i * step <= high + dust; i++) {
    const value = Math.round(i * step * 1e4) / 1e4;
    lines.push({ value, label: axisLabel(value, decimals) });
  }
  return lines;
}

function axisLabel(value: number, decimals: number) {
  if (value === 0) return '0%';
  const sign = value > 0 ? '+' : '−';
  return sign + Math.abs(value * 100).toFixed(decimals) + '%';
}
