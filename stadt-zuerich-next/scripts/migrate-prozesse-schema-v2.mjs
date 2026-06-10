#!/usr/bin/env node
// Migration: OpenGov-Process-Schema Generation 1 (0.x) → Generation 2 (2.0.0).
//
// Kern der Generation 2 ist die Kardinalregel (docs/process-data-contract.md
// im Repo-Root): bindende Werte (Fristen, Gebühren) erscheinen NUR als
// Referenz (Label + Deep-Link + wörtliches Zitat), nie als Klartext-Zahl.
//
//   - 'dauer_est' entfällt ersatzlos — geschätzte Dauern waren unbelegte
//     Behauptungen.
//   - 'kosten_chf' wird zu einer Referenz mit status 'unverifiziert'
//     (zitat leer, bis jemand die Belegstelle wörtlich von der Quelle
//     übernimmt). Die Zahlen selbst werden NICHT übernommen — sie waren
//     Richtwerte ohne wörtlichen Beleg.
//   - 'reife.wirkungKpi'-Werte mit Zahl+Einheit werden entfernt (der
//     Kardinalregel-Lint im Validator würde sie ablehnen).
//   - Neue Pflichtfelder 'lebenslage_ref' und 'zielgruppe' kommen aus den
//     Tabellen unten (Stand: data/zh/lebenslagen.json).
//
// Die inhaltliche Kuratierung der Referenzen (sprechende Labels, Zuordnung
// zu Schritten, zusätzliche Fristen-Referenzen) passiert von Hand NACH der
// Migration — dieses Skript macht nur den mechanischen Teil.
//
// Usage:
//   node scripts/migrate-prozesse-schema-v2.mjs          # Dry-Run
//   node scripts/migrate-prozesse-schema-v2.mjs --write  # tatsächlich schreiben
//   node scripts/migrate-prozesse-schema-v2.mjs -w -v    # schreiben + verbose

import { runMigration } from './_migrate-lib.mjs';

// Prozess-ID → Lebenslage-ID (Rückrichtung der bestehenden Verknüpfung
// lebenslage.prozesse[] in data/zh/lebenslagen.json).
const LEBENSLAGE_BY_PROZESS = {
  'hund-anmelden': 'hund-anmelden',
  'umzug-melden': 'umzug-melden',
  'kita-platz': 'kita-platz',
  'sozialhilfe-erstantrag': 'sozialhilfe',
  'baubewilligung-ordentlich': 'baugesuch',
  'anwohnerparkkarte': 'parkplatz',
  'fundsache-verlust': 'fundsache',
  'veranstaltung-bewilligung': 'veranstaltung',
};

// Primäre Zielgruppe nach eCH-0073. Alle heutigen Verfahren richten sich
// primär an Privatpersonen; Verfahren mit gemischtem Publikum (Baugesuch,
// Veranstaltungen) bleiben bei 'bevoelkerung' als primärer Zielgruppe.
const ZIELGRUPPE_BY_PROZESS = {};
const DEFAULT_ZIELGRUPPE = 'bevoelkerung';

// Kardinalregel-Heuristik für KPI-Werte: Zahl + bindende Einheit.
// Muss zur Lint-Regel in validate-prozesse.mjs passen.
const BINDING_VALUE_RE =
  /(\d[\d'’.,\s–-]*\s*(CHF|Fr\.|Franken|%|Tag(e|en)?|Woche(n)?|Monat(e|en)?|Jahr(e|en)?|Arbeitstag(e|en)?|Kalendertag(e|en)?)\b)|((CHF|Fr\.)\s*\d)|(\d\s*%)/i;

function transform(p) {
  const lebenslageRef = LEBENSLAGE_BY_PROZESS[p.id];
  if (!lebenslageRef) {
    throw new Error(`no lebenslage_ref mapping for prozess '${p.id}' — extend LEBENSLAGE_BY_PROZESS`);
  }

  // Neue Pflichtfelder. Reihenfolge im Objekt ist für JSON egal — der
  // Serializer schreibt Insertion-Order, neue Felder landen am Ende.
  p.lebenslage_ref = lebenslageRef;
  p.zielgruppe = ZIELGRUPPE_BY_PROZESS[p.id] ?? DEFAULT_ZIELGRUPPE;

  const quellenById = new Map((p.quellen ?? []).map((q) => [q.id, q]));
  p.referenzen = p.referenzen ?? [];

  for (const s of p.schritte ?? []) {
    delete s.dauer_est;

    if (s.kosten_chf) {
      const quelle = s.quelle ? quellenById.get(s.quelle) : (p.quellen ?? [])[0];
      const anmerkung = s.kosten_chf.anmerkung;
      const refId = `r-kosten-${s.id}`;
      p.referenzen.push({
        id: refId,
        // Anmerkungstexte der Generation 1 enthalten teils Zahlen — die
        // werden bei der Hand-Kuratierung durch zahlenfreie Labels ersetzt.
        label: anmerkung ?? { de: 'Kosten' },
        url: quelle?.url ?? '',
        zitat: '',
        status: 'unverifiziert',
        abgerufen: quelle?.abgerufen ?? new Date().toISOString().slice(0, 10),
      });
      s.referenzen = [...(s.referenzen ?? []), refId];
      delete s.kosten_chf;
    }
  }

  if (p.referenzen.length === 0) delete p.referenzen;

  // KPI-Werte mit bindender Zahl+Einheit fliegen raus (Kardinalregel).
  if (p.reife?.wirkungKpi) {
    p.reife.wirkungKpi = p.reife.wirkungKpi.filter(
      (k) => !k.wert || !BINDING_VALUE_RE.test(k.wert),
    );
    if (p.reife.wirkungKpi.length === 0) delete p.reife.wirkungKpi;
  }

  return p;
}

runMigration({
  title: 'OpenGov-Process-Schema Generation 1 (0.x) → Generation 2 (Kardinalregel: Werte nur als Referenz)',
  fromVersion: '0.',
  toVersion:   '2.0.0',
  transform,
});
