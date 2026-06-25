# ETL-Skripte

Pipeline für die Aktualisierung der Org-Chart-JSON (Pfad aus
[`config/city.config.json`](../config/city.config.json) → `orgChartPath`,
für Zürich `data/zh/org-chart.json`) aus offenen Datenquellen der jeweiligen
Stadt. Stadt-spezifische API-Calls leben in `adapters/<cityId>.mjs` — der
Rest der Pipeline ist generisch.

## Quellen

| Datensatz | API | Was wir holen |
|-----------|-----|---------------|
| `fd_rpktool` – Finanzdaten der Stadt Zürich | `https://api.stadt-zuerich.ch/rpkk-rs/v1` | `/departemente`, `/institutionen` (Strukturreferenz), `/sachkonto2stellig` (Aufwand/Ertrag pro Institution × Jahr × Phase) |

API-Doku & Beispiele:
- Swagger: <https://opendatazurich.github.io/rpk-api/docs/>
- Jupyter-Notebook: <https://github.com/opendatazurich/opendatazurich.github.io/blob/master/rpk-api/RPK-API-Beispiele.ipynb>

Lizenz: CC0 (Open Government Data der Stadt Zürich).

Der API-Key wird aus der Env-Variable `RPK_API_KEY` gelesen (Name steht in
`config/city.config.json` → `dataSources.rpk.apiKeyEnv`). Lokal landet er
in `.env.local` (siehe [`.env.example`](../.env.example)), in CI als
Plattform-Secret. Die Datei `.env.local` ist via `.gitignore` ausgeschlossen.

## Architektur: Stadt-Adapter

Die fetch-Scripts sind stadt-agnostisch: sie laden
`scripts/adapters/<cityId>.mjs` basierend auf `city.config.json → id` und
rufen dessen Methoden (`fetchStructure`, `fetchBudget`). Der Kontrakt ist
in [`adapters/index.mjs`](adapters/index.mjs) als JSDoc dokumentiert.

### Neue Stadt andocken

1. Leg `config/city.config.json` mit deiner `id`, `name`, `domain`, …,
   `dataSources` und `theme` an (siehe ZH als Vorlage).
2. Schreib `scripts/adapters/<id>.mjs` — implementiere mindestens eine der
   Methoden (`fetchStructure` / `fetchBudget`) sowie `pipeline`, die die
   build-Reihenfolge angibt. Kopier [`zh.mjs`](adapters/zh.mjs) als Start.
3. Leg `data/<id>/org-chart.json` und `data/<id>/lebenslagen.json` an.
   Pfade müssen mit `orgChartPath` / `lebenslagenPath` in der config
   übereinstimmen.
4. `npm run data:fetch` ruft dein Adapter auf. `npm run build` prüft, dass
   das Resultat typecheckt und die Seiten vorrendern.

Alles, was unter `app/`, `components/`, `lib/` liegt, bleibt unverändert —
der Code liest ausschliesslich über `@/config/city.config`.

## Ablauf

```
┌──────────────────┐    ┌────────────────────┐    ┌──────────────────┐
│ fetch-rpktool    │───▶│ data/raw/*.json    │───▶│ enrich-…         │───▶ data/<id>/org-chart.json
│ (adapter→cache)  │    │ (gitignored)       │    │ + mapping/       │
└──────────────────┘    └────────────────────┘    └──────────────────┘
```

**Befehle (npm scripts in [`package.json`](../package.json)):**

```bash
npm run data:fetch         # full pipeline (Adapter entscheidet die Schritte)
npm run data:fetch:force   # full pipeline, ignoriert Cache

# ENV (Defaults: aktuelles Jahr − 1, RECHNUNG):
BUDGET_JAHR=2025 BUDGET_BETRAGSTYP=RECHNUNG npm run data:fetch
# Werte werden an den Adapter durchgereicht; Zürich kennt
# BUDGET_BETRAGSTYP: STADTRAT_ANTRAG | GEMEINDERAT_BESCHLUSS | RECHNUNG
# RECHNUNG = Ist-Werte aus dem Geschäftsbericht (ab Publikation, ~April).
# Vor Publikation: BUDGET_BETRAGSTYP=GEMEINDERAT_BESCHLUSS überschreiben.
```

