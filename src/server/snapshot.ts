import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MarketSnapshot, Quote } from '../market/quotes.ts';
import { month } from '../market/quotes.ts';
import {
  dataPath,
  getDailyPrices,
  latestCloseDate,
  writeFileSafely,
} from './alpha-vantage.ts';

// The watchlist itself is data/market.json: 15 stocks with their last 21 closes. A refresh
// writes the updated copy to the git-ignored data/.cache/market.json, which wins when present.

const bundledFile = dataPath('market.json');
const refreshedFile = dataPath('.cache', 'market.json');
/** One empty file per close date that a refresh has been attempted for. */
const attemptsFolder = dataPath('.cache', 'attempts');

/** Closes each stock keeps: enough for the 1M range, plus the close before it. */
const closesKept = month.sessions + 1;

const readSnapshot = async (file: string): Promise<MarketSnapshot> =>
  JSON.parse(await readFile(file, 'utf8'));

/** The newest saved watchlist. */
export function loadSnapshot() {
  return readSnapshot(refreshedFile).catch(() => readSnapshot(bundledFile));
}

/** True when every stock already has a close for this trading date (YYYY-MM-DD). */
export function isUpToDate({ stocks }: MarketSnapshot, closeDate: string) {
  return stocks.every((quote) => quote.asOf >= closeDate);
}

async function fetchQuote(quote: Quote): Promise<Quote> {
  const prices = await getDailyPrices(quote.symbol, { allowStale: false });
  if (!prices || prices.length < 2) {
    throw new Error('Daily closing prices unavailable.');
  }
  const closes = prices
    .slice(0, closesKept)
    .reverse() // oldest first
    .map((day) => day.close);
  return { ...quote, asOf: prices[0].date, closes };
}

/**
 * Brings every stock up to the close on `closeDate` and saves the result. Used by the home
 * page (in the background) and by `bun refresh`.
 */
export async function refreshSnapshot(closeDate = latestCloseDate()) {
  if (!process.env.ALPHA_VANTAGE_KEY) {
    throw new Error('Set ALPHA_VANTAGE_KEY to refresh market data.');
  }
  const current = await loadSnapshot();
  if (isUpToDate(current, closeDate)) return 'Already up to date.';

  // A full refresh costs up to 15 requests of a small daily quota, so each close gets one
  // attempt. The attempt is claimed with a file on disk, which every server process and the
  // CLI can see. The claim stays even if the refresh fails, so visitors can't keep retrying.
  await mkdir(attemptsFolder, { recursive: true });
  try {
    // The 'wx' flag fails if the file already exists, so only one attempt can claim it.
    await writeFile(join(attemptsFolder, closeDate), '', { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return 'Refresh already attempted for this close.';
    }
    throw error;
  }

  const next: MarketSnapshot = { stocks: [] };
  for (const quote of current.stocks) {
    // Only stocks that are behind cost a request.
    if (quote.asOf >= closeDate) {
      next.stocks.push(quote);
      continue;
    }
    // One at a time; alpha-vantage.ts spaces the requests out.
    next.stocks.push(await fetchQuote(quote));
  }

  await writeFileSafely(refreshedFile, JSON.stringify(next) + '\n');
  return 'Market data refreshed.';
}
