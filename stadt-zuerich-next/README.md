# Maschinerie der Stadt Zürich – Next.js-Port

Next.js-16-Variante des Vanilla-Prototyps in `../stadt-zuerich-mog/`.
Gleiche Funktionalität, gleicher Daten-Fluss, aber als typsichere
React-App mit komponentenbasiertem UI.

> **Auch als Template für andere Städte gedacht.** Die Code-Basis ist
> stadt-agnostisch — Name, Theme, Datenquellen und ETL-Logik sind in
> drei Pfaden entkoppelt (`config/city.config.json`,
> `scripts/adapters/<id>.mjs`, `data/<id>/`). Fork & klone, dann
> `npm run scaffold:city <id> "<name>"` + Checkliste in
> **[PORTING.md](PORTING.md)** abarbeiten. Genf als durchgearbeitetes
> Beispiel im Guide.

## Stack

- **Next.js 16** (App Router, Server- + Client-Components)
- **React 19** + **TypeScript** strict
- **Tailwind CSS v4** (CSS-only Konfig in [`app/globals.css`](app/globals.css))
- **next-intl 4** für 5 Sprachen (DE/EN/FR/IT/Leichte Sprache)
- **Cytoscape.js** + cytoscape-fcose (radialer + force-directed Graph)
- **D3** (`d3-hierarchy`, `d3-scale` — nur die benötigten Module)
- ETL-Skripte aus `scripts/` unverändert übernommen (Node 20+, stdlib-only)

## Architektur

Multi-Route mit Deep-Linking:

Alle Routen sind locale-präfixiert. **DE** ist Default und braucht **kein**
Prefix; alle anderen Sprachen kriegen den Locale als ersten Pfadteil:

| Route | Zweck | Server / Client |
|-------|-------|-----------------|
| `/`, `/en`, `/fr`, `/it`, `/ls` | Maschinerie (Cytoscape-Graph) | Server-Component, GraphView client-only |
| `/?focus=<unit-id>` | Graph zoomt auf gewählte Einheit, Detail-Panel offen | Deep-Link tauglich |
| `/steuerfranken`, `/en/steuerfranken`, … | Treemap «Wohin geht mein Steuerfranken?» | Server, TreemapView client |
| `/liste`, `/en/liste`, … | Hierarchische `<details>`-Liste für SR + Tastatur | **Komplett server-renderbar**, funktioniert ohne JS |
| `/anliegen?q=…`, `/en/anliegen?q=…`, … | Lebenslagen-Suche, Trefferliste mit Deep-Links | **Komplett server-renderbar**, Progressive-Enhancement-Fallback der Live-Suche |

```
app/
  layout.tsx              ← Server, lädt Lebenslagen, wraps in <Shell>
  page.tsx                ← / – Graph + DetailPanel (Suspense für useSearchParams)
  steuerfranken/page.tsx  ← /steuerfranken – Treemap
  liste/page.tsx          ← /liste – Liste (server-rendered)
  anliegen/page.tsx       ← /anliegen?q=… – server-rendered Lebenslagen-Suche
  globals.css             ← Tailwind v4 Theme + Komponentennahe Styles

components/
  Shell.tsx       ← Server-Wrapper: <Header/> + <Search/> + {children}
  Header.tsx      ← Client, Link-basierte Tab-Nav, dark-mode persistent
  Search.tsx      ← Client, Lebenslagen → router.push('/?focus=…')
  GraphView.tsx   ← Client, Cytoscape dynamic-import,
                    useSearchParams für ?focus= als Source-of-Truth
  TreemapView.tsx ← Client, D3-Hierarchy + React-JSX
  ListView.tsx    ← Server-renderbar, native <details>
  DetailPanel.tsx ← Client, useSearchParams + URL-State, close → router.replace
  Legend.tsx      ← Statische Farbkodierung

lib/
  data.ts         ← loadStadtData() liest data.json + lebenslagen.json
  search.ts       ← Lebenslagen-Score + CHF/Mio-Formatter

types/stadt.ts    ← Typedefinitionen für data.json
scripts/          ← ETL unverändert aus Prototyp
data/manual/      ← fte-publiziert.json, lebenslagen.json
data/raw/         ← gitignored, ETL-Cache
data.json         ← Output der ETL-Pipeline
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

Side-Effekt: Layout wird durch `cookies()` zur dynamischen Route — was sie
ohnehin schon ist (data.json + lebenslagen.json sind dynamisch geladen).

### Progressive Enhancement der Suche

Die Suche unter `/` und `/steuerfranken` ist ein echtes
`<form method="get" action="/anliegen">`:

| Szenario | Ablauf |
|----------|--------|
| **Ohne JS** (Lynx, NoScript, alte Browser) | Enter im Suchfeld submittet das Formular → Browser navigiert zu `/anliegen?q=...`, Server rendert die Trefferliste, jeder Treffer ist ein `<Link href="/?focus=...">` → vollständig nutzbar |
| **Mit JS** | Live-Dropdown zeigt Top-6-Treffer beim Tippen, Klick auf Treffer → `router.push('/?focus=...')`. Enter funktioniert weiterhin und führt auf `/anliegen` für die volle Trefferliste |

`/anliegen` ist auch direkt aufrufbar — ohne `q` werden 8 «häufige Anliegen»
als Vorschläge angeboten. Diese Vorschläge sind Links zu `/anliegen?q=<stichwort>`,
also wieder server-rendered.

## Setup

```bash
npm install
npm run data:fetch        # ETL einmal laufen lassen (data.json erzeugen)
npm run dev               # http://localhost:3000
```

## Docker

Wer keine passende Node-Version installieren mag: die App läuft komplett
isoliert in Docker, ohne lokale Node-/npm-Installation.

```bash
# Web-UI auf http://localhost:3000
docker compose up app

