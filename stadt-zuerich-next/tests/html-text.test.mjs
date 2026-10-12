// Unit-Tests für den HTML→Text-Extraktor (scripts/lib/html-text.mjs), den
// das Referenzen-Gate und der Zitat-Drift-Bericht teilen.
//
// Die Fixtures sind das rohe Markup von stadt-zuerich.ch (Stand 11.10.2026):
// <stzh-datatable> trägt die Tabelle als JSON in den Attributen `columns` und
// `rows`, mit «&#34;» und «&lt;» escaped, aber rohem «>». Vorher zerschnitt
// der Tag-Stripper das Attribut am ersten «>», und JSON-Reste landeten im
// Text — abfall Ref. 1 und 2 meldete der Drift-Bericht darum fälschlich.
//
// Lauf: node --experimental-strip-types --test tests/html-text.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, normWs } from '../scripts/lib/html-text.mjs';

// zueri-sack.html, gekürzt auf drei Zeilen (zwei Zellformate wie im Original)
const ZUERI_SACK =
  '<stzh-heading level="2">Gebühren</stzh-heading>\n' +
  '<stzh-datatable columns="[{&#34;key&#34;:&#34;RHNvJ&#34;,&#34;text&#34;:&#34;Gebührenanteil&#34;},' +
  '{&#34;key&#34;:&#34;HHqGO&#34;,&#34;text&#34;:&#34;Grösse&#34;}]" ' +
  'rows="[[{&#34;value&#34;:&#34;Fr. 0.37 &#34;},{&#34;value&#34;:&#34;pro 10-Liter-Sack&#34;}],' +
  '[{&#34;value&#34;:&#34;&lt;p>Fr. 0.63&lt;/p>&#34;,&#34;style&#34;:{&#34;width&#34;:&#34;153&#34;},&#34;valign&#34;:&#34;auto&#34;},' +
  '{&#34;value&#34;:&#34;&lt;p>pro 17-Liter-Sack&lt;/p>&#34;,&#34;style&#34;:{&#34;width&#34;:&#34;153&#34;},&#34;valign&#34;:&#34;auto&#34;}],' +
  '[{&#34;value&#34;:&#34;&lt;p>Fr. 4.07&lt;/p>&#34;,&#34;style&#34;:{&#34;width&#34;:&#34;153&#34;},&#34;valign&#34;:&#34;auto&#34;},' +
  '{&#34;value&#34;:&#34;&lt;p>pro 110-Liter-Sack&lt;/p>&#34;,&#34;style&#34;:{&#34;width&#34;:&#34;153&#34;},&#34;valign&#34;:&#34;auto&#34;}]]" hide-search>\n' +
  '    </stzh-datatable>\n' +
  '<stzh-richtext><p>Hinweis: Dieser Gebührenanteil am Kaufpreis wird nach dem Verkauf an die Stadt Zürich überwiesen.</p></stzh-richtext>';

// abfuhr-sperrgut-metall-elektro-grubengut.html, wörtlich (Preistabelle)
const SPERRGUT =
  '<stzh-datatable columns="[{&#34;key&#34;:&#34;hIpLg&#34;,&#34;text&#34;:&#34;Abfuhr&#34;},' +
  '{&#34;key&#34;:&#34;QHYhD&#34;,&#34;text&#34;:&#34;Details&#34;},{&#34;key&#34;:&#34;niAJR&#34;,&#34;text&#34;:&#34;Preis &#34;}]" ' +
  'rows="[[{&#34;value&#34;:&#34;Ab Strassenrand&#34;},{&#34;value&#34;:&#34;Anfahrt, 15 Min. aufladen, entsorgen, pauschal&#34;},' +
  '{&#34;value&#34;:&#34;Fr. 86.50&#34;}],[{&#34;value&#34;:&#34; &#34;},' +
  '{&#34;value&#34;:&#34;pro weitere 15 Min. (bis max. 60 Min.)&#34;},{&#34;value&#34;:&#34;Fr. 86.50&#34;}]]" hide-search>\n' +
  '</stzh-datatable>';

test('stzh-datatable: Kopfzeile und Zeilen als Text, ohne JSON-Reste', () => {
  const text = htmlToText(ZUERI_SACK);
  assert.equal(
    text,
    'Gebühren\n' +
      'Gebührenanteil Grösse\n' +
      'Fr. 0.37 pro 10-Liter-Sack\n' +
      'Fr. 0.63 pro 17-Liter-Sack\n' +
      'Fr. 4.07 pro 110-Liter-Sack\n' +
      'Hinweis: Dieser Gebührenanteil am Kaufpreis wird nach dem Verkauf an die Stadt Zürich überwiesen.',
  );
  assert.doesNotMatch(text, /value|style|valign|&#34;|<\/?p/);
});

test('stzh-datatable: Zitat über mehrere Zeilen passt wörtlich (abfall Ref. 1 und 2)', () => {
  assert.ok(
    normWs(htmlToText(ZUERI_SACK)).includes('Fr. 0.37 pro 10-Liter-Sack Fr. 0.63 pro 17-Liter-Sack Fr. 4.07 pro 110-Liter-Sack'),
  );
  assert.ok(
    normWs(htmlToText(SPERRGUT)).includes(
      'Ab Strassenrand Anfahrt, 15 Min. aufladen, entsorgen, pauschal Fr. 86.50 pro weitere 15 Min. (bis max. 60 Min.) Fr. 86.50',
    ),
  );
});

test('stzh-datatable: hide-column-headings blendet die Kopfzeile aus, Zell-HTML wird zu Text', () => {
  const html =
    '<stzh-datatable columns="[{&#34;key&#34;:&#34;a&#34;,&#34;text&#34;:&#34;&lt;strong>Kinder&lt;/strong>&#34;}]" ' +
    'rows="[[{&#34;value&#34;:&#34;&lt;stzh-link href=\\&#34;/x.html\\&#34;>Sperrgut&lt;/stzh-link>&#34;}],' +
    '[{&#34;value&#34;:&#34;Kabel&lt;br>Einzelnes Gerät max. 40 kg schwer&#34;}]]" hide-column-headings hide-search></stzh-datatable>';
  assert.equal(htmlToText(html), 'Sperrgut\nKabel Einzelnes Gerät max. 40 kg schwer');
});

test('stzh-datatable mit kaputtem JSON: Tag verschwindet, Folgetext bleibt', () => {
  const html = '<stzh-datatable rows="[[{&#34;value&#34;:>" hide-search></stzh-datatable><p>Danach</p>';
  assert.equal(htmlToText(html), 'Danach');
});

test('andere stzh-Komponenten mit «>» im Attribut hinterlassen keinen Attribut-Rest', () => {
  const html = '<stzh-contact heading="A > B" numbers="[]"><stzh-text>Montag bis Freitag</stzh-text></stzh-contact>';
  assert.equal(htmlToText(html), 'Montag bis Freitag');
});

test('gewöhnliches HTML unverändert: Blöcke zu Zeilen, Entities dekodiert', () => {
  assert.equal(htmlToText('<p>Fr.&nbsp;86.50</p><div>a<br>b &laquo;c&raquo;</div>'), 'Fr. 86.50\na\nb «c»');
});
