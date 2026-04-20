# Maschinerie der Stadt Zürich

Interaktive, barrierefreie Visualisierung der Stadtverwaltung Zürich —
Departemente, Dienstabteilungen, verselbständigte Betriebe und Beteiligungen,
mit Budget und Stellenwerten aus öffentlichen Quellen.

Inspiriert von [machineryofgovernment.uk](https://machineryofgovernment.uk/)
von Hugo Rushworth.

## Zwei Varianten

Das Repo enthält zwei eigenständige Implementationen der gleichen Idee:

| Verzeichnis | Stack | Zweck |
|-------------|-------|-------|
| [`stadt-zuerich-mog/`](stadt-zuerich-mog/) | Single-HTML + Vanilla-JS + Cytoscape + D3 via CDN | Prototyp, läuft mit `python -m http.server`, kein Build |
| [`stadt-zuerich-next/`](stadt-zuerich-next/) | Next.js 16 + React 19 + TypeScript + Tailwind + next-intl | Produktions-Variante mit Routing, SSR, i18n (5 Sprachen) |

Beide nutzen die gleiche ETL-Pipeline in `scripts/` und das gleiche
Datenschema (`data.json`). Wähle, was zum Anwendungsfall passt.

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
  (API-Key ist öffentlich und Teil der Datensatz-Dokumentation)
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
