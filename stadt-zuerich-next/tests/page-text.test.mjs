// Unit-Tests für den PDF-/HTML-Seitentext (scripts/lib/page-text.mjs), den
// das Referenzen-Gate und der Zitat-Drift-Bericht teilen.
//
// Anlass: steuern Ref. 2 belegt § 140 Abs. 1 StG ZH. ZHlex auf zh.ch lädt
// den Gesetzestext per JavaScript; prüfbar ist nur die PDF-Fassung. Im PDF
// trennt der Satz am Zeilenende («der Steuer-\npflichtige»), das wörtliche
// Zitat passt erst nach Aufheben der Silbentrennung.
//
// Lauf: node --experimental-strip-types --test tests/page-text.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normWs } from '../scripts/lib/html-text.mjs';
import { isPdfUrl, pdfToText, responseToText, silbentrennungAufheben } from '../scripts/lib/page-text.mjs';

const ZITAT =
  'Gegen den Einschätzungsentscheid können der Steuerpflichtige und die Gemeinde innert 30 Tagen nach ' +
  'Zustellung beim kantonalen Steueramt schriftlich Einsprache erheben.';

// Rohtext aus 631.1_8.6.97_132.pdf (unpdf, Stand 12.10.2026), wörtlich.
const ROH_132 =
  'aufwand des Steuerpflichtigen berücksichtigen.\n' +
  'III. Einsprache § 140. 1 Gegen den Einschätzungsentscheid können der Steuer-\n' +
  'pflichtige und die Gemeinde innert 30 Tagen nach Zustellung beim\n' +
  'kantonalen Steueramt schriftlich Einsprache erheben.\n' +
  '1. Vorbereitung\n1. Frist\nund Voraus-\nsetzungen';

test('Silbentrennung am Zeilenende wird aufgehoben (§ 140 StG, Fassung 132)', () => {
  const text = silbentrennungAufheben(ROH_132);
  assert.ok(normWs(text).includes(ZITAT));
  assert.match(text, /Voraussetzungen/);
  assert.ok(!normWs(ROH_132).includes(ZITAT), 'ohne Aufheben passt das Zitat nicht');
});

test('Ergänzungsstrich und echte Bindestriche bleiben stehen', () => {
  assert.equal(silbentrennungAufheben('Einkommens-\nund Vermögenssteuern'), 'Einkommens-\nund Vermögenssteuern');
  assert.equal(silbentrennungAufheben('Gewinn-\noder Kapitalsteuer'), 'Gewinn-\noder Kapitalsteuer');
  assert.equal(silbentrennungAufheben('per A-\nPost'), 'per A-\nPost');
  assert.equal(silbentrennungAufheben('§ 140-\n141'), '§ 140-\n141');
  assert.equal(silbentrennungAufheben('Lebens-\naufwand'), 'Lebensaufwand');
});

// Kleinstes gültiges PDF mit einer Textzeile je Eintrag (Helvetica,
// WinAnsiEncoding; Zeichen über ASCII als Oktal-Escape).
function minimalPdf(lines) {
  const esc = (t) =>
    [...t]
      .map((ch) => {
        const c = ch.charCodeAt(0);
        if ('()\\'.includes(ch)) return `\\${ch}`;
        return c > 126 ? `\\${c.toString(8).padStart(3, '0')}` : ch;
      })
      .join('');
  const content = `BT /F1 11 Tf 14 TL 72 760 Td ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

const PDF_ZEILEN = [
  'III. Einsprache',
  '§ 140. 1 Gegen den Einschätzungsentscheid können der Steuer-',
  'pflichtige und die Gemeinde innert 30 Tagen nach Zustellung beim',
  'kantonalen Steueramt schriftlich Einsprache erheben.',
];

test('pdfToText: Zitat aus einem PDF mit Zeilentrennung passt wörtlich', async () => {
  const text = await pdfToText(minimalPdf(PDF_ZEILEN));
  assert.ok(normWs(text).includes(ZITAT), text);
});

test('responseToText unterscheidet PDF und HTML nach Content-Type', async () => {
  const pdf = new Response(minimalPdf(PDF_ZEILEN), { headers: { 'content-type': 'application/pdf' } });
  assert.ok(normWs(await responseToText(pdf)).includes(ZITAT));
  const html = new Response('<p>Ein Standard-Auszug kostet <strong>17 Franken</strong>.</p>', {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
  assert.equal(await responseToText(html), 'Ein Standard-Auszug kostet 17 Franken.');
});

test('isPdfUrl erkennt die direkte ZHlex-PDF-URL, nicht aber die HTML-Seite', () => {
  assert.ok(isPdfUrl('https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/A1B7/$File/631.1_8.6.97_132.pdf'));
  // fedlex mit Seitenanker (heiraten Ref. 1): der Anker zeigt im Browser die Seite des Artikels
  assert.ok(isPdfUrl('https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/24/233_245_233/20260701/de/pdf-a/fedlex-data-admin-ch-eli-cc-24-233_245_233-20260701-de-pdf-a-1.pdf#page=39'));
  assert.ok(!isPdfUrl('https://www.zh.ch/de/politik-staat/gesetze-beschluesse/gesetzessammlung/zhlex-ls/erlass-631_1-1997_06_08-1999_01_01-132.html'));
});
