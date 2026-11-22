'use client';

import { useLinkStatus } from 'next/link';

/**
 * The arrow at the end of a watchlist row. While the row's stock page is loading, it
 * brightens, nudges right and pulses, so a tap never feels ignored.
 * (useLinkStatus reports on the <Link> this sits inside.)
 */
export default function RowChevron() {
  const { pending } = useLinkStatus();
  return (
    <svg
      className={'row-chevron' + (pending ? ' pending' : '')}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="m6 4 4 4-4 4" />
    </svg>
  );
}
