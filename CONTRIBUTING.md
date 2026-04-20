# Mitmachen

Danke für dein Interesse am Projekt «Maschinerie der Stadt Zürich»! Das
Repo ist so gebaut, dass Beiträge aus verschiedenen Richtungen willkommen sind.

## Kategorien von Beiträgen

| Was | Wie |
|-----|-----|
| **Übersetzung** einer Lebenslage in FR/IT | PR gegen [`stadt-zuerich-next/data/manual/lebenslagen.json`](stadt-zuerich-next/data/manual/lebenslagen.json) — Feld `i18n.fr` / `i18n.it` pro Eintrag |
| **Übersetzung** der UI-Chrome (Buttons, Überschriften) | PR gegen [`stadt-zuerich-next/messages/{fr,it}.json`](stadt-zuerich-next/messages/) |
| **Leichte-Sprache-Review** | Issue mit Kommentar zu einer konkreten Datei in `messages/ls.json` |
| **Bug-Report** | Issue mit Screenshot, Browser, URL |
| **Feature-Idee** | Issue, damit wir vorher Scope klären |
| **Daten-Pflege** (nach Wahlen, Reorganisationen) | PR gegen [`scripts/mapping/institution-mapping.json`](stadt-zuerich-next/scripts/mapping/institution-mapping.json) |
| **Adaption für andere Stadt** | Fork — Änderungen an `data.json` und `i18n/routing.ts` reichen meistens |

## Entwicklungs-Setup

Siehe [README.md](README.md#quick-start). Kurzform:

```bash
cd stadt-zuerich-next
npm install
npm run data:fetch
npm run dev
```

## Code-Style

- **TypeScript strict** für die Next.js-Variante
- **Kein Semikolon-Zwang**, aber konsistent innerhalb einer Datei
- **Tailwind-Klassen** inline, keine separaten CSS-Module für neue Komponenten
- **Kommentare** nur wo das *Warum* nicht offensichtlich ist
- **Commits**: kurze deutsche oder englische Betreffzeile, beschreibender Body bei grösseren Änderungen

Vor einem PR:
```bash
cd stadt-zuerich-next
npm run typecheck
```

## Dependencies ändern

Wenn du eine Library in [`stadt-zuerich-next/package.json`](stadt-zuerich-next/package.json) hinzufügst, aktualisierst oder entfernst, **immer lokal `npm install` laufen lassen** und die daraus entstehende `package-lock.json` mit-committen.

```bash
cd stadt-zuerich-next
npm install <neues-paket>      # oder manuelle Edit in package.json + npm install
git add package.json package-lock.json
git commit -m "deps: add <paket> for <reason>"
```

Warum:
- Die CI nutzt `npm ci` (nicht `npm install`) — das ist strikt und bricht ab, wenn `package.json` und `package-lock.json` divergieren. Vergessene Lockfile-Updates werden im Build sofort sichtbar.
- Der npm-Cache in GitHub Actions invalidiert automatisch, sobald sich `package-lock.json` ändert — ohne Commit des Lockfiles läuft jeder Build ohne Cache, das kostet ~20 s pro Run.
- Reproduzierbare Installs: alle Contributors und die CI ziehen identische Versionen.

### Renovate

Wöchentliche PRs mit gruppierten Updates kommen von [Renovate](https://docs.renovatebot.com/) — siehe [`renovate.json`](renovate.json) im Repo-Root.

**Gruppierung:**
- `react` — Next, React, React-DOM, @types/react*
- `d3` — alle d3-Module + Types
- `tailwind` — Tailwind + PostCSS + @tailwindcss/*
- `cytoscape` — Cytoscape-Core + Plugins + Types
- `tooling` — TypeScript + @types/node
- `github-actions` — Actions-Updates (monatlich)

**Auto-Merge-Regeln (Renovate-nativ, kein Custom-Workflow):**

| Update-Typ | Dep-Typ | Automerge |
|------------|---------|-----------|
| Patch | `dependencies` | ✅ Squash |
| Patch / Minor | `devDependencies` | ✅ Squash |
| Major | alle | ❌ Label `major-update`, manuelle Review |
| Lockfile-Maintenance | — | ✅ Squash |
| Security | alle | ✅ sofort (auch Major) |

Die Squash-Strategie hält die Git-History sauber. Branches werden nach Merge
automatisch gelöscht (Repo-Setting `delete_branch_on_merge`).

Renovate erstellt ausserdem ein zentrales [Dependency-Dashboard-Issue](https://github.com/malkreide/maschinerie-zuerich/issues) mit Titel «Renovate Dashboard» — Übersicht aller offenen, erkannten und zurückgehaltenen Updates.

## Daten-Änderungen

Wenn sich Struktur der Stadtverwaltung ändert (neue Dienstabteilung, Reorganisation):

1. `scripts/mapping/institution-mapping.json` aktualisieren
2. Falls neu: `data.json` im Repo-Root ergänzen (units / beteiligungen)
3. `npm run data:fetch:force` lokal laufen lassen
4. Resultat prüfen: Konflikte in `data.json` sind OK, wenn bewusst gesetzt
5. PR mit einer Erklärung, woher die Änderung stammt (Stadtratsbeschluss, GRB, etc.)

## Lebenslagen hinzufügen oder korrigieren

`stadt-zuerich-next/data/manual/lebenslagen.json`:

```json
{
  "id": "eindeutige-id",
  "zustaendig": "<unit-id aus data.json>",
  "i18n": {
    "de": {
      "frage": "Kurze Frage in Bürgerdeutsch",
      "stichworte": ["wort1", "wort2"],
      "antwort": "Ein-Satz-Antwort"
    },
    "en": null, "fr": null, "it": null, "ls": null
  }
}
```

- Die `zustaendig`-ID muss in `data.json` existieren — der CI-Validator prüft das.
- `i18n.de` ist Pflicht (die anderen Locales fallen auf `de` zurück, wenn leer).
- Stichworte bitte klein, singular, ohne Sonderzeichen.
- Für Übersetzungen nur die jeweiligen Locale-Slots (`fr`, `it`, …) füllen — Rest unverändert lassen.

## Code of Conduct

Alle Interaktionen folgen dem [Code of Conduct](CODE_OF_CONDUCT.md).

## Sicherheit

Sicherheitsrelevante Probleme bitte nicht als öffentliches Issue melden,
siehe [SECURITY.md](SECURITY.md).
