# Wing Check

A personal weather alert dashboard for wing foil enthusiasts. Track wind conditions at your favorite spots with go/no-go forecasts, rideable window detection, and email alerts.

## Features

- **Spot Management** — Save spots with lat/lng, preferred wind conditions, and NOAA station IDs for tide data
- **Live Forecasts** — 7-day hourly wind speed, gusts, direction, temperature, swell, and wave data via Open-Meteo
- **Go/No-Go Scoring** — Configurable evaluator scores each hour (0-100) based on wind range, gust factor, direction, and wave height, then finds rideable windows
- **Wind Charts** — Visual wind speed + gust band charts with min/max reference lines
- **Email Alerts** — Scheduled checks via Resend that notify you when conditions look good
- **Forecast Caching** — SQLite-backed cache avoids redundant API calls

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | SQLite via Drizzle ORM |
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

1. **Wind Speed (0-40 pts)** — Must be within your configured min/max range. Peak score at the midpoint.
2. **Gust Factor (0-25 pts)** — Gusts must be below `wind_speed × max_gust_factor`. Steadier = higher score.
3. **Wind Direction (0-25 pts)** — Must be within tolerance of your preferred directions. Closer = higher score.
4. **Wave Height (0-10 pts)** — Optional. Must be below your max threshold.

Consecutive hours scoring 50+ form **rideable windows**. The best window's average determines the overall go/no-go:
- **GO** (≥70): Conditions look great
- **MARGINAL** (40-69): Rideable but not ideal
- **NO-GO** (<40): Not worth it

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

The `vercel.json` includes a cron job that checks alerts every 6 hours.

## License

MIT
