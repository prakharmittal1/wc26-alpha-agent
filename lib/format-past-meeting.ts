/** Turn RAG row text into a short, readable past meeting line. */
export function formatPastMeeting(content: string): string {
  const trimmed = content.trim().replace(/\.$/, "");
  const m =
    /^On\s+(\d{4}-\d{2}-\d{2})\s+in\s+(.+?)\s+at\s+([^:]+):\s*(.+?)\s+(\d+)-(\d+)\s+(.+)$/i.exec(
      trimmed,
    );
  if (!m) {
    return trimmed
      .replace(/^On\s+\d{4}-\d{2}-\d{2}\s+in\s+/i, "")
      .replace(/\s+at\s+[^:]+\s*:\s*/i, ": ");
  }

  const [, iso, tournament, venue, teamA, goalsA, goalsB, teamB] = m;
  const dateLabel = shortDate(iso);
  const place = venue.split(",")[0]?.trim() ?? venue.trim();
  const comp = shortCompetition(tournament);

  return `${teamA.trim()} ${goalsA}–${goalsB} ${teamB.trim()} · ${dateLabel} · ${place}${comp ? ` · ${comp}` : ""}`;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shortCompetition(tournament: string): string | null {
  const t = tournament.trim();
  if (/world cup qualification/i.test(t)) return "qualifying";
  if (/^fifa world cup$/i.test(t)) return null;
  if (/world cup/i.test(t)) return null;
  if (t.length > 28) return t.slice(0, 26) + "…";
  return t;
}
