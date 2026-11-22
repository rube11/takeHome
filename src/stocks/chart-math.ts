import { gridlineCount, gridlines, gridSteps } from '@/market/format';
import { changeSinceStart, type Peers } from '@/market/quotes';

// The stock chart's calculations, kept apart from its markup:
//   1. The scale: where things go on the plot.
//   2. The peer comparison: how the stock did against the rest of the watchlist.

// ---- 1. The scale ----

// Where things go on the chart. The plot is drawn in an SVG whose coordinates run from 0 to
// 100 in both directions and stretch to fill the box, so x and y here are percentages of the
// plot's width and height.

/** The chart has room for this many gridlines at most. */
const maxGridlines = 5;

export type ChartScale = ReturnType<typeof chartScale>;

/**
 * The scale for a chart of `sessionCount` sessions whose % changes include `values`. The
 * vertical range covers every value (and 0%) with 10% room above and below.
 */
export function chartScale(values: number[], sessionCount: number) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const room = (max - min || 0.01) * 0.1;
  const low = min - room;
  const high = max + room;
  const last = sessionCount - 1;
  // The finest round step that draws no more than five lines.
  const step =
    gridSteps.find((size) => gridlineCount(low, high, size) <= maxGridlines) ??
    1;

  return {
    /** Horizontal position of a session (it may be fractional while the line draws in). */
    x: (session: number) => (last ? (session / last) * 100 : 100),
    /** Vertical position of a % change; higher values sit nearer the top. */
    y: (value: number) => (1 - (value - low) / (high - low)) * 100,
    gridlines: gridlines(low, high, step),
  };
}

/**
 * SVG points for the line up to `progress` (0 to 1) of the way through the sessions. Part
 * way, the line ends between two closes, at the interpolated value. Also returns that end
 * point, where the logo sits.
 */
export function linePoints(
  path: number[],
  scale: Pick<ChartScale, 'x' | 'y'>,
  progress = 1,
) {
  const last = path.length - 1;
  const reached = progress * last;
  const passed = Math.min(last, Math.floor(reached));
  const tipValue =
    passed === last
      ? path[last]
      : path[passed] + (path[passed + 1] - path[passed]) * (reached - passed);

  const points = path
    .slice(0, passed + 1)
    .map((value, session) => `${scale.x(session)},${scale.y(value)}`);
  points.push(`${scale.x(reached)},${scale.y(tipValue)}`);

  return {
    points: points.join(' '),
    tip: { x: scale.x(reached), y: scale.y(tipValue) },
  };
}

// ---- 2. The peer comparison ----

// How a stock did against the rest of the watchlist ("its peers") over the chart's range.
// Every stock is measured as % change since the first session of the range, so a $40 stock
// and a $600 stock can be compared fairly.

/** A comparison needs at least this many peers to say anything useful. */
const minimumPeers = 3;

export type PeerComparison = {
  /** The last session (index into the range's path) the peers have data for. */
  lastSession: number;
  /**
   * "Middle of the pack" for each session up to lastSession: the range holding the middle
   * half of the peers' changes (from the 25th to the 75th percentile).
   */
  pack: [low: number, high: number][];
  /** This stock's place on a session: 1 is best, and ties share a place. */
  placeOn: (session: number) => number;
};

/** The peers with closes for every session up to `lastSession`. */
const peersReaching = (peers: Peers, lastSession: number) =>
  peers.closes.filter((closes) => closes.length > lastSession);

/**
 * Whether a range of this many sessions can be compared with the peers: the stock must have
 * closes for the whole range, and at least three peers must have closes for the sessions
 * they share with it. `stockCloses` is how many closes the stock has in all.
 */
export function canCompare(
  sessions: number,
  stockCloses: number,
  peers: Peers,
) {
  // The peers' data may end `lag` sessions before the stock's (see Peers).
  const lastSession = sessions - peers.lag;
  return (
    stockCloses > sessions &&
    lastSession > 0 &&
    peersReaching(peers, lastSession).length >= minimumPeers
  );
}

/**
 * Compares a stock's % changes over a range (`path`, one per session, starting at 0) with
 * its peers over the same sessions. Call it only when canCompare allows the range.
 */
export function comparePeers(path: number[], peers: Peers): PeerComparison {
  const lastSession = path.length - 1 - peers.lag;

  // Each peer's % change over the same sessions, ending on its own newest close.
  const peerPaths = peersReaching(peers, lastSession).map((closes) =>
    changeSinceStart(closes.slice(-(lastSession + 1))),
  );

  // For each session, every peer's change on that session, lowest first.
  const sessions = path
    .slice(0, lastSession + 1)
    .map((_, session) =>
      peerPaths.map((peerPath) => peerPath[session]).sort((a, b) => a - b),
    );

  return {
    lastSession,
    pack: sessions.map((values) => [
      percentile(values, 0.25),
      percentile(values, 0.75),
    ]),
    placeOn: (session) =>
      1 + sessions[session].filter((value) => value > path[session]).length,
  };
}

/**
 * The value `share` of the way through sorted values (0.5 is the median), interpolating
 * between neighbours when it falls between two of them.
 */
function percentile(sorted: number[], share: number) {
  const position = (sorted.length - 1) * share;
  const below = Math.floor(position);
  const above = Math.min(sorted.length - 1, below + 1);
  return sorted[below] + (sorted[above] - sorted[below]) * (position - below);
}
