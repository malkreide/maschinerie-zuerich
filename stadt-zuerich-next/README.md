# Maschinerie der Stadt Zürich

**Interaktive Visualisierung der Zürcher Stadtverwaltung** — Organigramm
mit Departementen, Dienstabteilungen und Beteiligungen, flankiert von
Budget-Flüssen, FTE-Zahlen und einer fuzzy-toleranten "Welches Amt ist
für mein Anliegen zuständig?"-Suche. Gebaut mit Next.js 16, Cytoscape,
D3 und offenen Daten aus `data.stadt-zuerich.ch` (CC-BY 4.0).

**Für wen:**

- **Bürger:innen** — verstehen, wer wofür zuständig ist und wohin
  der eigene Steuerfranken fliesst.
- **Stadtverwaltungen und Open-Government-Projekte** — ein fertiges
  White-Label-Tool statt Eigenbau.
- **Journalist:innen und Civic-Tech-Initiativen** — Einstieg ins
  Verwaltungsgeflecht, ohne selbst eine Graph-Engine zu bauen.

> **Gebaut für Zürich, gedacht für jede Stadt.** Der Code ist
> stadt-agnostisch — ein Fork für Genf oder Bern ist eine Checkliste,
> kein Refactor. Details in
> [White-Label](#white-label--ein-code-viele-städte),
> [How-To](#how-to-eigene-stadt-abbilden) und
> [PORTING.md](PORTING.md).

## Quickstart

Node ≥ 20.20.2 vorausgesetzt. Die aktuelle Datenbasis (Organigramm,
Budget, FTE, Lebenslagen) liegt bereits im Repo unter `data/zh/` —
die App startet also ohne vorheriges ETL:

```bash
npm install
npm run dev          # → http://localhost:3000
```

Um die Daten zu aktualisieren (holt frische Zahlen vom Stadt-Zürich-
Open-Data-Portal), einmalig die ETL-Pipeline laufen lassen:

```bash
cp .env.example .env.local    # RPK_API_KEY eintragen — siehe Kommentar im File
npm run data:fetch            # ~2 min, schreibt data/zh/org-chart.json & Co.
```

Keine Lust auf Node-Installation? → [Docker](#docker).

## Docker

Die App läuft komplett isoliert in Docker, ohne lokale Node-/npm-
Installation — praktisch für "einfach mal anschauen" oder Production-
Deploys auf Servern ohne Node-Umgebung.

```bash
# Web-UI auf http://localhost:3000
docker compose up app

# ETL-Pipeline einmalig laufen lassen (aktualisiert data/*.json im Repo):
#   braucht .env.local mit RPK_API_KEY — siehe .env.example
docker compose --profile etl run --rm etl
```

Der Build ist multi-stage (`deps` → `builder` → `runner`); das Runtime-
Image liegt bei ~150 MB und läuft als non-root User. Der ETL-Service
hängt an einem Compose-Profil (`--profile etl`) und startet NICHT bei
`docker compose up` — ETL ist ein einmaliger Lauf, kein Daemon. Die
`./data/`-Mounts im ETL-Service sorgen dafür, dass frisch geholte JSONs
in deinem Arbeitsverzeichnis landen und nicht im Container verloren
gehen.

Für Production-Deploys (Vercel/Netlify/eigener Server) ist Docker
optional — `output: 'standalone'` in `next.config.ts` funktioniert
überall.

## White-Label — ein Code, viele Städte

Die Maschinerie ist als **Referenz-Implementierung für Zürich** gebaut,
aber der Code selbst weiss nichts über Zürich. Alle stadt-spezifischen
Teile sind in drei klar benannte Pfade ausgelagert:

| Pfad | Was liegt drin | Zürich-Beispiel |
|------|----------------|-----------------|
| `config/city.config.json` | Name, Logo, Primärfarben, Locales, Domain, externe Such-URL | `"name": { "de": "Stadt Zürich" }` |
| `scripts/adapters/<id>.mjs` | ETL-Pipeline: welche APIs/PDFs werden abgefragt, wie gemappt? | `zh.mjs` → RPK-Tool + Budget-PDFs |
| `data/<id>/` | Rohdaten, Organigramm, Lebenslagen, Prozesse | `data/zh/org-chart.json`, `data/zh/lebenslagen.json` |

Zusätzlich optional pro Stadt:

| Pfad | Was liegt drin |
|------|----------------|
| `config/synonyms/<locale>.json` | Alltagssprache↔Jargon-Cluster für die Suche ("Abfall"↔"Entsorgung") |
| `public/brand/<id>-logo.svg` | Optionales Glyph im Header (kein Wappen — Anti-Staatsemblem-Policy) |
| `schemas/opengov-process-schema.json` | JSON-Schema für Prozess-Beschreibungen — städteübergreifend stabil |

### Das Template-System: Core + City-Forks

Dieses Repo ist gleichzeitig **Core-Implementierung UND Template**.
Der Workflow für andere Städte ist klein:

1. **Fork** auf GitHub (oder Git-Host deiner Wahl).
2. **Scaffold** die neue Stadt:
   `npm run scaffold:city ge "Genève" "Genf"`.
   Das Skript legt `config/city.config.ge.json`, `scripts/adapters/ge.mjs`,
   `data/ge/`-Skeleton und ein Platzhalter-Logo an — **ohne** bestehende
   Dateien zu überschreiben.
3. **Daten + Adapter befüllen** — siehe
   [How-To](#how-to-eigene-stadt-abbilden) unten für die Kurzfassung
   und [PORTING.md](PORTING.md) für die vollständige Schritt-für-Schritt-
   Checkliste (Genf als durchgezogenes Beispiel).
4. **Deploy** — Vercel, Docker, eigener Server. Der Code ist identisch
   zum Zürich-Fork; nur die drei oben genannten Pfade unterscheiden sich.

**Upstream-Merges bleiben möglich.** Code-Verbesserungen aus diesem
Core (Such-Engine, neue Visualisierungen, Bug-Fixes) können nachträglich
in den City-Fork gemerged werden, ohne dass die lokalen Daten verloren
gehen — die sind ja in `data/ge/` und `config/city.config.ge.json`
sauber isoliert.

## How-To: Eigene Stadt abbilden

Vollständige Checkliste in [PORTING.md](PORTING.md). Hier die
Kurzfassung für "ich will's mal ausprobieren":

```bash
# 1. Scaffold neue Stadt (id = kurzer Slug, Name = Anzeige-Name)
npm run scaffold:city ge "Genève" "Genf"

# 2. Config aktivieren
#    → config/city.config.zh.json  (alte wegsichern)
#    → config/city.config.ge.json → config/city.config.json umbenennen
#    → Platzhalter-Werte (domain, URLs) durch echte ersetzen

# 3. Org-Chart für Genf befüllen
#    → data/ge/org-chart.json      (departments, units, beteiligungen)
#    → data/ge/lebenslagen.json    (Bürger-Anliegen-Mapping)

# 4. Entweder ETL-Adapter schreiben (für spätere Auto-Updates) ...
#    → scripts/adapters/ge.mjs     (Pipeline mit fetch + enrich Schritten)

# 5. ... oder die Daten einfach manuell pflegen und ETL überspringen.
npm run dev
```

**Mindest-Datensatz** für ein lauffähiges Fork:

1. **`data/<id>/org-chart.json`** — Organigramm im
   `StadtData`-Schema (`departments[]`, `units[]`, `beteiligungen[]`
   mit IDs + Bezeichnungen + optionalen Budget-/FTE-Zahlen). Der
   Scaffold-Befehl erzeugt ein minimales, valides Skeleton.
2. **`data/<id>/lebenslagen.json`** — "Bürger-Anliegen → zuständiges
   Amt"-Mappings. Schema: `{ id, zustaendig, i18n: { de: { frage,
   stichworte, antwort } } }`. 10-20 Einträge reichen für einen
   sinnvollen Suche-Test.
3. **Optional**: `config/synonyms/<locale>.json` — Alltagsbegriffe ↔
   Fachjargon für die Fuzzy-Suche (Beispiel: "Abfall" ↔ "voirie"). Die
   Zürcher Cluster taugen als Startpunkt; tausch die stadt-spezifischen
   Institutionskürzel (ERZ, VBZ, UGZ) gegen die lokalen aus.

**Daten aus offenen Quellen holen**: die Adapter-API in
`scripts/adapters/` ist absichtlich klein — ein Adapter exportiert eine
Pipeline (Liste von `{id, run}`-Schritten). Der ZH-Adapter ruft das
RPK-Tool und holt Budget-PDFs; ein Genf-Adapter würde z. B. das
SITG-Portal (sitg.ge.ch) und ville-ge.ch anzapfen. `scripts/adapters/zh.mjs`
dient als kommentierte Vorlage.

Mit den drei Schritten oben bekommst du ein lauffähiges "Maschinerie
Genève" oder "Maschinerie Bern" — gleiche UX, gleiche Deep-Links,
gleiche Fuzzy-Suche, aber mit deinen Daten.

## Stack

- **Next.js 16** (App Router, Server- + Client-Components)
- **React 19** + **TypeScript** strict
- **Tailwind CSS v4** (CSS-only Konfig in [`app/globals.css`](app/globals.css))
- **next-intl 4** für 5 Sprachen (DE/EN/FR/IT/Leichte Sprache)
- **Cytoscape.js** + cytoscape-fcose (radialer + force-directed Graph)
- **D3** (`d3-hierarchy`, `d3-scale` — nur die benötigten Module)
- **Fuse.js 7** — Fuzzy-Suche mit Synonym-Cluster-Expansion
- ETL-Skripte aus `scripts/` (Node 20+, stdlib-only)

## Architektur

Multi-Route mit Deep-Linking. Alle Routen sind locale-präfixiert;
Default-Locale ist DE.

| Route | Zweck | Server / Client |
|-------|-------|-----------------|
| `/`, `/en`, `/fr`, `/it`, `/ls` | Maschinerie (Cytoscape-Graph) | Server-Component, GraphView client-only |
| `/?focus=<unit-id>` | Graph zoomt auf gewählte Einheit, Detail-Panel offen | Deep-Link-tauglich |
| `/steuerfranken`, `/en/steuerfranken`, … | Treemap «Wohin geht mein Steuerfranken?» | Server, TreemapView client |
| `/liste`, `/en/liste`, … | Hierarchische `<details>`-Liste für SR + Tastatur | **Komplett server-renderbar**, funktioniert ohne JS |
| `/anliegen?q=…`, `/en/anliegen?q=…`, … | Lebenslagen-Suche mit Deep-Links | **Komplett server-renderbar**, Progressive-Enhancement-Fallback der Live-Suche |
| `/prozesse/<city>/<id>` | Detail-Seite pro Verwaltungs-Prozess (schema.org/GovernmentService JSON-LD) | Server |

```
app/
  layout.tsx              ← Server, lädt Lebenslagen, wraps in <Shell>
  page.tsx                ← / – Graph + DetailPanel (Suspense für useSearchParams)
  steuerfranken/page.tsx  ← /steuerfranken – Treemap
  liste/page.tsx          ← /liste – Liste (server-rendered)
  anliegen/page.tsx       ← /anliegen?q=… – server-rendered Lebenslagen-Suche
  prozesse/.../page.tsx   ← Prozess-Detailseite mit JSON-LD
  sitemap.ts + robots.ts  ← SEO-Basics
  globals.css             ← Tailwind v4 Theme + Komponentennahe Styles

components/
  Shell.tsx       ← Server-Wrapper: <Header/> + <Search/> + {children}
  Header.tsx      ← Client, Link-basierte Tab-Nav, dark-mode persistent
  Brand.tsx       ← Optionales Logo-Glyph (pro Stadt konfigurierbar)
  Search.tsx      ← Client, Fuse.js + Synonym-Cluster → router.push('/?focus=…')
  GraphView.tsx   ← Client, Cytoscape dynamic-import,
                    useSearchParams für ?focus= als Source-of-Truth
  TreemapView.tsx ← Client, D3-Hierarchy + React-JSX
  ListView.tsx    ← Server-renderbar, native <details>
  DetailPanel.tsx ← Client, useSearchParams + URL-State, close → router.replace
  Legend.tsx      ← Statische Farbkodierung

config/
  city.config.json          ← stadt-spezifische Werte (Name, Theme, Pfade)
  synonyms/<locale>.json    ← Such-Synonym-Cluster pro Locale

lib/
  data.ts         ← loadStadtData() liest city.config.orgChartPath + lebenslagenPath
  search.ts       ← Fuse.js-Index + Synonym-Expansion, CHF/Mio-Formatter
  prozess-jsonld.ts ← schema.org GovernmentService JSON-LD-Projektion

types/stadt.ts    ← Typdefinitionen
scripts/adapters/ ← ETL pro Stadt (zh.mjs, ge.mjs, …)
data/<id>/        ← Rohdaten pro Stadt (org-chart.json, lebenslagen.json, prozesse/)
schemas/          ← JSON-Schema für Prozess-Beschreibungen (stabile $id)
```

### Deep-Linking-Verhalten

- `/?focus=FD-st` öffnet Maschinerie und zoomt direkt auf das Steueramt
- Klick auf einen Lebenslagen-Vorschlag in der Suche navigiert via `router.push()`
- Klick auf einen Knoten im Graph aktualisiert die URL (`router.replace`, kein Scroll)
- Schliessen des Detail-Panels entfernt den `?focus`-Parameter
- Browser-Back funktioniert wie erwartet
- Die URL ist teilbar: «Schau dir das Steueramt an» → `https://…/?focus=FD-st`

### Dark-Mode-Persistenz

Cookie-basiert (`mog-theme=dark|light`, `samesite=lax`, 1 Jahr Max-Age),
**ohne FOUC**:

| Schritt | Wer | Was |
|---------|-----|-----|
| 1. Request | Server (`app/layout.tsx`) | liest Cookie via `getTheme()` aus `lib/theme.ts` |
| 2. Render | Server | setzt `<html class="dark">` direkt in der HTML-Antwort |
| 3. Paint | Browser | Theme ist sofort korrekt — kein Flash |
| 4. Hydration | Client (`Header.tsx`) | liest aktuelle Klasse aus dem DOM, synct State |
| 5. Toggle | Client | togglet Klasse + setzt Cookie via `document.cookie` (kein Roundtrip) |
| 6. Nächster Request | Server | liest Cookie → renders mit korrektem Theme |

### Progressive Enhancement der Suche

Die Suche unter `/` und `/steuerfranken` ist ein echtes
`<form method="get" action="/anliegen">`:

| Szenario | Ablauf |
|----------|--------|
| **Ohne JS** (Lynx, NoScript, alte Browser) | Enter im Suchfeld submittet das Formular → Browser navigiert zu `/anliegen?q=...`, Server rendert die Trefferliste, jeder Treffer ist ein `<Link href="/?focus=...">` → vollständig nutzbar |
| **Mit JS** | Live-Dropdown zeigt Top-6-Treffer beim Tippen, Klick auf Treffer → `router.push('/?focus=...')`. Enter führt weiterhin auf `/anliegen` für die volle Trefferliste |

`/anliegen` ist auch direkt aufrufbar — ohne `q` werden 8 «häufige Anliegen»
als Vorschläge angeboten. Diese Vorschläge sind Links zu `/anliegen?q=<stichwort>`,
also wieder server-rendered.

### Suche: Fuzzy + Jargon-Tolerant

`lib/search.ts` kombiniert zwei Mechanismen:

1. **Synonym-Cluster** aus `config/synonyms/<locale>.json` — ungerichtete
   Äquivalenz-Pools. Enthält eine Lebenslage irgendeinen Term eines
   Clusters, werden alle Cluster-Kollegen automatisch als zusätzliche
   Such-Tokens indexiert. "Hochzeit" findet damit "heiraten", obwohl
   dort nur "heirat/ehe/trauung" als Stichworte stehen.
2. **Fuse.js (v7)** mit gewichteter Multi-Feld-Suche und Bitap-Fuzzy-
   Matching. Threshold 0.35 verzeiht typische Tippfehler ("Abfal",
   "Hochzit", "Reisepas"), ohne Fremdwörter durchzulassen.

Regressions-Probe: `npm run probe:search` fährt 18 echte Queries gegen
den Index und druckt die Top-3-Treffer.

## Datenflüsse

```
data.stadt-zuerich.ch (RPK API)         Budget-PDFs
      │                                       │
      ▼                                       ▼
scripts/adapters/zh.mjs → pipeline[]      (fte-publiziert.json)
      │                                       │
      ▼                                       │
data/raw/*.json (ETL-Cache)                   │
      │                                       │
      ▼                                       │
scripts/enrich-{...}.mjs ◄────────────────────┘
      │
      ▼
data/zh/org-chart.json  ──►  lib/data.ts  ──►  app/[locale]/page.tsx
                                                       │
                                                       ▼
                                              <App data={data}>
                              ┌────────────────────────┼────────────────────────┐
                              ▼                        ▼                        ▼
                        <GraphView>            <TreemapView>             <ListView>
                          (client)               (client)              (server-renderbar)
```

## Environment-Variablen

| Variable | Beispiel | Wirkung | Wo setzen |
|----------|----------|---------|-----------|
| `RPK_API_KEY` | (siehe .env.example) | Auth für `data.stadt-zuerich.ch` RPK-Endpunkt | `.env.local` (lokal), Docker `.env.local` (ETL-Service) |
| `NEXT_PUBLIC_SITE_URL` | `https://maschinerie-zuerich.vercel.app` | Basis-URL für `/sitemap.xml`, `/robots.txt`, JSON-LD | Production-Env (Vercel Project Settings, Docker-Env) |
| `BUDGET_JAHR` | `2024` | Optional: Budget-Jahr übersteuern beim ETL-Lauf | `docker compose --profile etl run etl` oder `.env.local` |
| `BUDGET_BETRAGSTYP` | `budgetiert` | Optional: Betragstyp-Filter für Budget-ETL | dto. |

## Internationalisierung

5 Sprachen über `next-intl 4`:

| Locale | Sprachcode | Notiz |
|--------|-----------|-------|
| `de` | de-CH | Default |
| `en` | en | English |
| `fr` | fr-CH | Français |
| `it` | it-CH | Italiano |
| `ls` | de-x-ls | **Leichte Sprache** — einfache Sätze, kurze Wörter, gemäss Inclusion-Handicap-Regeln |

Übersetzungs-Dateien in [`messages/{de,en,fr,it,ls}.json`](messages/).
UI-Chrome (Buttons, Headings, Hints) ist vollständig übersetzt.
**Institutionsnamen** (Stadtkanzlei, Steueramt etc.) bleiben Deutsch — das
sind Eigennamen Schweizer Behörden, die nicht übersetzt werden.

`<LanguageSwitcher>` im Header ändert die URL via `router.replace`, behält
dabei `?focus=...` und andere Query-Parameter bei.

## Unterschiede zum Prototyp

Historisch ist die Maschinerie aus einem Vanilla-JS-Prototyp in
`../stadt-zuerich-mog/` hervorgegangen. Die Next.js-Variante bringt:

- Typsicherheit (TypeScript strict statt plain JS)
- Server-side Data-Loading (einmaliger `fs.readFile` statt client-side `fetch`)
- Routing (Deep-Links, Locale-Prefixes, Server-renderable Fallbacks)
- Multi-Stadt-Architektur (siehe [White-Label](#white-label--ein-code-viele-städte))
- Komponenten-basiertes UI statt DOM-Mutation
- Fuzzy-Suche mit Synonym-Expansion statt Substring-Match

Der Prototyp bleibt als minimaler Referenz-Fall erhalten.

## Bekannte Verbesserungspotenziale

- **Treemap-Tooltip** via `next/dynamic` lazy-loaden — aktuell synchron.
- **Lebenslagen-Übersetzungen**: aktuell nur in DE. Pro Lebenslage
  `i18n: { de:..., en:..., fr:..., it:..., ls:... }` ergänzen.
- **Synonym-Cluster** für EN/FR/IT/LS (aktuell nur DE) —
  `config/synonyms/<locale>.json` pro Sprache.
- **Open-Graph-Bilder** pro Departement für geteilte Deep-Links.
- **Locale-Detection** beim ersten Besuch (Accept-Language-Header) —
  aktuell `localeDetection: false` in `i18n/routing.ts`. Aktivieren
  würde Redirect-Verhalten für Erstbesuche einführen (englischer Browser
  → `/en`), das braucht einen genauen UX-Entscheid.

## Mitwirken

Beiträge sind ausdrücklich erwünscht — **Code ist nur eine Form davon.**
Die Maschinerie bildet ein reales Verwaltungs-System ab, und dieses
System hat seine eigenen "Bugs": umständliche Prozesse, unklare
Zuständigkeiten, Formulare, die Daten verlangen, die der Staat schon hat.
Solche **Verwaltungs-Logik-Bugs** gehören in den Issue-Tracker — genauso
wie kaputte React-Hooks.

Konkret:

- 🏛️ **Verwaltungs-Logik-Bug melden** (umständlicher Behördengang,
  unklare Zuständigkeit) → [neues Issue](../../issues/new/choose),
  Template *"Verwaltungs-Logik-Bug"*.
- 💡 **Prozess-Vereinfachung vorschlagen** — ein "Pull Request" an die
  Stadtverwaltung ohne Code → Template *"Behördengang vereinfachen"*.
- 🎯 **Falsche Zuständigkeit** / ➕ **fehlende Lebenslage** in der
  Suche → Issue via Template oder direkt PR gegen
  [`data/zh/lebenslagen.json`](data/zh/lebenslagen.json).
- 🐛 **App-Bug** / ✨ **Feature-Idee** → entsprechende Issue-Templates.
- 🌍 **Übersetzung** (FR/IT/EN oder Leichte Sprache) → PR gegen
  [`data/zh/lebenslagen.json`](data/zh/lebenslagen.json) (Lebenslagen)
  oder [`messages/`](messages/) (UI-Chrome).

Ausführliche Anleitung + Checklisten in der
[CONTRIBUTING.md](../CONTRIBUTING.md) im Repo-Root.

Für persönliche Beschwerden an ein konkretes Amt bleibt allerdings der
[offizielle Kanal](https://www.stadt-zuerich.ch/kontakt) der richtige —
dieses Repo ist für **strukturelle** Verbesserungen gedacht.

## Lizenz

**MIT** — siehe [LICENSE](LICENSE).

Kurz: forken, umbauen, publizieren — privat oder kommerziell — ist
ausdrücklich erwünscht, solange die Copyright-Notice in der Kopie bleibt.
Genau das erlaubt das [Template-System für City-Forks](PORTING.md).

**Datenquellen sind separat lizenziert.** Die aus `data.stadt-zuerich.ch`
geladenen Roh-Daten stehen unter **CC-BY 4.0** (Stadt Zürich) — bei
Weiterverwendung muss die Quelle attribuiert werden. Details dazu stehen
im LICENSE-Anhang und auf <https://data.stadt-zuerich.ch/terms-of-use>.
