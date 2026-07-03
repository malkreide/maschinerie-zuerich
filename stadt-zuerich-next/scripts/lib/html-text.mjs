// HTML→Text-Helfer, geteilt zwischen extract-quotes.mjs (Kandidaten-Suche)
// und check-refs-gate.mjs (CI-Gate). Genug für SSR-Seiten, deren Inhalt im
// Markup steht — kein Browser nötig.

const NAMED_ENT = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '',
  laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', deg: '°',
  euro: '€', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', sbquo: '‚',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', agrave: 'à', acirc: 'â', ccedil: 'ç', ugrave: 'ù',
};

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in NAMED_ENT ? NAMED_ENT[n] : (NAMED_ENT[n.toLowerCase()] ?? m)));
}

// Konvertiert HTML zu lesbarem Text. Block-Elemente werden zu Zeilen-
// umbrüchen, damit Sätze nicht über Layoutgrenzen hinweg verkleben.
export function htmlToText(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|section|article|header|footer|main|nav|dd|dt)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t\f\v ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function normWs(s) {
  return s.replace(/\s+/g, ' ').trim();
}
