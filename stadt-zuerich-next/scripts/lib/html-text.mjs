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

// Öffnender Tag, dessen Attributwerte in "…" stehen und ein rohes «>»
// enthalten dürfen (die stzh-Web-Komponenten escapen in Attributen nur «"»
// und «<», nicht «>»).
const STZH_OPEN_TAG = /<(stzh-[a-z0-9-]+)\b((?:[^>"]|"[^"]*")*)>/gi;

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'i'));
  return m ? decodeEntities(m[1]) : null;
}

function jsonAttr(attrs, name) {
  const v = attr(attrs, name);
  if (v == null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

// Zellinhalt ist selbst HTML (z. B. «<p>Fr. 0.63</p>», «<stzh-link …>»).
const cellText = (v) => normWs(htmlToText(String(v ?? '')));

// <stzh-datatable> rendert seine Tabelle im Browser aus den JSON-Attributen
// `columns` und `rows`; im Markup steht kein Tabellentext. Hier wird daraus
// der Text, den ein Mensch sieht: Kopfzeile (ausser bei hide-column-headings),
// dann je Tabellenzeile eine Textzeile mit den Zellen in Spaltenreihenfolge.
function datatableText(attrs) {
  const lines = [];
  const cols = jsonAttr(attrs, 'columns');
  if (Array.isArray(cols) && !/(?:^|\s)hide-column-headings\b/i.test(attrs)) {
    lines.push(cols.map((c) => cellText(c?.text)).filter(Boolean).join(' '));
  }
  const rows = jsonAttr(attrs, 'rows');
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      lines.push(row.map((c) => cellText(c?.value)).filter(Boolean).join(' '));
    }
  }
  return `\n${lines.filter(Boolean).join('\n')}\n`;
}

// Inline-Auszeichnung (fett, Link, …) trennt im Browser keine Wörter:
// «kostet <strong>17 Franken</strong>.» liest sich «kostet 17 Franken.».
// Ersetzte man diese Tags durch ein Leerzeichen, entstünde «17 Franken .»,
// und ein wörtliches Zitat passte nicht mehr. Darum fallen sie ersatzlos weg;
// alle übrigen Tags trennen weiterhin mit einem Leerzeichen.
const INLINE_TAG =
  /<\/?(?:a|abbr|b|bdi|bdo|cite|code|data|del|dfn|em|font|i|ins|kbd|mark|q|s|samp|small|span|strong|sub|sup|time|u|var|wbr|stzh-link)\b(?:[^>"]|"[^"]*")*>/gi;

// Konvertiert HTML zu lesbarem Text. Block-Elemente werden zu Zeilen-
// umbrüchen, damit Sätze nicht über Layoutgrenzen hinweg verkleben.
export function htmlToText(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(INLINE_TAG, '')
    .replace(STZH_OPEN_TAG, (_, name, attrs) => (name.toLowerCase() === 'stzh-datatable' ? datatableText(attrs) : ' '))
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
