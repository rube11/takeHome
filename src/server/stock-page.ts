import {
  type DailyPrice,
  latestMarketDay,
  type Peers,
  type Quote,
  threeMonths,
} from '../market/quotes.ts';
import { getCompanyOverview, getDailyPrices } from './alpha-vantage.ts';
import { loadSnapshot } from './snapshot.ts';

/** Closes the chart needs for its longest range (3M), plus the close before it. */
const chartCloses = threeMonths.sessions + 1;

/** Everything the stock page shows, or null when the symbol isn't in the watchlist. */
export async function loadStockPage(symbol: string) {
  const { stocks } = await loadSnapshot();
  const saved = stocks.find((quote) => quote.symbol === symbol.toUpperCase());
  if (!saved) return null;

  // Both come from the disk cache between market closes, so this is usually quick.
  const [overview, history] = await Promise.all([
    getCompanyOverview(saved.symbol),
    getDailyPrices(saved.symbol),
  ]);
  const prices = history ?? [];

  // The daily history is newest first and up to 100 days long. When it's at least as new as
  // the snapshot, the chart uses it: it reaches back further and comes with dates.
  const historyIsCurrent = prices.length >= 2 && prices[0].date >= saved.asOf;
  const recent = historyIsCurrent
    ? prices.slice(0, chartCloses).reverse()
    : null;
  const quote: Quote = recent
    ? {
        ...saved,
        asOf: recent.at(-1)!.date,
        closes: recent.map((day) => day.close),
      }
    : saved;

  return {
    quote,
    /** Trading dates lined up with quote.closes, when the history supplied them. */
    dates: recent?.map((day) => day.date),
    peers: findPeers(quote, stocks, recent),
    overview,
    prices,
    historyIsCurrent,
  };
}

/** The other watchlist stocks, lined up with this stock's closes. */
function findPeers(
  quote: Quote,
  stocks: Quote[],
  recent: DailyPrice[] | null,
): Peers {
  const others = stocks.filter((stock) => stock.symbol !== quote.symbol);
  const closesOn = (day: string) =>
    others.filter((stock) => stock.asOf === day).map((stock) => stock.closes);

  // Usually the others end on the same day as this stock.
  if (others.some((stock) => stock.asOf === quote.asOf)) {
    return { closes: closesOn(quote.asOf), lag: 0 };
  }

  // Otherwise this stock's own history may be a session or two ahead of the snapshot: compare
  // up to the snapshot's last day, if that day is in this stock's history.
  const snapshotDay = latestMarketDay(others);
  const index = recent?.findIndex((day) => day.date === snapshotDay) ?? -1;
  if (recent && index >= 0) {
    return { closes: closesOn(snapshotDay), lag: recent.length - 1 - index };
  }
  return { closes: [], lag: 0 };
}
