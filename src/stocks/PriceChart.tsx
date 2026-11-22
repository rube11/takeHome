'use client';

import { useState } from 'react';
import {
  formatPercentChange,
  formatPrice,
  formatPriceChange,
  formatShortDate,
  toneClass,
} from '@/market/format';
import {
  changeSinceStart,
  month,
  type Peers,
  type Quote,
  type Range,
  threeMonths,
  week,
} from '@/market/quotes';
import ChartPlot from './ChartPlot';
import { canCompare, chartScale, comparePeers, linePoints } from './chart-math';
import { useEntranceRace } from './useEntranceRace';
import './price-chart.css';

/**
 * The top of a stock's page: its price, and its race against the rest of the watchlist over
 * the chosen range. The line is the stock's % change since the range began; the grey band
 * behind it is the middle of the pack (the middle half of the other stocks). Drag across the
 * chart to read any session.
 *
 * `dates`, when known, line up with `quote.closes`.
 */
export default function PriceChart({
  quote,
  dates,
  peers,
}: {
  quote: Quote;
  dates?: string[];
  peers: Peers;
}) {
  // Offer only the ranges the closes can fill; the shortest is always offered.
  const offered = [week, month, threeMonths].filter(
    (range, index) => index === 0 || quote.closes.length > range.sessions,
  );
  const [range, setRange] = useState(
    offered.includes(month) ? month : offered[0],
  );
  /** The session being read by dragging or hovering; null shows the latest close. */
  const [scrubbed, setScrubbed] = useState<number | null>(null);

  // The closes in the chosen range: `sessions` days, plus the close before them to measure from.
  const first = Math.max(0, quote.closes.length - range.sessions - 1);
  const closes = quote.closes.slice(first);
  const path = changeSinceStart(closes);
  const last = closes.length - 1;
  const session = scrubbed ?? last;
  // A stock with less history than the range is labelled for what it has.
  const fillsRange = quote.closes.length > range.sessions;
  const rangeName = fillsRange ? range.name : 'Available history';

  const comparison = canCompare(range.sessions, quote.closes.length, peers)
    ? comparePeers(path, peers)
    : null;
  const scale = chartScale(
    [...path, ...(comparison?.pack.flat() ?? [])],
    closes.length,
  );
  const race = useEntranceRace((progress) => linePoints(path, scale, progress));
  // Gold for first place, but only when the peers' data reaches the last session.
  const leading =
    comparison !== null &&
    comparison.lastSession === last &&
    comparison.placeOn(last) === 1;

  /** A session's date, or how many sessions ago it was when dates aren't known. */
  function dateOf(index: number) {
    if (dates) return formatShortDate(dates[first + index]);
    const ago = last - index;
    if (ago === 0) return formatShortDate(quote.asOf);
    return ago === 1 ? '1 session ago' : `${ago} sessions ago`;
  }

  /** Reading a session ends the entrance race, so the input always wins. */
  function scrubTo(index: number | null) {
    if (index !== null) race.finish();
    setScrubbed(index);
  }

  function choose(option: Range) {
    race.finish();
    setRange(option);
    setScrubbed(null);
  }

  return (
    <section
      className="price-chart"
      aria-labelledby="stock-symbol"
      data-race={race.phase}
    >
      <Readout
        price={closes[session]}
        move={closes[session] - closes[0]}
        change={path[session]}
        note={
          scrubbed === null
            ? rangeName
            : dates
              ? `${dateOf(session)} · since ${dateOf(0)}`
              : dateOf(session)
        }
      />

      <ChartPlot
        symbol={quote.symbol}
        path={path}
        scale={scale}
        pack={comparison?.pack ?? null}
        leading={leading}
        race={race}
        scrubbed={scrubbed}
        onScrub={scrubTo}
        startLabel={dates ? dateOf(0) : undefined}
        endLabel={dateOf(last)}
      />

      {offered.length > 1 && (
        // biome-ignore lint/a11y/useSemanticElements: a <fieldset> would need its default border and legend styles undone.
        <div className="segmented" role="group" aria-label="Chart range">
          {offered.map((option) => (
            <button
              key={option.label}
              type="button"
              title={option.name}
              aria-pressed={option === range}
              onClick={() => choose(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The big price above the chart and the line under it: the move since the range began, and
 * what it's measured over. While the visitor scrubs the chart, these describe the session
 * under their finger.
 */
function Readout({
  price,
  move,
  change,
  note,
}: {
  price: number;
  /** The move in dollars since the first close of the range. */
  move: number;
  /** The same move as a fraction. */
  change: number;
  /** "Past month", or the scrubbed session's date. */
  note: string;
}) {
  return (
    <div className="readout">
      <span className="readout-price">{formatPrice(price)}</span>
      <span className="readout-move">
        <span className={toneClass(change)}>
          {formatPriceChange(move)} ({formatPercentChange(change)})
        </span>{' '}
        <span className="readout-note">{note}</span>
      </span>
    </div>
  );
}
