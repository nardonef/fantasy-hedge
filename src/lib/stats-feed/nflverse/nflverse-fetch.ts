import { type CsvRow, parseCsv } from "./nflverse-data";

const RELEASES_BASE = "https://github.com/nflverse/nflverse-data/releases/download";
const CROSSWALK_URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv";

// In-memory cache for the lifetime of the process — these CSVs update at most daily, so
// re-fetching per settlement-job run is wasteful but not incorrect. A real production
// deployment would want a persistent/CDN-backed cache; out of scope here.
const csvCache = new Map<string, Promise<CsvRow[]>>();

async function fetchCsv(url: string): Promise<CsvRow[]> {
  const cached = csvCache.get(url);
  if (cached) return cached;

  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`nflverse fetch failed: ${res.status} ${url}`);
      return res.text();
    })
    .then(parseCsv);

  csvCache.set(url, promise);
  return promise;
}

export function fetchCrosswalk(): Promise<CsvRow[]> {
  return fetchCsv(CROSSWALK_URL);
}

export function fetchSchedule(season: number): Promise<CsvRow[]> {
  // nflverse's schedules release is one file covering every season, not one-per-year.
  return fetchCsv(`${RELEASES_BASE}/schedules/games.csv`).then((rows) =>
    rows.filter((r) => Number(r.season) === season),
  );
}

export function fetchWeeklyStats(season: number): Promise<CsvRow[]> {
  return fetchCsv(`${RELEASES_BASE}/stats_player/stats_player_week_${season}.csv`);
}

export function fetchSeasonStats(season: number): Promise<CsvRow[]> {
  return fetchCsv(`${RELEASES_BASE}/stats_player/stats_player_reg_${season}.csv`);
}
