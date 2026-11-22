import { gridlines } from '@/market/format';
import {
  changeSinceStart,
  month,
  type Quote,
  type Range,
  week,
} from '@/market/quotes';

// The derby treats the watchlist as a horse race. Each stock is a runner whose position is its
// % change since the race began, so the leader is whichever stock has gained the most so far.

/** A race over one of the shared ranges, and how long each session takes on screen. */
export type RaceLength = Range & { msPerSession: number };

// The week runs slower than the month, so both races take a similar time.
export const raceLengths: RaceLength[] = [
  { ...week, msPerSession: 1320 },
  { ...month, msPerSession: 600 },
];

/**
 * Gridline steps for the track. Unlike the chart's (gridSteps), these skip 2.5% and 25%, so
 * the derby's narrow axis labels stay short and round.
 */
const trackSteps = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5];

/** A stock in the race, with its % change after each session (index 0 is the start, 0%). */
export type Runner = { symbol: string; path: number[] };

/** The stocks with enough closes to run a race of this many sessions. */
export const stocksThatCanRace = (stocks: Quote[], sessions: number) =>
  stocks.filter((quote) => quote.closes.length > sessions);

/**
 * Everything needed to draw a race: the runners, an `x` function placing a % change across
 * the track (0 to 100% of its width), and the % values for its gridlines.
 *
 * The track always includes 0%. When one stock finishes far beyond the others, it's pinned to
 * the edge (x is clamped) instead of squeezing everyone else into a corner: that happens when
 * making room for it would take over a third of the width.
 */
export function buildRaceCourse(stocks: Quote[], sessions: number) {
  const runners: Runner[] = stocksThatCanRace(stocks, sessions).map(
    ({ symbol, closes }) => ({
      symbol,
      path: changeSinceStart(closes.slice(-(sessions + 1))),
    }),
  );

  const [fullLow, fullHigh] = extent(runners);
  let [low, high] = [fullLow, fullHigh];

  // Check the last-placed and first-placed runners for a runaway finish.
  const byFinish = [...runners].sort((a, b) => a.path.at(-1)! - b.path.at(-1)!);
  const candidates = runners.length > 2 ? [byFinish[0], byFinish.at(-1)!] : [];
  for (const runner of candidates) {
    const [lowWithout, highWithout] = extent(
      runners.filter((other) => other !== runner),
    );
    const finish = runner.path.at(-1)!;
    const outsideTheRest = finish < lowWithout || finish > highWithout;
    const takesTooMuchRoom =
      fullHigh - fullLow > 1.5 * (highWithout - lowWithout);
    if (outsideTheRest && takesTooMuchRoom) {
      if (finish < 0) low = lowWithout;
      else high = highWithout;
    }
  }

  // A little room at both ends.
  const room = (high - low) * 0.04 || 0.01;
  low -= room;
  high += room;

  const x = (change: number) => {
    const share = ((change - low) / (high - low)) * 100;
    return Math.max(0, Math.min(100, share));
  };

  // The finest step with no more than six steps across the track.
  const step = trackSteps.find((size) => (high - low) / size <= 6) ?? 1;
  return { runners, x, gridlines: gridlines(low, high, step) };
}

/** The lowest and highest % change any of these runners reached, always including 0%. */
function extent(runners: Runner[]): [number, number] {
  const values = runners.flatMap((runner) => runner.path);
  return [Math.min(0, ...values), Math.max(0, ...values)];
}
