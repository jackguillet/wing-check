# Wing Check

A personal weather alert dashboard for wing foil enthusiasts. Track wind conditions at your favorite spots with go/no-go forecasts, rideable window detection, and email alerts.

## Features

- **Spot Management** — Save spots with lat/lng, preferred wind conditions, and NOAA station IDs for tide data
- **Live Forecasts** — 14-day hourly wind speed, gusts, direction, temperature, swell, and wave data via Open-Meteo (graded over the first 7 days)
- **Go/No-Go Scoring** — Configurable evaluator scores each hour (0-100) based on wind range, gust factor, direction, and wave height, then finds rideable windows
- **Wind Charts** — Visual wind speed + gust band charts with min/max reference lines
- **Email Alerts** — Scheduled checks via Resend that notify you when conditions look good
- **Forecast Caching** — SQLite-backed cache avoids redundant API calls

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | Turso (LibSQL) via Drizzle ORM |
| UI | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Weather API | Open-Meteo (free, no key) |
| Tides | NOAA Tides & Currents |
| Email | Resend |

**Total cost: $0** — every component has a free tier.

## Getting Started

```bash
# Clone and install
git clone <your-repo-url>
cd wing-check
npm install

# Set up environment (optional, for email alerts)
cp .env.example .env.local
# Edit .env.local with your Resend API key

# Seed the database with example spots
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:seed` | Seed database with example spots |
| `npm test` | Run evaluator unit tests |

## How the Evaluator Works

Each forecast hour is scored on four dimensions:

1. **Wind Speed (0-40 pts)** — Hard gate outside your min/max. Inside the band, score peaks at the midpoint.
2. **Gusts (0-25 pts)** — Hard gate only above **50 kt**. Below that, a soft curve vs `max_gust_factor` (1.0 = no extra gusts allowed). Gusty trades can still score.
3. **Wind Direction (0-25 pts)** — Empty preferred list = full 25. If dirs are set, outside tolerance **zeros the hour** (cannot GO). Inside the band, closer to the chip scores higher.
4. **Wave Height (0-10 pts)** — Soft. Over the max, or missing marine data when a max is set, = 0 of 10 (not a hard zero). Thunderstorms (WMO 95/96/99) zero the hour. Heavy rain (65), violent rain (82), and fog (45/48) subtract up to 10.

Tide phase, swell quality, and wave amplification are shown on the spot page and **are not in the grade**.

Consecutive **remaining** daylight hours scoring 50+ form **rideable windows**. Hours that have already ended do not count. The best remaining window's average determines the day:
- **GO** (≥70): A remaining window looks great
- **MARGINAL**: A remaining window, but not ideal
- **NO-GO**: No remaining window

Overall GO/NO-GO is **today in the spot's timezone**, not the first date in the series.

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

The `vercel.json` cron checks alerts once a day at 14:00 UTC (Hobby plan). A send fires when a remaining window in the next 48 hours scores GO (70+). The same window date is not emailed twice.

## License

MIT
