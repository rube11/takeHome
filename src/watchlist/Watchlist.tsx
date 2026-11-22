import Link from 'next/link';
import type { CSSProperties } from 'react';
import Logo from '@/components/Logo';
import {
  formatPercentChange,
  formatPrice,
  formatPriceChange,
  formatShortDate,
  toneClass,
} from '@/market/format';
import { dailyChange, type Quote } from '@/market/quotes';
import Derby from './Derby';
import RowChevron from './RowChevron';
import './watchlist.css';

/** The home page: the derby race on top, then one row per stock. */
export default function Watchlist({
  stocks,
  marketDay,
}: {
  stocks: Quote[];
  /** The newest trading date in the watchlist. */
  marketDay: string;
}) {
  return (
    <main className="app">
      <header className="watchlist-header">
        <h1 className="sr-only">Watchlist</h1>
        {/* A stock whose newest close is older would be a day out of step in the race. */}
        <Derby stocks={stocks.filter((quote) => quote.asOf === marketDay)} />
      </header>

      {/* Column headings for the wide layout; each row also labels its numbers for screen readers. */}
      <div className="columns" aria-hidden="true">
        <span>Company</span>
        <span>Close</span>
        <span>Change</span>
        <span>% Change</span>
      </div>
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari stops announcing a list once its bullets are removed. */}
      <ul className="list" role="list">
        {stocks.map((quote) => (
          <WatchlistRow
            key={quote.symbol}
            quote={quote}
            isBehind={quote.asOf !== marketDay}
          />
        ))}
      </ul>
    </main>
  );
}

/** One stock in the list: logo, symbol and name, then its close and the day's move. */
function WatchlistRow({
  quote,
  isBehind,
}: {
  quote: Quote;
  /** True when this stock's newest close is older than the rest of the watchlist's. */
  isBehind: boolean;
}) {
  const { symbol, name, asOf } = quote;
  const { price, move, change } = dailyChange(quote);

  return (
    <li
      className="item"
      style={{ '--move': Math.abs(change) } as CSSProperties}
    >
      {/* No prefetching: loading a stock page can spend API quota (see README). */}
      <Link className="row" href={`/stocks/${symbol}`} prefetch={false}>
        <Logo symbol={symbol} />
        <span className="row-name">
          <span className="row-symbol">{symbol}</span>{' '}
          <span className="row-company">{name}</span>
          {isBehind && (
            <span className="row-stale">
              Last close {formatShortDate(asOf)}
            </span>
          )}
        </span>
        <span className="row-price">
          <span className="sr-only">Close </span>
          {formatPrice(price)}
        </span>
        <span className={'row-move ' + toneClass(change)}>
          <span className="sr-only">Day change </span>
          {formatPriceChange(move)}
        </span>
        <span className={'row-change ' + toneClass(change)}>
          <span className="sr-only">Daily percentage change </span>
          {formatPercentChange(change)}
        </span>
        <RowChevron />
      </Link>
    </li>
  );
}