# ETL-Pipeline einmalig laufen lassen (aktualisiert data/*.json im Repo):
#   braucht .env.local mit RPK_API_KEY — siehe .env.example
docker compose --profile etl run --rm etl
```

Der Build ist multi-stage (`deps` → `builder` → `runner`); das Runtime-Image
liegt bei ~150 MB und läuft als non-root User. Der ETL-Service hängt an einem
Compose-Profil (`--profile etl`) und startet NICHT bei `docker compose up` —
ETL ist ein einmaliger Lauf, kein Daemon. Die `./data/`-Mounts im ETL-Service
sorgen dafür, dass frisch geholte JSONs in deinem Arbeitsverzeichnis landen
und nicht im Container verloren gehen.

Für Production-Deploys (Vercel/Netlify/eigener Server) ist Docker optional —
`output: 'standalone'` in `next.config.ts` funktioniert überall.

## Environment-Variablen

Optional, beeinflussen nur die Produktion:

| Variable | Beispiel | Wirkung |
|----------|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | `https://maschinerie-zuerich.vercel.app` | Basis-URL für `/sitemap.xml` und `/robots.txt`. Auf Vercel nach dem ersten Deployment eintragen unter Project Settings → Environment Variables. |

## Datenflüsse

```
data.stadt-zuerich.ch (RPK API)         Budget-PDFs
      │                                       │
      ▼                                       ▼
scripts/fetch-rpktool.mjs       data/manual/fte-publiziert.json
scripts/fetch-budget.mjs                      │
      │                                       │
      ▼                                       │
data/raw/*.json (Cache)                       │
      │                                       │
      ▼                                       │
scripts/enrich-{...}.mjs ◄────────────────────┘
      │
      ▼
data.json  ──►  lib/data.ts (loadStadtData)  ──►  app/page.tsx (server)
                                                       │
                                                       ▼
                                              <App data={data}>
                                                       │
                              ┌────────────────────────┼────────────────────────┐
                              ▼                        ▼                        ▼
                        <GraphView>            <TreemapView>             <ListView>
                          (client)               (client)              (server-renderbar)
```

## Unterschiede zum Prototyp

| Aspekt | Prototyp | Next.js-Port |
|--------|----------|--------------|
| Sprachen | HTML+JS | TypeScript strict |
| Bundling | Keines (CDN) | Next.js (Turbopack) |
| Daten-Loading | client-side `fetch()` | Server-Component, einmaliger `fs.readFile` |
| Cytoscape/D3 | UMD via CDN | npm-Pakete, dynamic import für Cytoscape |
| State-Management | DOM-Klassen + globale Variablen | React-Hooks |
| Tabs | CSS-Body-Klasse | Conditional Rendering |
| ListView | DOM-Mutation via JS | React-rendered, server-fähig |
| Routing | Single-Page | Single-Page (Tabs in einer Route) — Multi-Route wäre ein Refactor wert |