Direkt mit Node ohne npm:

```bash
node scripts/build-data.mjs
node scripts/fetch-rpktool.mjs   # nur Struktur-Schritt
node scripts/fetch-budget.mjs    # nur Budget-Schritt
```

## Link-Check (`check-links.mjs`)

Prüft alle URLs in den offenen Daten (Prozesse, Org-Chart, Katalog, Schemas).
Zwei Modi:

```bash
npm run check:links                 # strukturell (kein Netz) — CI-Gate in ci.yml
npm run check:links:online          # + Live-HTTP, advisory (Exit 0)
npm run check:links:online:strict   # + Live-HTTP, Exit 1 bei echtem Link-Rot
```

Der **strukturelle** Modus (Default) verlangt nur wohlgeformte, absolute
https-URLs und läuft netzfrei — deshalb taugt er als PR-Gate.

Der **Live-Modus** (`--online`) ruft jede eindeutige URL real ab und
kategorisiert die Befunde, weil „nicht erreichbar" Verschiedenes heisst:

- **tot** (404/410/5xx) — echtes Link-Rot, gehört in den Daten korrigiert.
- **blockiert** (401/403/429) — Quelle lebt, lehnt aber diesen Client ab
  (Bot-Schutz, Rate-Limit, IP-Sperre). Kein Datenfehler.
- **netzfehler** (Timeout/DNS) — aus dieser Umgebung gesperrt (Netzpolicy).
  Kein Datenfehler.

`--strict` (bzw. `CHECK_LINKS_STRICT=1`) kippt den Lauf nur bei **toten**
Links; blockiert/netzfehler nie, weil IP-/policy-abhängig. Pro Befund werden
die betroffenen Datendateien ausgewiesen.

