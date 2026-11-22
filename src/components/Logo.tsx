// Company logos are PNGs in public/logos/, shown on a dark rounded tile. A few need help:

/** Dark marks that vanish on the dark tile; these show as white cut-outs (public/logos/mono/). */
const lightCutouts = new Set(['INTC', 'PLTR']);

/** Logos that are already square icons, so they fill the whole tile. */
const squareIcons = new Set(['ANT', 'ARM', 'CRWV']);

/** A company's logo on its tile. Decorative: the symbol is always written next to it. */
export default function Logo({ symbol }: { symbol: string }) {
  let className = 'logo';
  if (squareIcons.has(symbol)) className += ' logo-filled';

  return (
    <span className={className} aria-hidden="true">
      {lightCutouts.has(symbol) ? (
        <span
          className="logo-cutout"
          style={{ maskImage: `url(/logos/mono/${symbol}.png)` }}
        />
      ) : (
        // biome-ignore lint/performance/noImgElement: small local logos don't need Next.js image resizing.
        <img src={`/logos/${symbol}.png`} alt="" decoding="async" />
      )}
    </span>
  );
}
