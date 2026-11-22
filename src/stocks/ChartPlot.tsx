import { type PointerEvent, useId } from 'react';
import Logo from '@/components/Logo';
import { toneClass } from '@/market/format';
import { type ChartScale, linePoints } from './chart-math';
import type { EntranceRace } from './useEntranceRace';

/**
 * The chart itself: gridlines, the middle-of-the-pack band, the stock's line with its logo
 * at the end, the % axis, the first and last dates, and a key. Drag or hover across it to
 * pick a session.
 */
export default function ChartPlot({
  symbol,
  path,
  scale,
  pack,
  leading,
  race,
  scrubbed,
  onScrub,
  startLabel,
  endLabel,
}: {
  symbol: string;
  /** The stock's % change on each session of the range. */
  path: number[];
  scale: ChartScale;
  /** The middle of the pack on each session, or null when there's no comparison. */
  pack: [number, number][] | null;
  /** Whether the stock finished first, and wears the gold ring. */
  leading: boolean;
  race: EntranceRace;
  scrubbed: number | null;
  onScrub: (session: number | null) => void;
  startLabel?: string;
  endLabel: string;
}) {
  const areaFade = useId();
  const { x, y, gridlines } = scale;
  const last = path.length - 1;
  const line = linePoints(path, scale).points;
  // While the entrance race runs, the line and area are drawn frame by frame. At the finish
  // they're remounted (a new key), so React's own points replace the drawn frames.
  const drawnBy = race.phase === 'finished' ? 'react' : 'race';

  const clampSession = (index: number) => Math.min(last, Math.max(0, index));

  function onPointer(event: PointerEvent<HTMLElement>) {
    // A mouse reads the chart on hover; touch and pen read it only while pressed.
    const pressed = event.buttons !== 0 || event.type === 'pointerdown';
    if (event.pointerType !== 'mouse' && !pressed) return;
    const box = event.currentTarget.getBoundingClientRect();
    const share = (event.clientX - box.left) / box.width;
    onScrub(clampSession(Math.round(share * last)));
  }

  return (
    <div className="chart">
      <div className="chart-frame">
        <div
          ref={race.refs.plot}
          className={'chart-plot ' + toneClass(path[last])}
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={() => onScrub(null)}
          onPointerCancel={() => onScrub(null)}
        >
          {/* Coordinates run 0–100 both ways and stretch to fill the box. */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={areaFade} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.1" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>

            {gridlines.map(({ value }) => (
              <line
                key={value}
                // Without a comparison, 0% (the first close) gets a dashed baseline.
                className={value === 0 && !pack ? 'chart-base' : 'chart-grid'}
                x1="0"
                x2="100"
                y1={y(value)}
                y2={y(value)}
              />
            ))}

            {pack ? (
              // The band's outline: along its top edge from the first session to the last,
              // then back along its bottom edge.
              <polygon
                className="chart-pack"
                points={[
                  ...pack.map(([, high], index) => `${x(index)},${y(high)}`),
                  ...pack
                    .map(([low], index) => `${x(index)},${y(low)}`)
                    .reverse(),
                ].join(' ')}
              />
            ) : (
              last > 0 && (
                // Alone, the stock gets a soft fade under its line instead.
                <polygon
                  key={'area-' + drawnBy}
                  ref={race.refs.area}
                  className="chart-area"
                  fill={`url(#${areaFade})`}
                  points={`0,100 ${line} 100,100`}
                />
              )
            )}

            <polyline
              key={'line-' + drawnBy}
              ref={race.refs.line}
              className="chart-line"
              points={line}
            />

            {scrubbed !== null && (
              <line
                className="chart-crosshair"
                x1={x(scrubbed)}
                x2={x(scrubbed)}
                y1="0"
                y2="100"
              />
            )}
          </svg>

          {scrubbed !== null && scrubbed !== last && (
            <span
              className="chart-dot"
              style={{ left: x(scrubbed) + '%', top: y(path[scrubbed]) + '%' }}
              aria-hidden="true"
            />
          )}

          {/* The logo at the end of the line. Gold waits until the race is over. */}
          <span
            ref={race.refs.logo}
            className={
              'chart-logo' +
              (leading && race.phase !== 'running' ? ' leading' : '')
            }
            style={{ left: '100%', top: y(path[last]) + '%' }}
            aria-hidden="true"
          >
            <Logo symbol={symbol} />
          </span>
        </div>

        <div className="chart-axis" aria-hidden="true">
          {gridlines.map(({ value, label: text }) => (
            <span key={value} style={{ top: y(value) + '%' }}>
              {text}
            </span>
          ))}
        </div>

        <div className="chart-dates" aria-hidden="true">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      </div>

      <p className="chart-key">
        <span>
          <i className={'chart-key-line ' + toneClass(path[last])} />
          {symbol}
          {!pack && ' only'}
        </span>
        {pack && (
          <span>
            <i className="chart-key-pack" />
            Middle of the pack
          </span>
        )}
      </p>
    </div>
  );
}
