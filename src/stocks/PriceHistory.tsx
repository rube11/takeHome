'use client';

import { useState } from 'react';
import {
  formatCount,
  formatDateWithYear,
  formatPercentChange,
  formatPrice,
  formatShortDate,
  toneClass,
} from '@/market/format';
import type { DailyPrice } from '@/market/quotes';

/** How many days show before "Show all". */
const previewDays = 10;

/**
 * A table of daily closes, newest first, each with its % change from the day before. The
 * oldest close in the history has no day before it, so it only serves as that comparison.
 */
export default function PriceHistory({
  prices,
  historyIsCurrent,
}: {
  /** Newest first. */
  prices: DailyPrice[];
  /** False when the history ends before the watchlist's newest close. */
  historyIsCurrent: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const days = prices.slice(0, -1);
  const shown = showAll ? days : days.slice(0, previewDays);
  // Dates in the newest year skip the year: "Nov 20" rather than "Nov 20, 2026".
  const newestYear = prices[0]?.date.slice(0, 4) ?? '';

  return (
    <section className="stock-section" aria-labelledby="history-heading">
      <h2 id="history-heading">Daily closes</h2>
      {days.length === 0 ? (
        <p className="stock-note">
          {prices.length
            ? 'A second trading close is needed to calculate daily change.'
            : 'Dated closes and volume aren’t available right now.'}
        </p>
      ) : (
        <>
          {!historyIsCurrent && (
            <p className="stock-note">
              Through {formatDateWithYear(prices[0].date)}.
            </p>
          )}
          <table className="history">
            <caption className="sr-only">
              Closing price, change from the previous close, and volume for each
              trading day, newest first. Prices in USD.
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Close</th>
                <th scope="col">Change</th>
                <th scope="col">Volume</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ date, close, volume }, index) => {
                const dayBefore = prices[index + 1];
                const change = close / dayBefore.close - 1;
                return (
                  <tr key={date}>
                    <th scope="row">
                      <time dateTime={date}>
                        {date.startsWith(newestYear)
                          ? formatShortDate(date)
                          : formatDateWithYear(date)}
                      </time>
                    </th>
                    <td>{formatPrice(close)}</td>
                    <td className={toneClass(change)}>
                      {formatPercentChange(change)}
                    </td>
                    <td>{volume === null ? 'N/A' : formatCount(volume)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {days.length > previewDays && (
            <button
              type="button"
              className="history-more"
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show fewer' : `Show all ${days.length} days`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
