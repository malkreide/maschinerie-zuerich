# Strategiebezug der Bewertungs-Indikatoren

**Status:** Begleitdokument zum Bewertungs-Framework (`lib/bewertung.ts`,
`bewertung.indikatoren[]`). Es belegt **warum** jeder Indikator ein Indikator
ist — durch Rückbindung an die übergeordneten Digitalisierungs- und
Nutzendenorientierungs-Strategien von Bund und Stadt Zürich.

Die Strategien liefern **Zielrichtung und Legitimation**, nicht Messwerte:
keines der Dokumente enthält ein Reifegradmodell oder Pro-Prozess-KPIs. Das
deckt sich mit dem Framework-Prinzip: ein Indikator wird **berechnet**
(deterministisch aus dem Graphen) oder **belegt** (Zitat + Deep-Link) — die
Strategie ist die Belegquelle für die Rubrik, nicht für den Einzelwert.

> Cardinal Rule bleibt: Die Bewertung beschreibt strukturelle Eigenschaften
> (true/false), nie bindende Werte (Fristen/Gebühren).

## Quellen

| Tag | Dokument | Stelle/Datum |
|---|---|---|
| `dch2026` | Strategie «Digitale Schweiz 2026» (Bundesrat / Bundeskanzlei) | gültig ab 01.01.2026 |
| `digistrat` | Digitalisierungsstrategie der Stadt Zürich (OIZ, Beilage STRB 874/2024) | 20.03.2024 |
| `ds2040` | Strategien Zürich 2040 (Stadtrat Zürich) | April 2024 |
| `servicestd` | Service Standard, STRB 677/2025 «Stärkung der Nutzendenzentrierung» | 12.03.2025 |
| `smartcity` | Strategie «Smart City Zürich», Beilage STRB 998/2018 | 05.12.2018 |

Deep-Links (exakte Stelle) werden — wie bei References — von Hand verifiziert
nachgetragen; bis dahin belegt der Anker über Dokument-Tag + Seite + wörtliches
Zitat (gegen die im Repo abgelegten/öffentlichen Dokumente prüfbar).

## Verankerung — Achse DIGITALISIERUNG

| Indikator | Stärke | Anker (Zitat, Seite) |
|---|---|---|
| `online-antrag` | direkt | `ds2040` S. 31 / `digistrat` SZ 1: «Städtische Angebote und Leistungen stehen der Bevölkerung und den Unternehmen online zur Verfügung.» |
| `digital-abschliessbar` | direkt | `dch2026` S. 3: «Die Behörden bieten ihre Leistungen standardmässig digital (digital first), nutzerzentriert und barrierefrei an.» |
| `medienbruchfrei` | direkt | `digistrat` Schwerpunkt 4, S. 8: «Standards fördern die durchgängige Gestaltung von Prozessen und Datenflüssen.» |
| `once-only` *(neu vorgeschlagen)* | direkt | `digistrat` Stossrichtung I, S. 13: «Weiter wird den Nutzer*innen ermöglicht, dass sie dieselben Dateneingaben nicht mehrfach tätigen müssen.» |
| `eid-moeglich` *(Umdeutung von `eid-noetig`)* | direkt (Bund) | `dch2026` S. 3: «Die E-ID ist ein zentraler Baustein … sich mit der E-ID im Internet sicher ausweisen … Ihre Nutzung ist freiwillig.» |
| `online-bezahlung` | schwach | nur generisch «digital first» (`dch2026` S. 2) — kein spezifischer Stadt-Anker; als selbst gesetzter Indikator kennzeichnen |
| `statusverfolgung` | kein | in keiner Stadt-/Bundesstrategie genannt — selbst gesetzter Nutzwert-Indikator |

## Verankerung — Achse NUTZENDENORIENTIERUNG

Bevorzugte Referenz ist der **städtische Service Standard** (STRB 677/2025) —
das aktuellste, eigene Qualitätsmodell der Stadt (5 Grundsätze, 13 Kriterien).

| Indikator | Stärke | Anker (Zitat, Seite) |
|---|---|---|
| `barrierefreiheit` *(neu vorgeschlagen, WCAG 2.1 AA)* | direkt | `servicestd` S. 3: «Das Projektteam stellt sicher, dass öffentliche, digitale Lösung barrierefrei sind (nach WCAG 2.1 Stufe AA).» — einzige *messbare* Norm aller Dokumente |
| `leichte-sprache` | direkt | `servicestd` S. 3: «… verwendet in allen relevanten Teilen leicht verständliche Sprache ohne Fachjargon.» |
| `mehrsprachigkeit` | schwach | `ds2040` S. 27: «Der Zugang … ist barriere- und diskriminierungsfrei.» (Mehrsprachigkeit nicht wörtlich) |
| `voraussetzungen-genannt` | direkt | `ds2040` S. 27: «Sie pflegt transparente und lösungsorientierte Prozesse.» |
| `fristen-kosten-verlinkt` | direkt | `ds2040` S. 27 (dito) + Cardinal Rule «Link, don't assert» |
| `nicht-digitaler-alternativweg` *(neu vorgeschlagen)* | direkt | `ds2040` S. 31: «… stellt dabei die Nutzer*innen stets ins Zentrum und berücksichtigt zugleich diejenigen, die nicht digital affin sind.»; `smartcity` Vorwort: «… die digitale und analoge Welt so zu verbinden …» |

## Aggregat / Portfolio

`dch2026` misst den Stand über **Ist-Werte mit Stichjahr, ohne Zielwerte**
(z. B. «Zugang zu Online-Diensten — 83 % — 2024», S. 3). Ein Portfolio-Score
über alle modellierten Prozesse ist analog zu lesen: **Ist-Schnappschuss der
Modelldaten**, kein amtlicher Digitalisierungsgrad — entsprechend zu
beschriften.

## Ehrlichkeits-Hinweise

- `online-bezahlung`, `statusverfolgung`, `mehrsprachigkeit` haben schwache
  oder keine offiziellen Anker → im Code als «selbst gesetzt» kennzeichnen,
  nicht als Strategie-Zitat ausgeben.
- `barrierefreiheit` (WCAG), `eid`, `once-only` sind Real-World-Eigenschaften →
  ohne Beleg «unbekannt», nie geraten. WCAG-Konformität ist nicht aus dem JSON
  ableitbar (kein automatisches Audit).
