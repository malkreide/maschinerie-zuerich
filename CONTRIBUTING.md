# Mitmachen

Danke für dein Interesse am Projekt «Maschinerie der Stadt Zürich»! Das
Repo ist so gebaut, dass Beiträge aus verschiedenen Richtungen willkommen sind.

## Kategorien von Beiträgen

| Was | Wie |
|-----|-----|
| **Übersetzung** einer Lebenslage in FR/IT | PR gegen [`stadt-zuerich-next/messages/`](stadt-zuerich-next/messages/) |
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
npm run lint
```

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
  "frage": "Kurze Frage in Bürgerdeutsch",
  "stichworte": ["wort1", "wort2"],
  "zustaendig": "<unit-id aus data.json>",
  "antwort": "Ein-Satz-Antwort"
}
```

Die `zustaendig`-ID muss in `data.json` existieren — ein Skript validiert das
beim Build. Stichworte bitte klein, singular, ohne Sonderzeichen.

## Code of Conduct

Alle Interaktionen folgen dem [Code of Conduct](CODE_OF_CONDUCT.md).

## Sicherheit

Sicherheitsrelevante Probleme bitte nicht als öffentliches Issue melden,
siehe [SECURITY.md](SECURITY.md).
