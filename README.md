# Take Home Assessment

Visit https://watchlistapp-woad.vercel.app/ to view the app.

## Setup

Clone the repo:

```sh
git clone 'link'
```

Next, set up your environment using `.env.example`.

## Run

```sh
bun i
bun run dev
```

## Project overview

This project contains 15 stock tickers chosen by me. The root page lists them in a table
format. Above the table is the derby race, where you can watch how much the stocks move. You
can also click on an individual stock to see more details.

The Alpha Vantage API has a rate limit of 25 requests per day, so instead of requesting data
each time we need it, we cache it in JSON objects. This allows us to make functions like
`getDailyPrices()` and `getCompanyOverview()`.

Company overview details like the sector, industry, and market cap were limited to premium
members.

## Project structure

```
src/
  app/                          Next.js routes: each folder is a URL
    layout.tsx                  The HTML shell and fonts, shared by every page
    page.tsx                    "/": the home page
    stocks/[symbol]/page.tsx    "/stocks/NVDA" and so on: a stock's page, with its header
                                and company overview
  market/                       Shared by server and browser code
    quotes.ts                   The data types (Quote and friends), ranges, simple calculations
    format.ts                   How prices, % changes and dates are written; axis gridlines
  server/                       Server-only
    alpha-vantage.ts            The API requests, the disk cache around them, and the market
                                calendar
    snapshot.ts                 Loads and refreshes the saved watchlist
    stock-page.ts               Gathers everything the stock page shows
  components/
    Logo.tsx                    A company logo on its tile (used by both pages)
  watchlist/                    The home page
    Watchlist.tsx               The page layout and one row per stock
    RowChevron.tsx              A row's arrow, which pulses while its page loads
    Derby.tsx                   The race in the header, and each stock's lane
    race-course.ts              The race maths: each runner's path and the track's scale
    watchlist.css, derby.css
  stocks/                       The stock page
    PriceChart.tsx              The chart's state and the price readout
    ChartPlot.tsx               The plot itself, which can be dragged across to read any day
    chart-math.ts               The plot's scale, and the comparison with the other stocks
    useEntranceRace.ts          The animation when the page opens
    PriceHistory.tsx            The daily closes table
    price-chart.css, stock-page.css
  styles/
    globals.css                 Colours, base styles and the logo tile
scripts/
  refresh.ts                    The `bun refresh` command
data/
  market.json                   The saved watchlist: 15 stocks and their last 21 closes
  .cache/stocks/                Saved API responses for each stock (committed, so a deploy
                                works without calling the API)
public/logos/                   Company logos; mono/ has white cut-outs for dark logos
```
