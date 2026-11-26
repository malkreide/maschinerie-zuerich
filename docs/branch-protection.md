# Schutz für `main`: Ruleset

**Status:** Soll-Zustand. Die Konfiguration steht als importierbares
GitHub-Ruleset in [`.github/rulesets/main.json`](../.github/rulesets/main.json).
Wirksam wird sie erst, wenn der Maintainer (`malkreide`) sie in den
Repo-Settings importiert (siehe [Einrichten](#einrichten)). Das Repo selbst
kann seine Schutzregeln nicht setzen.

## Warum das nicht optional ist

Alle Daten-Gates dieses Repos (Regression-Guard, Schema-Validierung,
Kardinalregel-Lint, Referenzen-Gate) sind **JavaScript, das die CI ausführt**.
Ohne Schutz lässt sich ein Pull Request mergen, solange die CI noch läuft
oder nachdem sie rot geworden ist. Die Guards sind dann nur so verbindlich
wie der aufmerksamste Reviewer.

Bei `pull_request`-Events nimmt GitHub Actions die Workflow-Definition
zudem aus dem **PR-Head**: Ein PR kann die Jobs, die ihn prüfen, selbst
verändern oder entfernen. Pflicht-Checks fangen das Entfernen ab, denn ein
Pflicht-Check, der nie eintrifft, blockiert den Merge. Ein Job, der zwar
eintrifft, aber nichts mehr prüft, fällt nur im Review auf. Änderungen an
`.github/workflows/` brauchen deshalb immer einen Blick in den Diff.

## Soll-Konfiguration für `main`

| Einstellung im Ruleset | Wert | Feld in `main.json` |
|---|---|---|
| Ziel | Default-Branch (`main`) | `conditions.ref_name.include` |
| Restrict deletions | ✅ | `deletion` |
| Block force pushes | ✅ | `non_fast_forward` |
| Require a pull request before merging | ✅, 0 Approvals | `pull_request` |
| Require review from Code Owners | ❌ vorerst nicht, [siehe unten](#warum-kein-code-owner-review) | `require_code_owner_review` |
| Require status checks to pass | ✅, nur Quelle GitHub Actions | `required_status_checks` |
| Require branches to be up to date before merging | ✅ | `strict_required_status_checks_policy` |
| Bypass list | leer: niemand, auch keine Admins | `bypass_actors` |

### Pflicht-Checks (Job-Namen aus `.github/workflows/ci.yml`)

- `Next.js typecheck + lint`
- `org-chart.json + lebenslagen.json validieren`
- `OpenGov-Schemas validieren (Org-Chart + Prozesse)`
- `Unit-Tests (Bewertungs-Ableitung)`
- `Prozess-Daten Regression-Guard (i18n + description)`
- `Referenzen-Gate (Liveness + Verbatim für geänderte References)`
- `Accessibility (Playwright + axe-core)`

Alle sieben sind an die App **GitHub Actions** gebunden
(`integration_id: 15368`). Ein gleichnamiger Status, den ein anderes Token
über die Status-API setzt, zählt damit nicht.

`Prozess-Daten Regression-Guard` und `Referenzen-Gate` laufen nur auf
Pull Requests (`if: github.event_name == 'pull_request'`), also genau dort,
wo Pflicht-Checks greifen. Auf `main`-Pushes fehlen sie erwartungsgemäss.

Pflicht-Checks werden über den **Job-Namen** gematcht. Benennt jemand einen
Job um, trifft der alte Name nie mehr ein, und jeder Merge bleibt blockiert.
Ein neuer Job wäre dagegen still optional. `tests/ruleset.test.mjs` gleicht
deshalb `ci.yml` und `main.json` in der CI ab: Ändert sich ein Job-Name,
muss `main.json` im selben PR nachgezogen **und danach neu importiert**
werden.

## Einrichten

1. GitHub → Repo → **Settings → Rules → Rulesets → New ruleset →
   Import a ruleset**.
2. `.github/rulesets/main.json` auswählen (vorher lokal herunterladen).
3. Die Vorschau gegen die Tabelle oben prüfen, dann **Create**.
4. Unter **Settings → General → Pull Requests** prüfen, ob
   **Allow auto-merge** eingeschaltet ist. Renovate braucht das für
   `platformAutomerge` (siehe unten). Ist es aus, merged Renovate selbst,
   sobald die Checks grün sind. Der Schutz greift in beiden Fällen.
5. Falls unter **Settings → Branches** noch eine klassische
   Branch-Protection-Regel für `main` existiert: löschen. Beide würden
   gleichzeitig gelten, und zwei Orte für dieselbe Regel laufen
   auseinander.

**Prüfen:** Die Branch-Liste zeigt `main` als geschützt. Im nächsten PR
listet die Merge-Box die sieben Checks als *Required*, und der Merge-Knopf
bleibt gesperrt, bis alle grün sind. Ein direkter Push auf `main` wird
abgelehnt.

Rulesets sind für alle mit Lesezugriff sichtbar. Wer das Repo liest, kann
also nachprüfen, welche Regeln für `main` gelten.

**Änderungen** am Ruleset laufen über einen PR auf `main.json`, danach
**Import** in den Settings (bestehendes Ruleset vorher löschen oder von Hand
angleichen). Für einen Notfall, etwa wenn ein Pflicht-Check wegen eines
GitHub-Ausfalls nie eintrifft, wird das Ruleset kurz auf **Disabled**
gestellt und danach wieder auf **Active**. Die Ruleset-Historie protokolliert
das. Eine dauerhafte Bypass-Liste gibt es bewusst nicht.

## Warum kein Code-Owner-Review

`.github/CODEOWNERS` nennt `malkreide` für alle kritischen Pfade. Das ist
zugleich die einzige Person mit Schreibrechten. Sie ist auch Autor:in der
meisten PRs, einschliesslich der von Claude Code erstellten und der
Wochenbefund-PRs (`WOCHENBEFUND_TOKEN`). GitHub zählt die Freigabe eines
eigenen PRs nicht. Damit gäbe es nur zwei Varianten:

- **Code-Owner-Review ohne Bypass:** Jeder eigene PR auf `data/prozesse/`,
  `data/befunde/`, `.github/` oder die Schemas wäre dauerhaft blockiert.
- **Code-Owner-Review mit Admin-Bypass:** Der Bypass würde bei fast jedem
  Merge gebraucht. Eine Kontrolle, die routinemässig umgangen wird, schützt
  nicht, sie gewöhnt nur ans Umgehen. Zudem hebt ein Bypass im selben
  Ruleset auch die Pflicht-Checks auf.

Heute stellt die Schreibrechte-Grenze sicher, dass ein Mensch jeden Merge
auslöst: Ausser `malkreide` kann niemand mergen. Einzige Ausnahme ist der
Renovate-Auto-Merge, unten beschrieben. **Code-Owner-Review wird aktiviert,
sobald eine zweite Person mit Review-Recht in `CODEOWNERS` steht** (dann
`require_code_owner_review: true` und `required_approving_review_count: 1`).

## Zusammenspiel mit den übrigen Leitplanken

- **Kein Auto-Merge nach `main`** (CLAUDE.md, Human-in-the-Loop): Gilt für
  Prozessdaten und Code. Ausgenommen ist nur der Renovate-Auto-Merge für
  Patch- und Minor-Updates von devDependencies (mit 3 Tagen Cooldown) und
  für Sicherheits-Updates (`renovate.json`). Auch diese PRs warten jetzt auf
  alle sieben Pflicht-Checks. Runtime-Dependencies, Major-Updates,
  Lock-File-Maintenance und GitHub-Actions-Updates merged ein Mensch.
- **Up to date vor dem Merge:** Der Regression-Guard vergleicht gegen
  `origin/main` zum Zeitpunkt des CI-Laufs. Ist `main` seither
  weitergelaufen, sperrt das Ruleset den Merge, bis der PR aktualisiert ist
  (Knopf *Update branch*, bei Auto-Merge-PRs rebased Renovate selbst). Danach
  laufen die Checks gegen den neuen Stand.
- **Wochenbefund-PR** (`link-rot.yml`): Mit dem Secret `WOCHENBEFUND_TOKEN`
  startet die CI normal. Ohne Secret öffnet der Standard-Token den PR, und
  GitHub startet dafür keine CI. Der PR muss dann einmal geschlossen und
  wieder geöffnet werden, sonst bleibt er an den Pflicht-Checks hängen. Der
  PR-Text weist darauf hin.
- **Escape-Hatch `ALLOW_PROZESS_SHRINK=1`** ist in der CI nicht gesetzt.
  Ein PR, der die Variable in `ci.yml` einschleust, wird nicht technisch
  blockiert, sondern im Review erkannt. Deshalb gilt: Diffs auf
  `.github/workflows/` immer lesen. Bewusste Reduktionen laufen stattdessen
  über `stadt-zuerich-next/config/regression-ausnahmen.json`, eng gefasst
  (exakter Abdeckungs-Übergang je Datei/Locale).
- Das **Referenzen-Gate** (`scripts/check-refs-gate.mjs`) prüft bei jedem
  PR die im Diff neu hinzugekommenen oder geänderten References live:
  tote Deep-Links (404/410/5xx) und `source_quote`s, die nicht wörtlich
  auf der verlinkten Seite stehen, blockieren den Merge. Damit ist
  `status: "verifiziert"` nicht mehr rein selbst-attestiert.
- Bestehende, unveränderte References prüft das Gate nicht. Dafür läuft
  im wöchentlichen Workflow `link-rot.yml` der **Zitat-Drift-Bericht**
  (`npm run check:quotes:drift`): Er prüft alle `source_quote`s wörtlich
  gegen die Live-Seite und nennt bei Abweichung den ähnlichsten Satz.
  Advisory — der Befund steht im Job-Summary; ein Mensch setzt das Zitat
  neu (Werte prüfen!). Manuell mit `strict_zitate` rot bei Drift.
