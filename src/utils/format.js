// How the pages write distances, durations and dates. formatKm and formatDuration are
// Waymark's (via Regimen's format.js).

export function formatKm(meters) {
  if (!Number.isFinite(meters)) return "–";
  return `${(meters / 1000).toFixed(1)} km`;
}

// 5400 → "1h30"; 600 → "10 min"; negative durations keep their sign ("-1h30").
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "–";
  const sign = seconds < 0 ? "-" : "";
  const minutes = Math.round(Math.abs(seconds) / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${sign}${rest} min`;
  return `${sign}${hours}h${String(rest).padStart(2, "0")}`;
}

// A year's totals, grouped: 1234567 m → "1,235 km"; 45210.6 m → "45,211 m D+".
export function formatKmTotal(meters) {
  if (!Number.isFinite(meters)) return "–";
  return `${Math.round(meters / 1000).toLocaleString("en-US")} km`;
}

// A month's or a year's distance: a decimal while it matters, grouped once it doesn't.
// 29_140 → "29.1 km"; 1_260_000 → "1,260 km".
export function formatDistance(meters) {
  return meters >= 100_000 ? formatKmTotal(meters) : formatKm(meters);
}

export function formatGainTotal(meters) {
  if (!Number.isFinite(meters)) return "–";
  return `${Math.round(meters).toLocaleString("en-US")} m D+`;
}

// "trail_running" → "Trail running".
export function formatTypeKey(key) {
  if (!key) return "Activity";
  const words = key.replaceAll("_", " ");
  return words[0].toUpperCase() + words.slice(1);
}
