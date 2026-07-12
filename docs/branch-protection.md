# Branch-Protection für `main` — Soll-Konfiguration

**Status:** Soll-Zustand, dokumentiert 2026-07-03. Branch-Protection lebt in
den GitHub-Repo-Settings und ist im Repo selbst nicht sichtbar — dieses
Dokument macht die erwartete Konfiguration explizit und nachvollziehbar.
Der Maintainer (`malkreide`) setzt bzw. prüft sie unter
*Settings → Branches → Branch protection rules → `main`*.

## Warum das nicht optional ist

Alle Daten-Gates dieses Repos (Regression-Guard, Schema-Validierung,
Kardinalregel-Lint, Referenzen-Gate) sind **JavaScript, das die CI ausführt**.
Bei `pull_request`-Events nimmt GitHub Actions die Workflow-Definition aus
dem **PR-Head** — ein Pull Request kann also die Jobs, die ihn prüfen
sollen, selbst verändern oder entfernen. Ohne Branch-Protection sind die
Guards damit nur so verbindlich wie der aufmerksamste Reviewer.

Zwei Mechanismen schliessen diese Lücke:

1. **Required status checks:** Ein entfernter Job meldet keinen Status —
   ein als «required» markierter Check, der nie eintrifft, blockiert den
   Merge. Das Umgehen durch Job-Löschung fällt damit sofort auf.
2. **Require review from Code Owners:** Änderungen an `.github/`
   (Workflows, CODEOWNERS selbst), an den Schemas, am Datenvertrag und an
   den Guard-Skripten brauchen die Freigabe des Maintainers
   (siehe `.github/CODEOWNERS`).

## Soll-Konfiguration für `main`

| Einstellung | Wert |
|---|---|
| Require a pull request before merging | ✅ |
| Require review from Code Owners | ✅ |
| Require status checks to pass before merging | ✅ |
| Require branches to be up to date before merging | empfohlen ✅ |
| Do not allow bypassing the above settings (inkl. Admins) | empfohlen ✅ |
| Force-Pushes / Löschen von `main` | ❌ verboten |

### Required status checks (Job-Namen aus `.github/workflows/ci.yml`)

Status-Checks werden über den **Job-Namen** gematcht. Required sind:

- `Next.js typecheck + lint`
- `org-chart.json + lebenslagen.json validieren`
- `OpenGov-Schemas validieren (Org-Chart + Prozesse)`
- `Unit-Tests (Bewertungs-Ableitung)`
- `Prozess-Daten Regression-Guard (i18n + description)`
- `Referenzen-Gate (Liveness + Verbatim für geänderte References)`
- `Accessibility (Playwright + axe-core)`

> **Beim Umbenennen eines Jobs** in `ci.yml` muss der Required-Check in den
> Branch-Settings nachgezogen werden — sonst blockiert der alte, nie mehr
> eintreffende Name jeden Merge (fail-safe, aber lästig).

`Prozess-Daten Regression-Guard` und `Referenzen-Gate` laufen nur auf
Pull Requests (`if: github.event_name == 'pull_request'`) — genau dort,
wo Required-Checks greifen. Auf `main`-Pushes fehlen sie erwartungsgemäss.

## Zusammenspiel mit den übrigen Leitplanken

- **Kein Auto-Merge nach `main`** (CLAUDE.md, Human-in-the-Loop): Renovate-
  `platformAutomerge` betrifft Dependency-PRs; Prozessdaten-PRs werden
  von einem Menschen gemergt. Required Code-Owner-Reviews erzwingen das
  für alle kritischen Pfade auch technisch.
- **Escape-Hatch `ALLOW_PROZESS_SHRINK=1`** ist in der CI nicht gesetzt und
  kann dank CODEOWNERS-Pflicht auf `.github/` nicht unbemerkt per PR in
  den Workflow injiziert werden.
- Das **Referenzen-Gate** (`scripts/check-refs-gate.mjs`) prüft bei jedem
  PR die im Diff neu hinzugekommenen oder geänderten References live:
  tote Deep-Links (404/410/5xx) und `source_quote`s, die nicht wörtlich
  auf der verlinkten Seite stehen, blockieren den Merge. Damit ist
  `status: "verifiziert"` nicht mehr rein selbst-attestiert.
