// Seitentext einer Quell-URL für das Referenzen-Gate und den Zitat-Drift-
// Bericht: HTML über html-text.mjs, PDF über unpdf (reines JavaScript, kein
// pdftotext nötig — das fehlt auf den CI-Runnern).
//
// Warum PDF: Manche amtlichen Quellen liefern ihren Text nur per JavaScript
// (z. B. ZHlex auf zh.ch), stellen aber dieselbe Fassung als PDF bereit. Das
// PDF ist dann die prüfbare Originalquelle.

import { htmlToText } from './html-text.mjs';

// Wörter, vor denen ein Bindestrich am Zeilenende ein Ergänzungsstrich ist
// («Einkommens- und Vermögenssteuern») und keine Silbentrennung.
const KONJUNKTION = /^(?:und|oder|bzw|sowie|bis|noch|als|wie|resp|respektive)\b/;

/**
 * Hebt die Silbentrennung am Zeilenende auf, wie sie im gedruckten Gesetz
 * steht: «Steuer-\npflichtige» → «Steuerpflichtige». Nur wenn beidseits ein
 * Kleinbuchstabe steht und danach keine Konjunktion folgt; alles andere
 * (Ergänzungsstrich, «A-Post», Zahlen) bleibt unverändert.
 */
export function silbentrennungAufheben(text) {
  return text.replace(/(\p{Ll})-[ \t]*\n[ \t]*(?=\p{Ll})/gu, (m, vor, offset, s) => {
    const rest = s.slice(offset + m.length);
    return KONJUNKTION.test(rest) ? m : vor;
  });
}

/** Text eines PDF (Uint8Array), Seiten durch Zeilenumbruch getrennt. */
export async function pdfToText(data) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return silbentrennungAufheben(text.join('\n'))
    .split('\n')
    .map((l) => l.replace(/[ \t\f\v ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export const isPdfUrl = (url) => /\.pdf(?:$|[?#])/i.test(url);

/** Text einer fetch()-Antwort — PDF nach Content-Type, sonst HTML. */
export async function responseToText(res) {
  if (/application\/pdf/i.test(res.headers.get('content-type') ?? '')) {
    return pdfToText(new Uint8Array(await res.arrayBuffer()));
  }
  return htmlToText(await res.text());
}