## Internationalisierung

5 Sprachen über `next-intl 4`, mit `localePrefix: 'as-needed'`:

| Locale | URL | Sprachcode | Notiz |
|--------|-----|-----------|-------|
| `de` | `/` (kein Prefix) | de-CH | Default |
| `en` | `/en/...` | en | English |
| `fr` | `/fr/...` | fr-CH | Français |
| `it` | `/it/...` | it-CH | Italiano |
| `ls` | `/ls/...` | de-CH | **Leichte Sprache** – einfache Sätze, kurze Wörter, gemäss Inclusion-Handicap-Regeln |

Übersetzungs-Dateien in [`messages/{de,en,fr,it,ls}.json`](messages/).
UI-Chrome (Buttons, Headings, Hints) ist vollständig übersetzt.
**Institutionsnamen** (Stadtkanzlei, Steueramt etc.) bleiben Deutsch — das
sind Eigennamen Schweizer Behörden, die nicht übersetzt werden.

`<LanguageSwitcher>` im Header ändert die URL via `router.replace`, behält
dabei `?focus=...` und andere Query-Parameter bei.

`<html lang>` wird pro Locale gesetzt (Schweizer Varianten wo verfügbar).

### Locale-Detection (Accept-Language)

`localeDetection: true` in [`i18n/routing.ts`](i18n/routing.ts) aktiviert das
automatische Sprach-Matching beim ersten Besuch:

| Szenario | Verhalten |
|----------|-----------|
| Englischer Browser ruft `/` auf | Redirect nach `/en` |
| Englischer Browser ruft `/steuerfranken` auf | Redirect nach `/en/steuerfranken` |
| User:in wählt manuell DE im `LanguageSwitcher` | `NEXT_LOCALE=de` Cookie wird gesetzt, ab sofort keine Redirects mehr, Wahl persistiert |
| Expliziter Deep-Link wie `/en/liste` oder `/fr/anliegen?q=chien` | **Keine** Umleitung – Prefix-Routen werden respektiert, damit geteilte Links immer die beabsichtigte Sprache zeigen |
| Browser-Accept-Language enthält `de-CH`, `de`, `en` (mit q-Werten) | next-intl wählt das bestmatchende Locale aus der Liste unserer 5; Fallback auf `de` bei keinem Match |

**Leichte Sprache (ls) wird nicht auto-detected** — niemand sendet
`Accept-Language: ls` oder ähnliches. LS ist nur über manuelle Auswahl oder
`/ls/…` erreichbar.

## Bekannte Verbesserungspotenziale

- **Treemap-Tooltip** via `next/dynamic` lazy-loaden — aktuell synchron.
- **Lebenslagen-Übersetzungen**: aktuell nur in DE. Pro Lebenslage
  `i18n: { de:..., en:..., fr:..., it:..., ls:... }` ergänzen.
- **Open-Graph-Bilder** pro Departement für geteilte Deep-Links.
- **Sitemap + robots.txt** für `/`, `/steuerfranken`, `/liste`, `/anliegen`
  in jeder Sprachvariante.
- **Such-Performance** für `/anliegen` mit grosser Lebenslagen-Datenbank:
  Suche im Server-Loader mit Index (z. B. MiniSearch) statt linearem Scan.
- **Locale-Detection** beim ersten Besuch (Accept-Language-Header) — aktuell
  geht der Browser standardmässig auf `/` (Deutsch), unabhängig von der
  Browser-Sprache. `next-intl` hat dafür `localeDetection: true`, müsste
  in `routing.ts` aktiviert werden.

## Lizenz

**MIT** — siehe [LICENSE](LICENSE).

Kurz: forken, umbauen, publizieren — privat oder kommerziell — ist
ausdrücklich erwünscht, solange die Copyright-Notice in der Kopie bleibt.
Genau das erlaubt das [Template-System für City-Forks](PORTING.md).

**Datenquellen sind separat lizenziert.** Die aus `data.stadt-zuerich.ch`
geladenen Roh-Daten stehen unter **CC-BY 4.0** (Stadt Zürich) — bei
Weiterverwendung muss die Quelle attribuiert werden. Details dazu stehen
im LICENSE-Anhang und auf <https://data.stadt-zuerich.ch/terms-of-use>.
