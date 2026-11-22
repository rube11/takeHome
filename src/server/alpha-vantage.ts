import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { CompanyDetails, DailyPrice } from '../market/quotes.ts';

// Everything about getting data from Alpha Vantage. Its free tier allows only a few requests
// a day, so every response is saved to disk and reused until it goes stale. In order:
//   1. The market calendar: when a new daily close becomes available.
//   2. The data folder, and writing files safely.
//   3. The disk cache that wraps each request.
//   4. The two requests: TIME_SERIES_DAILY (a stock's last 100 closes and volumes) and
//      OVERVIEW (company details; free keys get a "premium endpoint" notice instead).

// ---- 1. The market calendar ----

const newYorkTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  hourCycle: 'h23',
});

/**
 * The trading date (YYYY-MM-DD) of the newest close the provider should have: today's after
 * 6 p.m. in New York, otherwise the previous day's, stepping back over weekends.
 * Market holidays aren't known here, so on a holiday a refresh may find nothing new.
 */
export function latestCloseDate(now = new Date()) {
  const parts = Object.fromEntries(
    newYorkTime.formatToParts(now).map(({ type, value }) => [type, +value]),
  );
  const afterClose = parts.hour >= 18;
  const date = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      afterClose ? parts.day : parts.day - 1,
    ),
  );
  const isWeekend = () => date.getUTCDay() === 0 || date.getUTCDay() === 6;
  while (isWeekend()) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// ---- 2. The data folder ----

/** A path inside the project's data/ folder. */
export const dataPath = (...parts: string[]) =>
  join(process.cwd(), 'data', ...parts);

/**
 * Writes a file without ever leaving it half-written: the text goes to a temporary file
 * first, which is then renamed over the real one in a single step.
 */
export async function writeFileSafely(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, text);
  await rename(temporary, path);
}

// ---- 3. The disk cache ----

/** How long to wait before asking again after a request fails. */
const retryDelay = 15 * 60_000;

/**
 * A saved response. `value` is null when the provider said it has nothing for this symbol
 * (for example an endpoint the API key's plan doesn't include), so it isn't asked again
 * until the entry goes stale.
 */
type Entry<T> = { savedAt: number; value: T | null };

type Options<T> = {
  /** Names the cache file: data/.cache/stocks/<SYMBOL>-<name>.json */
  name: string;
  /** Whether an entry saved at this time can still be used without asking again. */
  isFresh: (savedAt: number) => boolean;
  /** Asks the provider. Returns null for "nothing here"; throws when the request fails. */
  fetch: (symbol: string, apiKey: string) => Promise<T | null>;
};

/**
 * Wraps a provider request with a disk cache. The returned function gives the saved value when
 * it's fresh, and otherwise asks the provider and saves the answer. When there's no API key or
 * the request fails, it falls back to the last saved value, however old.
 */
export function diskCache<T>({ name, isFresh, fetch }: Options<T>) {
  // Requests already on their way, so two visitors don't trigger two requests.
  const inFlight = new Map<string, Promise<Entry<T> | null>>();
  // When each symbol may be retried after a failed request.
  const retryAt = new Map<string, number>();

  async function load(symbol: string): Promise<Entry<T> | null> {
    const file = dataPath('.cache', 'stocks', `${symbol}-${name}.json`);
    const saved: Entry<T> | null = await readFile(file, 'utf8')
      .then(JSON.parse)
      .catch(() => null);

    const apiKey = process.env.ALPHA_VANTAGE_KEY;
    const waiting = Date.now() < (retryAt.get(symbol) ?? 0);
    if (!apiKey || (saved && isFresh(saved.savedAt)) || waiting) return saved;

    let value: T | null;
    try {
      value = await fetch(symbol, apiKey);
    } catch {
      retryAt.set(symbol, Date.now() + retryDelay);
      return saved;
    }

    // "Nothing here" keeps an older good value; it only stops the asking.
    const entry = { savedAt: Date.now(), value: value ?? saved?.value ?? null };
    await writeFileSafely(file, JSON.stringify(entry));
    return entry;
  }

  /** Pass `allowStale: false` to get null rather than an out-of-date value. */
  return async function get(
    symbol: string,
    { allowStale = true } = {},
  ): Promise<T | null> {
    let request = inFlight.get(symbol);
    if (!request) {
      request = load(symbol).finally(() => inFlight.delete(symbol));
      inFlight.set(symbol, request);
    }
    const entry = await request;
    if (!entry) return null;
    return allowStale || isFresh(entry.savedAt) ? entry.value : null;
  };
}

