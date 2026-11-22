import { after } from 'next/server';
import { latestMarketDay } from '@/market/quotes';
import { latestCloseDate } from '@/server/alpha-vantage';
import { isUpToDate, loadSnapshot, refreshSnapshot } from '@/server/snapshot';
import Watchlist from '@/watchlist/Watchlist';

// Read the saved prices on every request, so a refresh shows up without a rebuild.
export const dynamic = 'force-dynamic';

/** The home page: the derby and the watchlist. */
export default async function HomePage() {
  const snapshot = await loadSnapshot();

  // Serve the saved prices now. If a newer close should exist, fetch it after the response
  // is sent; the next visit shows it.
  const closeDate = latestCloseDate();
  if (process.env.ALPHA_VANTAGE_KEY && !isUpToDate(snapshot, closeDate)) {
    after(() =>
      refreshSnapshot(closeDate).catch(() =>
        console.warn(
          'Market refresh failed. Serving the last saved closing prices.',
        ),
      ),
    );
  }

  return (
    <Watchlist
      stocks={snapshot.stocks}
      marketDay={latestMarketDay(snapshot.stocks)}
    />
  );
}
