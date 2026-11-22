/** One stock in the watchlist, with its recent daily closing prices. */
export type Quote = {
  symbol: string;
  name: string;
  /** The trading date of the newest close, as YYYY-MM-DD. */
  asOf: string;
  /** Daily closing prices in U.S. dollars, oldest first. */
  closes: number[];
};

/** The saved watchlist, stored as JSON in data/market.json. */
export type MarketSnapshot = { stocks: Quote[] };

/** The rest of the watchlist, lined up for comparison with one stock. */
export type Peers = {
  /** Each other stock's closes, oldest first, all ending on the same trading day. */
  closes: number[][];
  /**
   * How many sessions before this stock's newest close the peers' data ends. Usually 0; more
   * when this stock's own history already has closes the watchlist snapshot hasn't caught
   * up with yet.
   */
  lag: number;
};

/** One trading day from the daily price history. */
export type DailyPrice = { date: string; close: number; volume: number | null };

/**
 * A company's details, with Alpha Vantage's field names. Any field the provider lacks is
 * missing.
 */
export type CompanyDetails = {
  Symbol?: string;
  Name?: string;
  AssetType?: string;
  Exchange?: string;
  Sector?: string;
  Industry?: string;
  MarketCapitalization?: string;
  Description?: string;
};

/** The newest trading date that any of these stocks has a close for. */
export function latestMarketDay(stocks: Quote[]) {
  return stocks
    .map((quote) => quote.asOf)
    .sort()
    .at(-1)!;
}

/** The newest close, and its move from the close before it. */
export function dailyChange({ closes }: Quote) {
  const [previous, price] = closes.slice(-2);
  return {
    price,
    /** The move in dollars. */
    move: price - previous,
    /** The move as a fraction: 0.02 means +2%. */
    change: price / previous - 1,
  };
}

/**
 * The % change of each close since the first one, as fractions: [0, 0.01, -0.02] means
 * level, then up 1%, then down 2%. Both the derby and the stock chart plot these.
 */
export function changeSinceStart(closes: number[]) {
  return closes.map((close) => close / closes[0] - 1);
}

/** A stretch of time to look back over, counted in trading sessions (days the market opened). */
export type Range = { label: string; name: string; sessions: number };

export const week: Range = { label: '1W', name: 'Past week', sessions: 5 };
export const month: Range = { label: '1M', name: 'Past month', sessions: 20 };
export const threeMonths: Range = {
  label: '3M',
  name: 'Past 3 months',
  sessions: 63,
};
