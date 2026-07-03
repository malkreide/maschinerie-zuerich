// Laufzeit-Schutz für datengetriebene Links (Defense-in-Depth zur CI).
//
// URLs aus den Prozess-Daten (source_url, references, legal_basis, sources)
// und aus extern geparsten Quellen (RIS-XML) landen direkt in href-Attributen.
// Die CI prüft zwar strukturell auf https (scripts/check-links.mjs), aber
// eingehende tessera-PRs sind Teil des Bedrohungsmodells (CLAUDE.md) — ein
// `javascript:`-Schema, das am Review vorbeirutscht, wäre klickbarer XSS.
// React blockiert solche hrefs nicht (nur Dev-Warnung).
//
// safeUrl() ist deshalb die einzige Stelle, an der eine URL aus Daten in ein
// href darf: erlaubt sind http(s) und same-origin-relative Pfade; alles
// andere → undefined, und der Aufrufer rendert das Label als blossen Text.

const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

export function safeUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  // Relative Pfade (same-origin) sind ok — aber kein protokoll-relatives
  // '//host', das auf eine fremde Origin zeigen würde.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  return SAFE_PROTOCOLS.has(parsed.protocol) ? trimmed : undefined;
}
