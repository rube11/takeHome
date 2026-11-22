import { type AnimationPlaybackControls, animate } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';

// When the stock page opens, the stock's line draws itself from the first session to the
// last, with the company logo riding its tip, like a lane in the home page's derby.
//
// The server always renders the finished chart. The race only takes over in the browser:
//  - 'waiting'  CSS hides the finished line and logo until the race starts.
//  - 'running'  frames are drawn straight onto the SVG and the logo, so React doesn't
//               re-render 60 times a second.
//  - 'finished' React's own finished chart is back in charge.
// With scripts off, the finished chart simply shows from the start.

export type RacePhase = 'waiting' | 'running' | 'finished';

/** Where the line ends after `progress` (0 to 1) of the race, in plot percentages. */
type Trace = (progress: number) => {
  points: string;
  tip: { x: number; y: number };
};

/** What PriceChart and ChartPlot need from the race: its phase, a way to end it, and refs. */
export type EntranceRace = ReturnType<typeof useEntranceRace>;

export function useEntranceRace(trace: Trace) {
  const [phase, setPhase] = useState<RacePhase>('waiting');
  const animation = useRef<AnimationPlaybackControls>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);
  const areaRef = useRef<SVGPolygonElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);

  /** Ends the race at once: when it completes, or when the visitor starts using the chart. */
  function finish() {
    animation.current?.stop();
    // The logo stays mounted, so its gold ring can fade in where it lands.
    if (logoRef.current) logoRef.current.style.transform = '';
    setPhase('finished');
  }

  // Runs once, before the browser first paints the chart.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the race only plays on arrival.
  useLayoutEffect(() => {
    const finishLine = trace(1).tip;
    const drawFrame = (progress: number) => {
      const { points, tip } = trace(progress);
      lineRef.current?.setAttribute('points', points);
      areaRef.current?.setAttribute('points', `0,100 ${points} ${tip.x},100`);
      // The logo is positioned at the finish; shift it back to the tip. Measured every
      // frame, so resizing the window mid-race keeps it on the line.
      const box = plotRef.current!.getBoundingClientRect();
      const dx = ((tip.x - finishLine.x) / 100) * box.width;
      const dy = ((tip.y - finishLine.y) / 100) * box.height;
      logoRef.current!.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    drawFrame(0);
    setPhase('running');
    animation.current = animate(0, 1, {
      duration: 0.5,
      delay: 0.1,
      ease: [0.3, 0.05, 0.6, 1], // close to linear, so each session gets similar time
      onUpdate: drawFrame,
      onComplete: finish,
    });
    return () => animation.current?.stop();
    // The race runs once, for the range the page opens on.
  }, []);

  return {
    phase,
    finish,
    refs: { plot: plotRef, line: lineRef, area: areaRef, logo: logoRef },
  };
}
