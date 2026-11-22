import Link from 'next/link';
import { notFound } from 'next/navigation';
import Logo from '@/components/Logo';
import { formatCompactDollars } from '@/market/format';
import type { CompanyDetails, Quote } from '@/market/quotes';
import { loadStockPage } from '@/server/stock-page';
import PriceChart from '@/stocks/PriceChart';
import PriceHistory from '@/stocks/PriceHistory';
import '@/stocks/stock-page.css';

// Read the saved prices on every request, so a refresh shows up without a rebuild.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props) {
  const { symbol } = await params;
  return { title: symbol.toUpperCase() + ' · Ticker' };
}

/** A stock's page: its chart against the watchlist, company overview and daily closes. */
export default async function StockPage({ params }: Props) {
  const { symbol } = await params;
  const stock = await loadStockPage(symbol);
  if (!stock) notFound();

  return (
    <main className="app">
      <StockHeader quote={stock.quote} />
      <PriceChart quote={stock.quote} dates={stock.dates} peers={stock.peers} />
      <CompanyOverview overview={stock.overview} />
      <PriceHistory
        prices={stock.prices}
        historyIsCurrent={stock.historyIsCurrent}
      />
    </main>
  );
}

/** The link back to the watchlist, then the stock's logo, symbol and company name. */
function StockHeader({ quote }: { quote: Quote }) {
  return (
    <>
      <Link className="back-link" href="/">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3 5 8l5 5" />
        </svg>
        Watchlist
      </Link>
      <div className="stock-header">
        <Logo symbol={quote.symbol} />
        <div className="stock-name">
          <h1 id="stock-symbol">{quote.symbol}</h1>
          <p>{quote.name}</p>
        </div>
      </div>
    </>
  );
}

/**
 * Every Company Overview field from Alpha Vantage, each showing N/A when the provider doesn't
 * have it. On a free API key the whole overview is unavailable, so every field shows N/A.
 */
function CompanyOverview({ overview }: { overview: CompanyDetails | null }) {
  const company = overview ?? {};
  const cap = company.MarketCapitalization;
  const facts = [
    ['Symbol', company.Symbol],
    ['Name', company.Name],
    ['Asset type', company.AssetType],
    ['Exchange', company.Exchange],
    ['Sector', company.Sector],
    ['Industry', company.Industry],
    [
      'Market cap',
      cap && /^\d+$/.test(cap) ? formatCompactDollars(Number(cap)) : undefined,
    ],
    ['Description', company.Description],
  ];

  return (
    <section className="stock-section" aria-labelledby="overview-heading">
      <h2 id="overview-heading">Company overview</h2>
      <dl className="fact-list company-facts">
        {facts.map(([label, value]) => (
          <div
            key={label}
            className={label === 'Description' ? 'description' : undefined}
          >
            <dt>{label}</dt>
            <dd>{value ?? 'N/A'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
