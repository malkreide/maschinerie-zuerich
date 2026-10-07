// Konsistenz-Lint für Leichte Sprache: erkennt ls-Labels von References, die
// ein anderes Thema tragen als ihr deutsches Label.
//
// Hintergrund: ls-Texte wurden wiederholt ohne Abgleich gegen das Element
// eingefüllt (fundsache: References 1–5 gegeneinander verschoben; parkplatz
// Ref 2: Rückerstattungs-Text am Label «Gültigkeitsdauer»; umzug-melden
// Ref 1: «Frist …» am Label «Allfällige Gebühren …»). de/en/fr/it stimmten
// jeweils — nur ls war vertauscht, und kein Check prüfte die inhaltliche
// Passung.
//
// Eigenes Modul (statt inline in validate-prozesse.mjs), damit die Wortlisten
// unit-testbar sind (tests/ls-consistency.test.mjs).
//
// Regel: Sagt eine der beiden Sprachen ausdrücklich KOSTEN oder FRIST an,
// muss die andere dasselbe Thema erkennen lassen. Sonst WARNUNG (kein Fehler:
// es ist eine Wortlisten-Heuristik, das Urteil bleibt beim Menschen).
// Geprüft werden nur References — dort hängt das Label an einem bindenden
// Wert und seinem Deep-Link, eine Vertauschung schickt Leser:innen zum
// falschen Beleg.
//
// Zwei Wortlisten pro Thema und Sprache, bewusst asymmetrisch:
//   - `signal`  (Auslöser): eng — nur Wörter, die das Thema eindeutig ansagen
//     («Gebühr», «kostet», «Frist», «wie lange»).
//   - `deckung` (Gegenprobe): weit — alles, was in der anderen Sprache
//     dasselbe Thema trägt («Tarif», «Verrechnung», «Gültigkeitsdauer»,
//     «wie schnell»). Weit, weil eine zu enge Gegenprobe Fehlalarme erzeugt.
//
// Bewusste Heuristik-Grenzen:
//   - Nur zwei Themen. Eine Vertauschung innerhalb desselben Themas (zwei
//     Fristen untereinander) oder ganz ohne Themenwort bleibt unentdeckt.
//   - Nur References. Auf steps[].label lieferte dieselbe Regel Fehlalarme
//     an korrekten Texten («Lebensunterhalt nicht gedeckt» ↔ «Ihr Geld
//     reicht nicht zum Leben»); Dauer-Warnungen an richtigen Daten würden
//     den Lint entwerten.
//   - Der Lint ersetzt den Abgleich durch einen Menschen nicht; er fängt nur
//     die gröbste Fehlerklasse ab.

const THEMEN = [
  {
    name: 'Kosten',
    signal: {
      de: /geb(?:ü|ue)hr|kosten|preis|tarif|zuschlag/iu,
      ls: /geb(?:ü|ue)hr|kost|preis|geld|zuschlag|rechnung|gratis|(?<![a-zäöü])(?:be)?zahl(?:en|e|t|st)(?![a-zäöü])/iu,
    },
    deckung: {
      de: /geb(?:ü|ue)hr|kost|preis|geld|zuschlag|rechnung|gratis|zahl|tarif|steuer|beitrag|subvention|gutschein|erstatt|verrechn|finderlohn|zins|entgelt/iu,
      ls: /geb(?:ü|ue)hr|kost|preis|geld|zuschlag|rechnung|gratis|zahl|steuer|beitrag|gutschein|teuer/iu,
    },
  },
  {
    name: 'Frist',
    signal: {
      de: /frist/iu,
      ls: /frist|wie lange|wie viel zeit|bis wann|wie schnell|fr(?:ü|ue)hestens|sp(?:ä|ae)testens/iu,
    },
    deckung: {
      de: /frist|dauer|g(?:ü|ue)ltig|vorlauf|zeit|fr(?:ü|ue)h|sp(?:ä|ae)t|innert|innerhalb|termin/iu,
      ls: /frist|wie lange|zeit|wann|schnell|fr(?:ü|ue)h|sp(?:ä|ae)t|dauer|g(?:ü|ue)ltig/iu,
    },
  },
];

/**
 * Vergleicht ein deutsches Label mit seinem ls-Pendant.
 * Liefert je Abweichung `{ thema, nurIn }` — `nurIn` ist die Sprache, die das
 * Thema ansagt, während die andere es nicht trägt. Leeres Array = unauffällig
 * (auch wenn de oder ls fehlt: fehlende Übersetzung ist kein Befund).
 */
export function findLsThemeDrift(de, ls) {
  if (typeof de !== 'string' || de === '' || typeof ls !== 'string' || ls === '') return [];
  const drift = [];
  for (const t of THEMEN) {
    if (t.signal.ls.test(ls) && !t.deckung.de.test(de)) drift.push({ thema: t.name, nurIn: 'ls' });
    if (t.signal.de.test(de) && !t.deckung.ls.test(ls)) drift.push({ thema: t.name, nurIn: 'de' });
  }
  return drift;
}

/** Warnungen für die Reference-Labels eines Prozesses — höchstens eine je Reference. */
export function lintLsConsistency(prozess) {
  const warnings = [];
  for (const r of prozess.references ?? []) {
    const { de, ls } = r.label ?? {};
    const drift = findLsThemeDrift(de, ls);
    if (drift.length === 0) continue;
    const was = drift
      .map(({ thema, nurIn }) => `${nurIn} nennt «${thema}», ${nurIn === 'ls' ? 'de' : 'ls'} nicht`)
      .join('; ');
    warnings.push(
      `Leichte Sprache: reference ${r.reference_id}.label — ${was} ` +
      `(de: "${de.slice(0, 60)}", ls: "${ls.slice(0, 60)}"). Passt der ls-Text zu diesem Element?`,
    );
  }
  return warnings;
}
