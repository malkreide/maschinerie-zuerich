// Kardinalregel-Lint: Erkennung bindender Werte (Fristen, Gebühren, Quoten)
// in gerenderten Texten. Bindende Werte gehören ausschliesslich in das
// source_quote einer Reference («Link, don't assert»).
//
// Eigenes Modul (statt inline in validate-prozesse.mjs), damit die Muster
// unit-testbar sind (tests/binding-values.test.mjs) und Erweiterungen nicht
// unbemerkt Erkennungslücken reissen.
//
// Drei Muster-Familien:
//   1. Ziffern + Einheit («30 Tage», «CHF 50», «2.5 %») — der klassische Fall.
//   2. Ausgeschriebene Zahlwörter + Einheit («innert zehn Tagen», «fünf
//      Jahre», «ein Jahr gültig») — vorher ein blinder Fleck: dieselbe
//      bindende Aussage entkam dem Lint, sobald sie ausgeschrieben war.
//   3. Schweizer Preisnotation mit Gedankenstrich («500.–», «50.-») ohne
//      Währungswort davor.
//
// Bewusste Heuristik-Grenzen: Zahlwort und Einheit müssen direkt benachbart
// sein («zehn Tagen», nicht «zehn vollen Tagen») — das hält die
// False-Positive-Rate niedrig; der menschliche Review bleibt zuständig für
// den Rest.

const DIGIT_RE =
  /(\d[\d'’.,\s–-]*\s*(CHF|Fr\.|Franken|%|Prozent|Tag(e|en)?|Woche(n)?|Monat(e|en)?|Jahr(e|en)?|Arbeitstag(e|en)?|Kalendertag(e|en)?)\b)|((CHF|Fr\.)\s*\d)|(\d\s*%)/i;

const ZAHLWORT =
  '(?:ein|eine|einem|einen|einer|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|' +
  'elf|zwölf|dreizehn|vierzehn|fünfzehn|sechzehn|siebzehn|achtzehn|neunzehn|' +
  'zwanzig|dreissig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend)';
const EINHEIT =
  '(?:Arbeitstag(?:e|en)?|Kalendertag(?:e|en)?|Tag(?:e|en)?|Woche(?:n)?|' +
  'Monat(?:e|en)?|Jahr(?:e|en)?|Franken|Prozent)';
const ZAHLWORT_RE = new RegExp(`\\b${ZAHLWORT}\\s+${EINHEIT}\\b`, 'iu');

// «500.–» / «500.—» / «500.-» (Währungswort optional — auch nackt bindend).
const PREIS_STRICH_RE = /\d+\.(?:–|—|-)(?!\w)/;

/** Liefert das erste gefundene bindende Fragment oder null. */
export function findBindingValue(text) {
  if (typeof text !== 'string' || text === '') return null;
  for (const re of [DIGIT_RE, ZAHLWORT_RE, PREIS_STRICH_RE]) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}
