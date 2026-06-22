# Maschinerie der Stadt Zürich

[![CI](https://github.com/malkreide/maschinerie-zuerich/actions/workflows/ci.yml/badge.svg)](https://github.com/malkreide/maschinerie-zuerich/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Data: CC-BY 4.0](https://img.shields.io/badge/Data-CC--BY%204.0-green.svg)](https://data.stadt-zuerich.ch/terms-of-use)

Interaktive, barrierefreie Visualisierung der Stadtverwaltung Zürich —
Departemente, Dienstabteilungen, verselbständigte Betriebe und Beteiligungen,
mit Budget und Stellenwerten aus öffentlichen Quellen.

## Strategischer Kontext

Das Projekt ist bottom-up aus einer konkreten Frage entstanden («Wie ist
diese Stadt eigentlich organisiert — und wohin geht mein Steuerfranken?»),
nicht top-down aus einem Strategiepapier. Trotzdem zahlt es direkt auf
übergeordnete Strategien von Stadt und Bund ein:

| Strategie | Beitrag dieses Projekts |
|---|---|
| [Strategien Zürich 2040](https://www.stadt-zuerich.ch/de/politik-und-verwaltung/politik-und-recht/strategie-politikfelder/zuerich-2040.html) | Macht im Handlungsfeld «Leistungsfähige Stadt» die Verwaltung als Ganzes sichtbar und verständlich — Transparenz über Strukturen, Budgets und Stellen als Grundlage für demokratische Teilhabe. |
| [Digitalisierungsstrategie der Stadt Zürich (2024)](https://www.stadt-zuerich.ch/content/dam/web/de/politik-verwaltung/stadtverwaltung/fd/digitalisierungsstrategie.pdf) | Liefert einen nutzerzentrierten digitalen Service: die Lebenslagen-Suche übersetzt Verwaltungsstruktur in Alltagssprache («Hund anmelden» → Steueramt), barrierefrei und in fünf Sprachen inkl. Leichter Sprache. |
| [Smart City Strategie Zürich](https://www.stadt-zuerich.ch/de/politik-und-verwaltung/politik-und-recht/strategie-politikfelder/smart-city.html) | Zeigt als leichtgewichtiges Pilotprojekt, wie bestehende offene Daten ohne neue Infrastruktur zu einem nutzbaren Service kombiniert werden können. |
| [Strategie Digitale Schweiz 2026](https://www.admin.ch/en/newnsb/d6evGIoTYTmY4VMGk0-v0) | Demonstriert den Mehrwert von Open Government Data durch konkrete Nachnutzung — mit einem Modell, das bewusst auf andere Schweizer Städte übertragbar ist. |

Diese Verweise sind Kontext, nicht Autorität: Das Repository ist ein
privates Open-Source-Projekt ohne offiziellen Auftrag der Stadt Zürich.

## Zwei Varianten

Das Repo enthält zwei eigenständige Implementationen der gleichen Idee:

| Verzeichnis | Stack | Zweck |
|-------------|-------|-------|
| [`stadt-zuerich-mog/`](stadt-zuerich-mog/) | Single-HTML + Vanilla-JS + Cytoscape + D3 via CDN | **Eingefrorener Ur-Prototyp**, läuft mit `python -m http.server`, kein Build |
| [`stadt-zuerich-next/`](stadt-zuerich-next/) | Next.js 16 + React 19 + TypeScript + Tailwind + next-intl | **Aktive Variante** mit Routing, SSR, i18n (5 Sprachen), v0-Prozessen und CI |

Die aktive Entwicklung findet ausschliesslich in
[`stadt-zuerich-next/`](stadt-zuerich-next/) statt; nutze diese Variante. Der
Vanilla-Prototyp `stadt-zuerich-mog/` ist als Ursprungs-Stand erhalten, wird
aber nicht weiterentwickelt.

Historisch teilten sich beide eine gemeinsame ETL-Pipeline mit dem Output
`data.json`. Das gilt **nicht mehr**: die Varianten sind divergiert und haben
jeweils ein eigenes `scripts/`-Verzeichnis.

- `stadt-zuerich-mog/` erzeugt weiterhin eine flache `data.json`.
- `stadt-zuerich-next/` nutzt eine adapter-basierte Pipeline
  (`scripts/build-data.mjs` → `scripts/adapters/<city>.mjs`) und schreibt
  pro Stadt nach `data/<city>/` (Org-Chart, Lebenslagen); der Ausgabepfad
  steht in `config/city.config.json`. Die v0-Prozesse liegen daneben unter
  `data/prozesse/<city>/`.

## Features

- **Interaktive Maschinerie** (Cytoscape-Graph, radial + force-directed)
- **Treemap «Wohin geht mein Steuerfranken?»**
- **Hierarchische Liste** für Screenreader und Tastaturnutzung
- **Lebenslagen-Suche** («Hund anmelden» → Steueramt)
- **5 Sprachen**: DE, EN, FR, IT und **Leichte Sprache**
- **Deep-Links** auf einzelne Einheiten via `?focus=<id>`
- **Dark Mode** mit Cookie-Persistenz, ohne Flash
- **Progressive Enhancement**: Liste und Suche funktionieren ohne JavaScript

## Datenquellen

- Strukturdaten: [stadt-zuerich.ch](https://www.stadt-zuerich.ch/) (Organigramm)
- Budget & Aufwand: [data.stadt-zuerich.ch / fd_rpktool](https://data.stadt-zuerich.ch/dataset/fd_rpktool)
  (API-Key ist öffentlich und Teil der Datensatz-Dokumentation).
  Default-Phase ist `RECHNUNG` (Ist-Werte aus dem
  [Geschäftsbericht 2025](https://www.stadt-zuerich.ch/de/aktuell/publikationen/2026/geschaeftsbericht-2025.html)).
- FTE pro Departement: [Rechnung 2025 der Stadt Zürich, S. 30](https://www.stadt-zuerich.ch/content/dam/web/de/aktuell/publikationen/2026/rechnung-2025/rechnung-2025-strb.pdf)
- FTE pro Einheit: Proxy aus Personalaufwand ÷ 130 000 CHF Vollkosten
  (Validierungspunkt Steueramt: Proxy 227 vs. publiziert 222 = 2 % Abweichung)

Alle Daten stehen unter [CC-BY 4.0 der Stadt Zürich](https://data.stadt-zuerich.ch/). Bitte Attribution beachten.

## Quick Start

```bash
# Next.js-Variante (empfohlen)
cd stadt-zuerich-next
npm install
npm run data:fetch    # Daten von data.stadt-zuerich.ch laden
npm run dev           # http://localhost:3000

# Vanilla-Prototyp (läuft ohne npm install)
cd stadt-zuerich-mog
python -m http.server 8000
# http://localhost:8000
```

## Mitmachen

Siehe [CONTRIBUTING.md](CONTRIBUTING.md). Die Idee ist explizit, dass andere
Städte dieses Modell nachnutzen können — Organisationsdaten und Locale-Strings
sind entkoppelt.

Gesucht werden insbesondere:
- **Übersetzungen der Lebenslagen** in FR/IT
- **Leichte-Sprache-Review** durch Fachpersonen
- **Daten-Pflege**: Aktualisierung nach Stadtratswahlen, Reorganisationen
- **Andere Städte**: Basel, Bern, Luzern — Struktur adaptieren

## Lizenz

Code: [MIT](LICENSE). Daten: CC-BY 4.0 der Stadt Zürich (siehe
[data.stadt-zuerich.ch/terms-of-use](https://data.stadt-zuerich.ch/terms-of-use)).

## Danksagung

- [Hugo Rushworth](https://x.com/Hrushworth) für die Idee und das
  UK-Vorbild [machineryofgovernment.uk](https://machineryofgovernment.uk/)
- [Statistik Stadt Zürich / Open Data Zürich](https://data.stadt-zuerich.ch/)
  für die offenen Finanzdaten
- [Inclusion Handicap](https://www.inclusion-handicap.ch/) für die
  Leichte-Sprache-Regeln