> Grenze: Der Check sieht nur den HTTP-Status. Amtliche JS-SPAs liefern auch
> bei verschobenem Inhalt ein 200 („soft 404") — ein grüner Live-Check belegt
> Erreichbarkeit, nicht die inhaltliche Richtigkeit der Belegstelle.

Zeitgesteuert läuft der Live-Modus wöchentlich (advisory) im Workflow
[`.github/workflows/link-rot.yml`](../../.github/workflows/link-rot.yml); ein
manueller Lauf (`workflow_dispatch`) kann `strict` einschalten.

## Belegstellen-Kandidaten (`extract-quotes.mjs`)

Schlägt für References **Kandidaten-`source_quote`** vor, indem es die
verlinkte amtliche Seite holt und die belegenden Passagen extrahiert. Zwei
Bezugsmodi:

- **`--fetch`** (empfohlen): HTTP-GET + HTML→Text, ohne Browser. Die aktuellen
  `stadt-zuerich.ch`- und `zh.ch`-Seiten sind **serverseitig gerendert** — der
  zitierbare Text steht bereits im HTML. Läuft auch hinter dem Agent-Egress-
  Proxy (der Chromium-Traffic nicht durchlässt) und ist deutlich schneller.
- **Browser** (Default ohne `--fetch`): rendert mit Chromium/Playwright und
  liest `document.body.innerText`. Nötig nur für echte JS-SPAs, deren Text erst
  clientseitig entsteht. Braucht offenen Egress + Chromium.

```bash
npm run extract:quotes -- --fetch --file steuern.json --only-unverified
npm run extract:quotes -- --fetch --all-refs --out /tmp/quotes.md
```

Wichtig — **das Skript schreibt NICHTS in die Daten**. Belegstellen für
bindende Werte (Fristen, Gebühren) sind die heikelste Stelle der Maschinerie
(Kardinalregel «Link, don't assert»): Das Skript liefert nur Vorschläge, ein
**Mensch** wählt das wörtliche Zitat, trägt es als `source_quote` ein und
setzt `status: "verifiziert"`.

Optionen: `--fetch` (HTTP statt Browser) · `--city <id>` · `--file <prozess.json>` ·
`--only-unverified` (nur unbelegte References) · `--all-refs` (auch belegte
gegen die Live-Seite prüfen = Drift-/Re-Verifikations-Check) ·
`--grep <regex>` (nur passende Segmente — nötig bei riesigen Einzelseiten wie
dem ganzen ZGB auf einer fedlex-Seite, z. B. `--grep "Ehefähigkeit"`) ·
`--json` · `--out <pfad>` · `--timeout` · `--concurrency`.

Voraussetzungen:
- **Netz-Egress** zu den Quell-Domains. `admin.ch` (fedlex, Schweizer Pass) ist
  in der Standardumgebung gesperrt — diese Quellen lokal oder mit offener
  Netzpolicy abrufen. `stadt-zuerich.ch`, `zh.ch` und `ch.ch` funktionieren mit
  `--fetch` bereits durch den Agent-Proxy.
- Nur Browser-Modus: Chromium (`npx playwright install chromium`, in `ci.yml`
  ohnehin Teil des a11y-Jobs). `--fetch` braucht keinen Browser.

> Der `--all-refs`-Drift-Check ist **advisory** und strikt verbatim: meldet er
> «NEIN», kann das echte Drift (Seite geändert) ODER bloss abweichende
> Zeichensetzung/Whitespace sein — die Kandidatenliste daneben zeigt, was
> aktuell auf der Seite steht.

## Mapping

[`mapping/institution-mapping.json`](mapping/institution-mapping.json) bildet
unsere internen IDs (z. B. `SiD-stapo`) auf die `kurzname`-Codes der RPK-API
(z. B. `STP`) ab. **Manuell zu pflegen** – wenn das Skript `WARN unit X fehlt
im Mapping` ausgibt, hier ergänzen.

`null` bedeutet bewusst nicht gemappt:
- Stäbe ohne eigene Institution (z. B. Wirtschaftsförderung als Teil von STE)
- externe Beteiligungen (z. B. Flughafen Zürich AG, ZKB) – sind nicht
  Stadtverwaltung und tauchen nicht in `/institutionen` auf.

## Konflikt-Erkennung

`enrich-from-rpktool.mjs` loggt `CONFLICT`, wenn unsere Departements-Zuordnung
von der RPK-API abweicht, **und** speichert die Diskrepanz strukturiert pro
Unit ins `data.json`:

```json
"konflikt": {
  "unsereZuordnung":  "SiD",
  "unsereKurzname":   "SID",
  "rpkKurzname":      "PRD",
  "rpkBezeichnung":   "Präsidialdepartement"
}
```

Solche Konflikte sind **kein Fehler**, sondern bewusst zu entscheiden:
Bevölkerungsamt z. B. liegt laut RPK unter PRD (zentrale Verwaltungsstelle),
in unserer bürgerorientierten Sicht aber unter dem Sicherheitsdepartement
(Pass- und ID-Stelle).

Aktuelle Konflikte (4):

| Unit | Bürger-Sicht | RPK-Sicht |
|------|--------------|-----------|
| PRD-stk (Stadtkanzlei) | PRD | BUG (Behörden und Gesamtverwaltung) |
| PRD-stab (Betreibungsamt) | PRD | BUG |
| FD-imm (Immobilien Stadt Zürich) | FD | HBD |
| SiD-bev (Bevölkerungsamt) | SiD | PRD |

Im UI sichtbar als orange-gestrichelter Rand am Knoten und als
⚠ Zuordnung-Zeile im Detail-Panel.

## Budget-Aggregation

Die API liefert Beträge pro **Institution × Sachkonto**, nicht direkt pro
Departement. `enrich-budget.mjs` summiert nach HRM2-Konvention:

- **Aufwand** = Σ aller Sachkonten 30…39
- **Ertrag**  = Σ aller Sachkonten 40…49
- **Nettoaufwand** = Aufwand − Ertrag

Departement-Totals werden **konservativ** aus den Units aggregiert, deren
RPK-Zuordnung zum Departement passt. Konflikt-Units (siehe oben) fliessen
also nicht ins Departement-Total ein – das ist Absicht. Dadurch sind
Departement-Werte tendenziell tiefer als der offizielle Geschäftsbericht;
die Differenz entspricht den umstrittenen Zuordnungen.

## FTE-Proxy

Im OGD-Katalog der Stadt Zürich existiert **kein** Datensatz mit FTE pro
Dienstabteilung der Stadtverwaltung. Geprüfte Suchen ohne Treffer:
`personal`, `personalbestand`, `personalstatistik`, `mitarbeitende`,
`vollzeitaequivalente`, `stellen`, `lohn`, `anstellung`, `beschaeftigte`.
Vorhandene Beschäftigten-Datensätze betreffen die *Wirtschaft* der Stadt
(BFS STATENT, alle Firmen), nicht die Verwaltung selbst.

Pragmatischer Ersatz: `enrich-fte-proxy.mjs` schätzt FTE aus dem
Personalaufwand (HRM2-Sachkonto **30**, schon in den Budget-Caches enthalten):

```
FTE_geschätzt = Personalaufwand / Vollkosten_pro_FTE
```

Default `Vollkosten_pro_FTE = 130'000 CHF` (Bruttolohn + Soz.-Versicherung +
PK-Beiträge, gemittelt). Validierung gegen publizierte Geschäftsbericht-Werte
liefert <10 % Abweichung für die grossen Einheiten:

| Einheit | Schätzung | Publiziert (ca.) |
|---|---|---|
| VBZ | 2'550 | 2'700 |
| ewz | 1'275 | 1'200 |
| Stadtpolizei | 2'229 | 2'500 |
| Stadtspital Zürich | 3'459 | 4'500 |

Override pro Run möglich:
```bash
FTE_VOLLKOSTEN=125000 node scripts/enrich-fte-proxy.mjs
```

Im UI als „~XXX (Schätzung)" mit Tooltip ausgewiesen — bewusst nicht als
exakte Zahl. Wenn die Stadt einen verlässlichen Personalbestand-Datensatz
veröffentlicht, ersetzt ein neuer `enrich-fte.mjs` diesen Proxy.

## FTE aus PDFs – Recherche-Ergebnis

Geprüft: Budget 2026 (Hauptbudget, Globalbudgets, Anstalten) und Rechnung
2025 (Hauptrechnung + Globalbudgets). **Pro-Institution-Stellenpläne werden
NICHT flächendeckend publiziert. Pro-Departement-Stellenwerte schon.**

| PDF | Strukturierte FTE-Tabellen |
|-----|---------------------------|
| **Hauptrechnung 2025 (S. 30)** | **Stellenwerte-Tabelle pro Departement** (RE 2024 / BU 2025 / NK / RE 2025) — 9 Departemente + BUG |
| Hauptbudget 2026 (450 S.) | Keine Tabelle. Narrative Stellen-Deltas in Begründungen |
| Globalbudgets 2026 (230 S.) | Steueramt total, ewz Netzbetrieb (nur PG 2) |
| Anstalten 2026 (204 S.) | Vereinzelte VZS für PWG, SAW (nicht in unserem Modell) |
| Rechnung 2025 GB (226 S.) | Identisch zu Globalbudgets, mit Ist-Werten |

Für unser Modell direkt verwertbar: **9 Departemente + 1 Einheit (Steueramt)**.

### Validierung des Proxys gegen Hauptrechnung 2025

Aus der Stellenwerte-Tabelle (S. 30) lassen sich die Unit-Proxy-Aggregate
gegen Ist-Daten aller Departemente prüfen.

Erst-Validierung mit 40 Units, danach Mapping-Lücken geschlossen
(15 zusätzliche Institutionen aufgenommen: SEB/AZL/LBZ/KEB unter SD,
HPS/SKB/SFS/V15/FSV/SBMV/SG unter SSD, BZB unter SiD, ERZ in 4 Sub-Einheiten
gesplittet, Städtische Gesundheitsdienste unter GUD korrigiert).

| Departement | Δ vor Mapping-Fix | Δ nach Mapping-Fix |
|---|---:|---:|
| PRD | −26 % | −26 % (BUG-Konflikt) |
| FD | −4 % | −5 % |
| **SD** | **−48 %** | **+4 %** ✅ |
| GUD | −3 % | +1 % |
| **TED** | **−23 %** | **+4 %** ✅ |
| HBD | +5 % | +5 % |
| SiD | +16 % | +16 % (BVA-Konflikt) |
| **SSD** | **−17 %** | **−9 %** ✅ |
| DIB | −1 % | −1 % |
| **TOTAL Stadt-9-Dep.** | **−9 %** | **−0.1 %** ✅ |
| Steueramt (unit) | 227 | 222 (BU 2026) – Δ +2 % |

Modell jetzt **55 Units** (statt 40). Total-Proxy von 22'963 auf 24'882
gestiegen, das ist <1 % vom publizierten Total 25'133.

**Verbleibende Lücken** sind keine Methodenfehler, sondern bewusste
Bürger-vs-RPK-Sichtkonflikte:

- **PRD −26 %**: Stadtkanzlei (SKZ) + Betreibungsamt (BNN) liegen RPK-mässig
  unter BUG (Behörden und Gesamtverwaltung). Fix-Optionen: BUG als 10. „Dep"
  ergänzen, oder Aggregat-Logik so erweitern, dass BUG-Units zu PRD zählen.
- **SiD +16 %**: Bevölkerungsamt (BVA) liegt RPK-mässig unter PRD; in unserem
  Modell unter SiD. Trägt zu SiD-Über- und PRD-Unterzählung bei.
- **HBD +5 %**: Immobilien Stadt Zürich (IMO) liegt RPK-mässig unter HBD; bei
  uns unter FD. Geringer Effekt.
- **SSD −9 %**: Restliche kleine Schulen/Sub-Einheiten noch nicht modelliert.

**Konsequenz:** Department-FTE überschreibt das Skript mit Ist-Daten aus der
Rechnung. Unit-FTE bleibt Proxy (ausser Steueramt).

`enrich-fte-from-pdf.mjs` überschreibt den Proxy für die in
[`data/manual/fte-publiziert.json`](../data/manual/fte-publiziert.json)
gepflegten Einheiten und markiert sie im JSON mit `quelle: 'pdf'` (sonst
`quelle: 'schaetzung'`). UI zeigt ✓ publiziert vs. ⓘ Schätzung.

## Noch offen

- **Hauptrechnung 2025** (`rechnung-2025-strb.pdf`, 7 MB / 675 S.) noch nicht
  geprüft – könnte zusätzliche Personal-Tabellen enthalten.
- **Personalbericht** der Stadt Zürich: Existenz unklar, Suche auf
  stadt-zuerich.ch lieferte keine Treffer (Site-Search war zeitweise down).
- **Anfrage an Statistik Stadt Zürich** ob ein verlässlicher
  Stellenbestand-Datensatz im Open-Data-Katalog publiziert werden kann.
- **Differenzierte FTE-Vollkosten** pro Kategorie (Lehrpersonen vs.
  Verwaltung vs. Industriebetriebe haben unterschiedliche Lohnniveaus).
- **Konflikte automatisch in `data.json` als Feld speichern**, damit das UI
  sie als „Achtung: Zuordnung weicht von RPK ab" markieren kann.
- **Vergleich Budget vs. Rechnung** – beides parallel laden und in der UI
  als Differenz darstellen.
