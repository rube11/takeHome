'use client';

import Link, { useLinkStatus } from 'next/link';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Logo from '@/components/Logo';
import { formatShortPercent, toneClass } from '@/market/format';
import type { Quote } from '@/market/quotes';
import type { Runner } from './race-course';
import {
  buildRaceCourse,
  type RaceLength,
  raceLengths,
  stocksThatCanRace,
} from './race-course';
import './derby.css';

/**
 * The home page header: the watchlist as a horse race over the past week or month. Each
 * stock's logo runs along its own lane at its % change so far, the lanes re-sort after every
 * session, and the leader wears a gold ring. When the race is over, each lane also shows the
 * stock's range so far and a trail for today's move (see DerbyLane below).
 */
export default function Derby({ stocks }: { stocks: Quote[] }) {
  // A race needs at least two stocks with enough history; start on the longest that has them.
  const available = raceLengths.filter(
    ({ sessions }) => stocksThatCanRace(stocks, sessions).length > 1,
  );
  const [length, setLength] = useState(available.at(-1) ?? raceLengths[1]);
  /** How many sessions have been run; the race is over when it reaches length.sessions. */
  const [session, setSession] = useState(0);
  const [track, setTrack] = useState<TrackSize>({ width: 0, logoCover: 0 });

  const { runners, x, gridlines } = useMemo(
    () => buildRaceCourse(stocks, length.sessions),
    [stocks, length],
  );
  const finished = session >= length.sessions;

  // Run one session per tick.
  useEffect(() => {
    if (finished) return;
    const tick = setTimeout(() => setSession(session + 1), length.msPerSession);
    return () => clearTimeout(tick);
  }, [session, finished, length]);

  // Measure the track (in pixels) whenever it resizes, for DerbyLane's direction arrows.
  // This is a "callback ref": React calls it with the element once it's on the page, and
  // calls the function it returns when the element goes away.
  const measureTrack = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const styles = getComputedStyle(element);
      const px = (name: string) => parseFloat(styles.getPropertyValue(name));
      setTrack({
        width: element.clientWidth,
        // Half the logo tile, its outline and a little gap.
        logoCover: px('--tile') / 2 + px('--ring') + 3,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Each runner's place after this session (0 is first); ties keep their list order.
  const order = runners
    .map((runner, index) => ({ index, change: runner.path[session] }))
    .sort((a, b) => b.change - a.change || a.index - b.index);
  const placeOf = new Map(order.map(({ index }, place) => [index, place]));

  // The final result, in words, for screen readers.
  const results = [...runners]
    .sort((a, b) => b.path.at(-1)! - a.path.at(-1)!)
    .map(({ symbol, path }) => `${symbol} ${formatShortPercent(path.at(-1)!)}`)
    .join(', ');

  function startRace(option: RaceLength) {
    setLength(option);
    setSession(0);
  }

  if (runners.length < 2) return null;

  return (
    <figure
      className={'derby ' + (finished ? 'finished' : 'running')}
      style={{ '--session-ms': length.msPerSession + 'ms' } as CSSProperties}
    >
      <figcaption className="sr-only">
        {length.name}, ranked by change: {results}.
      </figcaption>

      <div className="derby-head">
        <div className="derby-heading">
          <span className="derby-title">{length.name}</span>
          <span className="derby-day" aria-hidden="true">
            {finished
              ? `Return over ${length.sessions} trading days`
              : session > 0 && `Day ${session} of ${length.sessions}`}
          </span>
        </div>
        <button
          type="button"
          className="derby-replay"
          aria-label="Replay the race"
          onClick={() => startRace(length)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v3h3" />
          </svg>
        </button>
        {/* biome-ignore lint/a11y/useSemanticElements: a <fieldset> would need its default border and legend styles undone. */}
        <div className="segmented" role="group" aria-label="Race length">
          {raceLengths.map((option) => (
            <button
              key={option.label}
              type="button"
              title={option.name}
              aria-pressed={option === length}
              disabled={!available.includes(option)}
              onClick={() => startRace(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* A progress bar for the race. */}
      <span className="derby-clock" aria-hidden="true">
        <i style={{ width: (session / length.sessions) * 100 + '%' }} />
      </span>

      <div
        className="derby-field"
        style={{ '--runners': runners.length } as CSSProperties}
        aria-hidden="true"
      >
        <div ref={measureTrack} className="derby-gridlines">
          {gridlines.map(({ value }) => (
            <i
              key={value}
              // The 0% line is the starting gate.
              className={value === 0 ? 'derby-gate' : 'derby-gridline'}
              style={{ left: x(value) + '%' }}
            />
          ))}
        </div>
        {runners.map((runner, index) => (
          <DerbyLane
            key={runner.symbol}
            runner={runner}
            session={session}
            place={placeOf.get(index)!}
            finished={finished}
            x={x}
            track={track}
          />
        ))}
      </div>

      <div className="derby-axis" aria-hidden="true">
        {gridlines.map(({ value, label }) => (
          <span key={value} style={{ left: x(value) + '%' }}>
            {label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** The track's width in pixels, and how far the logo tile covers a trail from its centre. */
type TrackSize = { width: number; logoCover: number };

/** Moves smaller than this (0.05%) count as flat and get no trail. */
const flatMove = 0.0005;

/** The band marks its high point once the stock has been at least this far up (0.3%). */
const markHighFrom = 0.003;

/** A trail showing less than this many pixels beyond the logo gets a direction arrow too. */
const minVisibleTrailPx = 10;

/**
 * One stock's lane in the derby, linking to its page. During the race the logo runs at the
 * stock's % change so far, over a faint band of the range it has covered. When the race is
 * over, a tapered trail from a hollow dot (yesterday) to the logo (today) shows today's move.
 */
function DerbyLane({
  runner,
  session,
  place,
  finished,
  x,
  track,
}: {
  runner: Runner;
  /** Sessions run so far. */
  session: number;
  /** 0 is first. Lanes are stacked in place order. */
  place: number;
  finished: boolean;
  /** Places a % change across the track, from 0 to 100. */
  x: (change: number) => number;
  track: TrackSize;
}) {
  const { symbol, path } = runner;
  const now = path[session];
  const position = x(now);

  // The band covers only the ground run so far, so it never gives the finish away.
  const soFar = path.slice(0, session + 1);
  const bandLow = Math.min(...soFar);
  const bandHigh = Math.max(...soFar);

  // Today's move: from yesterday's close to the finish.
  const today = path.at(-1)! - path.at(-2)!;
  const finishX = x(path.at(-1)!);
  const yesterdayX = x(path.at(-2)!);
  const moved = Math.abs(today) >= flatMove;
  const direction = today >= 0 ? 'up' : 'down';
  // A runaway stock is pinned to the edge of the track (see buildRaceCourse in race-course.ts).
  const pinned = finishX === 0 || finishX === 100;
  // A pinned stock that moved further outward today (down at the left edge, or up at the
  // right edge) gets a dashed trail running in from the edge instead.
  const pinnedLeftAndFell = finishX === 0 && today < 0;
  const pinnedRightAndRose = finishX === 100 && today >= 0;
  const offScaleTrail = pinnedLeftAndFell || pinnedRightAndRose;
  // How much of the trail shows beyond the logo, in pixels. When it's too little to see,
  // a small arrow still shows which way the stock moved.
  const visibleTrail =
    (Math.abs(finishX - yesterdayX) / 100) * track.width - track.logoCover;
  const showArrow =
    finished &&
    track.width > 0 &&
    moved &&
    !offScaleTrail &&
    (pinned || visibleTrail < minVisibleTrailPx);

  let logoClass = 'derby-logo';
  if (position === 0) logoClass += ' pinned-left';
  if (position === 100) logoClass += ' pinned-right';

  return (
    <Link
      href={`/stocks/${symbol}`}
      prefetch={false} // loading a stock page can spend API quota (see README)
      tabIndex={-1} // keyboard users reach each stock through the list below
      className={'derby-lane' + (place === 0 && session > 0 ? ' leading' : '')}
      style={{ '--place': place, '--x': position + '%' } as CSSProperties}
    >
      <LoadingGlow />
      <span className="derby-track">
        <i
          className="derby-band"
          style={{
            left: x(bandLow) + '%',
            width: x(bandHigh) - x(bandLow) + '%',
          }}
        >
          {bandHigh >= markHighFrom && <i className="derby-high" />}
        </i>

        {finished && moved && !pinned && (
          <>
            <i
              className={'derby-trail ' + direction}
              style={{
                left: Math.min(finishX, yesterdayX) + '%',
                width: Math.abs(finishX - yesterdayX) + '%',
              }}
            />
            <i className="derby-yesterday" style={{ left: yesterdayX + '%' }} />
          </>
        )}
        {finished && moved && offScaleTrail && (
          <i
            className={'derby-trail off-scale ' + direction}
            style={finishX === 0 ? { left: 0 } : { right: 0 }}
          />
        )}
        {showArrow && (
          <i
            className={'derby-arrow ' + direction}
            style={{ left: finishX + '%' }}
          />
        )}

        {/* Positioned by the lane's --x (see derby.css). */}
        <span className={logoClass}>
          <Logo symbol={symbol} />
        </span>
      </span>
      <span className={'derby-change ' + toneClass(now)}>
        {formatShortPercent(now)}
      </span>
    </Link>
  );
}

/** Lights the lane while its stock page loads (useLinkStatus reports on the enclosing Link). */
function LoadingGlow() {
  const { pending } = useLinkStatus();
  return (
    <span
      className={'derby-loading' + (pending ? ' pending' : '')}
      aria-hidden="true"
    />
  );
}
