# Fork für eine neue Stadt

Dieses Repo ist als Template für andere Städte gedacht. Fork & klone, ruf
`npm run scaffold:city <id> "<name>"` auf, und arbeite die Checkliste ab.
Die Code-Basis bleibt unverändert — alles Stadt-Spezifische lebt in drei
Dateien / Ordnern:

- `config/city.config.json` — Name, Theme, Datenquellen-Settings
- `scripts/adapters/<id>.mjs` — ETL gegen deine API (oder leer)
- `data/<id>/` + `data/prozesse/<id>/` — deine Daten

Nichts in `app/`, `components/`, `lib/`, `i18n/`, `schemas/` muss angefasst
werden. Wenn's doch nötig wird, ist das ein Bug — bitte im Upstream-Repo
ein Issue aufmachen.

## Durchgearbeitetes Beispiel: Genf (`ge`)

### 1. Scaffold

```bash
# Im Fork-Repo
npm install
npm run scaffold:city ge "Genève" "Genf"
```

Das erzeugt:

| Datei | Inhalt |
|-------|--------|
| `config/city.config.ge.json` | Config-Vorlage mit TODO-Platzhaltern |
| `scripts/adapters/ge.mjs`    | Adapter-Stub mit TODO-Kommentaren |
| `data/ge/org-chart.json`     | Minimaler valider StadtData |
| `data/ge/lebenslagen.json`   | Leere Lebenslagen |
| `data/prozesse/ge/.gitkeep`  | Leerer Prozess-Ordner |
| `public/brand/ge-logo.svg`   | Kopie des abstrakten Zürich-Glyphs |

Keine der bestehenden ZH-Dateien wird überschrieben — du kannst ZH als
Referenz nebenher laufen lassen, bis deine Stadt steht.

### 2. Config befüllen

Öffne `config/city.config.ge.json` und ersetze:

- `domain` → `ville-ge.ch`
- `homepageUrl` → `https://www.ville-ge.ch/`
- `externalSearchUrlTemplate` → `https://www.ville-ge.ch/recherche?q={q}`
- `name` + `shortName` → passende Übersetzungen pro Locale (Genève/Genf/Geneva/Ginevra)
- `dataSources` → die API(s) deiner Stadt; siehe nächster Schritt
- `theme.accent` etc. → Farben des städtischen Corporate Design (oder lass ZH-Farben stehen — bis auf das Wappen ist Theme-Branding rechtlich unkritisch)

Wenn alles passt:

```bash
mv config/city.config.ge.json config/city.config.json
```

### 3. Datenquellen-Adapter schreiben

Wenn deine Stadt eine Open-Data-API hat, öffne `scripts/adapters/ge.mjs`
und implementiere `fetchStructure` (und optional `fetchBudget`). Der
Kontrakt steht in [`scripts/adapters/index.mjs`](scripts/adapters/index.mjs).
Für Zürich siehst du in [`scripts/adapters/zh.mjs`](scripts/adapters/zh.mjs)
ein konkretes Beispiel — dort werden `/departemente`, `/institutionen` und
`/sachkonto2stellig` von `api.stadt-zuerich.ch/rpkk-rs/v1` gezogen.

Genf publiziert Open Data über <https://ge.ch/sitg/>  (Kanton) und
<https://www.ville-ge.ch/> (Stadt). Wenn keine der Quellen für deinen
Anwendungsfall passt, lass `fetchStructure` weg und pflege
`data/ge/org-chart.json` von Hand — die Visualisierung funktioniert
identisch, nur eben ohne automatisches Update-Skript.

API-Keys kommen über `.env.local` ins Projekt (siehe
[`.env.example`](.env.example)). Der Name der Env-Variable steht in
`config/city.config.json → dataSources.<quelle>.apiKeyEnv` — wählt so,
dass der Name keine Missverständnisse mit anderen Städten erzeugt
(z.B. `GE_SITG_API_KEY`, nicht nur `API_KEY`).

### 4. Org-Chart befüllen

`data/ge/org-chart.json` folgt dem Schema in [`types/stadt.ts`](types/stadt.ts).
Minimum für einen lauffähigen Build:

```json
{
  "stadtrat": [
    { "id": "M-BARBEY",  "name": "Marie Barbey-Chappuis",  "titel": "Maire",           "department": "DEP-FIN" }
  ],
  "departments": [
    { "id": "DEP-FIN",   "name": "Département des finances", "head": "M-BARBEY", "color": "#1f3a8a" }
  ],
  "units": [],
  "beteiligungen": [],
  "extern": []
}
```

Farben sollten zu `theme.departmentPalette` aus der Config passen — sonst
nimmt die Treemap-Komponente Defaults.

### 5. Prozesse (optional)

Lege Prozess-Beschreibungen unter `data/prozesse/ge/<prozess-id>.json` an,
eine Datei pro Verwaltungsprozess. Als erste Zeile:

```json
"$schema": "../../../schemas/opengov-process-schema.json",
```

Dein Editor gibt dir dann Autocomplete. `npm run validate:prozesse` checkt
Formal- und Graph-Konsistenz. Siehe
[`schemas/README.md`](schemas/README.md) für den vollständigen Feld-Guide
und `data/prozesse/zh/anwohnerparkkarte.json` als Beispiel.

### 6. Brand-Glyph ersetzen (optional)

`public/brand/ge-logo.svg` ist eine Kopie des Zürich-Glyphs (drei-Knoten-
Graph). Ersetze es durch ein abstraktes Symbol deiner Wahl — **nicht** das
offizielle Stadtwappen, das ist in allen Kantonen rechtlich geschützt.
Wenn du gar keinen Header-Glyph willst, entferne `brand` aus der Config
und lösche die SVG.

### 7. ZH-Altlasten aufräumen

Wenn deine Stadt-Config steht und `npm run build` grün ist, kannst du die
Referenz-Daten löschen:

```bash
rm -rf data/zh/ data/prozesse/zh/ scripts/adapters/zh.mjs public/brand/zh-logo.svg
```

Und i18n-Strings prüfen: `messages/*.json` enthält heute ein paar Zürich-
spezifische Beispiele (z.B. Quellenhinweise in Tooltips). Die Stadt-Namen
selbst kommen über `{cityName}` aus der Config — die musst du nicht
anfassen.

### 8. Final-Check

```bash
npm run typecheck
npm run validate:prozesse
npm run build
```

Wenn alles grün ist, ist der Fork startklar. Deploy wie gewohnt auf
Vercel / Netlify / Static-Host (Build-Output unter `out/` bzw. `.next/`).

## Was du vom Upstream weiter bekommst

Solange du den Fork mit `git remote add upstream …` verknüpft lässt,
kannst du Schema-Erweiterungen (neue Schritt-Typen, neue Akteur-Typen),
UI-Bugfixes und neue Features mit einem `git merge upstream/main` holen.
Konflikte sind auf die Per-City-Dateien beschränkt (Config, Adapter,
Data/), weil der Shared-Code stadt-agnostisch bleibt.

Wenn du merkst, dass doch etwas Zürich-spezifisch ist, das nicht in die
Config passt: **mach ein Issue im Upstream auf**, statt im Fork zu
patchen. Das hilft allen anderen Städten gleich mit.