// ---- 4. The requests ----

/** The OVERVIEW fields the stock page shows. */
const overviewFields: (keyof CompanyDetails)[] = [
  'Symbol',
  'AssetType',
  'Name',
  'Description',
  'Exchange',
  'Sector',
  'Industry',
  'MarketCapitalization',
];

type Json = Record<string, unknown>;

/** The value as a plain object, or {} when it isn't one, so lookups never throw. */
const asObject = (value: unknown): Json =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};

// The free tier allows about one request a second, so requests wait in line.
let queue: Promise<unknown> = Promise.resolve();
const gapBetweenRequests = 1100;

function request(
  endpoint: 'OVERVIEW' | 'TIME_SERIES_DAILY',
  symbol: string,
  apiKey: string,
): Promise<Json> {
  const response = queue.then(async () => {
    const params = new URLSearchParams({
      function: endpoint,
      symbol,
      apikey: apiKey,
    });
    const reply = await fetch('https://www.alphavantage.co/query?' + params, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    if (!reply.ok) throw new Error('Market data request failed.');
    return asObject(await reply.json());
  });
  queue = response.catch(() => {}).then(() => delay(gapBetweenRequests));
  return response;
}

async function fetchOverview(
  symbol: string,
  apiKey: string,
): Promise<CompanyDetails | null> {
  const data = await request('OVERVIEW', symbol, apiKey);

  // A free key gets a premium notice instead of data. Returning null saves that answer, so
  // page visits don't spend the daily quota asking again.
  const notice = String(data.Information ?? '');
  if (/premium endpoint/i.test(notice)) return null;

  const overview: CompanyDetails = {};
  for (const field of overviewFields) {
    const raw = data[field];
    const value = typeof raw === 'string' ? raw.trim() : '';
    // The API writes missing values as "None", "-" and the like; leave those out.
    const missing = !value || /^(none|null|n\/a|-)$/i.test(value);
    if (!missing) overview[field] = value;
  }
  if (Object.keys(overview).length === 0) {
    throw new Error('Company overview unavailable.');
  }
  return overview;
}

async function fetchDailyPrices(
  symbol: string,
  apiKey: string,
): Promise<DailyPrice[]> {
  const data = await request('TIME_SERIES_DAILY', symbol, apiKey);
  const series = asObject(data['Time Series (Daily)']);
  const dates = Object.keys(series).sort().reverse(); // newest first
  if (dates.length === 0) throw new Error('Daily prices unavailable.');

  return dates.map((date) => {
    const day = asObject(series[date]);
    const close = Number(day['4. close']);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
    if (!validDate || !Number.isFinite(close) || close <= 0) {
      throw new Error('Invalid daily price.');
    }
    const volume = day['5. volume'];
    return {
      date,
      close,
      volume:
        typeof volume === 'string' && /^\d+$/.test(volume)
          ? Number(volume)
          : null,
    };
  });
}

/** A stock's company details, refreshed at most once a week. */
export const getCompanyOverview = diskCache({
  name: 'overview',
  isFresh: (savedAt) => Date.now() - savedAt < 7 * 24 * 60 * 60_000,
  fetch: fetchOverview,
});

/** A stock's last 100 daily closes (newest first), refreshed once per market close. */
export const getDailyPrices = diskCache({
  name: 'daily',
  isFresh: (savedAt) =>
    latestCloseDate(new Date(savedAt)) === latestCloseDate(),
  fetch: fetchDailyPrices,
});
