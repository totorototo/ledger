// The runner's own notes, read from data/plan.md (template: scripts/plan.example.md): races,
// planned blocks and health, the context Garmin doesn't hold. A line is
//
//   - 2026-12-05 Saintélyon 81 km, A race
//   - 2026-11-16..2026-11-22 recovery week
//
// under a "## Races", "## Planned" or "## Health" heading. Pure: the export reads the file.

const HEADINGS = { races: "race", planned: "planned", health: "health" };
const LINE = /^-\s+(\d{4}-\d{2}-\d{2})(?:\s*\.\.\s*(\d{4}-\d{2}-\d{2}))?\s+(.+)$/;

// Every dated line as { kind, from, to, text }, by date, and the bullet lines it couldn't
// read (no date, or no known heading above them).
// why say what it skipped: a note silently dropped would read as no note.
export function parsePlan(text) {
  const entries = [];
  const ignored = [];
  let kind = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^#+\s+(\w+)/);
    if (heading) {
      kind = HEADINGS[heading[1].toLowerCase()] ?? null;
      continue;
    }
    if (!line.startsWith("-")) continue;
    const match = line.match(LINE);
    if (!match || !kind) {
      ignored.push(line);
      continue;
    }
    const [, from, to = from, rest] = match;
    entries.push({ kind, from, to: to < from ? from : to, text: rest.trim() });
  }
  entries.sort((a, b) => a.from.localeCompare(b.from));
  return { entries, ignored };
}
