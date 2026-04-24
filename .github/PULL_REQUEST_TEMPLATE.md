<!--
Danke für deinen Beitrag! Wähle unten die Kategorie, die am besten
passt — der Rest der Checkliste ist auf diese Art Beitrag zugeschnitten.

Mehrfach-Auswahl ist OK, wenn dein PR mehrere Kategorien berührt.
-->

## Art des Beitrags

- [ ] 🏛️ **Verwaltungs-Logik / Prozess-Verbesserung** — Änderung an
      Lebenslagen, Prozess-JSONs oder Zuständigkeits-Daten
- [ ] 🐛 **App-Bug-Fix** — Code-Change, der einen Fehler behebt
- [ ] ✨ **App-Feature** — neue Funktionalität in der Next.js-App
- [ ] 🌍 **Übersetzung** — Ergänzung/Korrektur in `messages/` oder
      `i18n`-Feldern von Lebenslagen
- [ ] 📊 **Daten-Aktualisierung** — Reorganisation, neue Dienstabteilung,
      Budget-Refresh
- [ ] 🏙️ **White-Label / neue Stadt** — Config/Adapter/Daten für eine
      weitere Stadt (`config/city.config.<id>.json`, `scripts/adapters/<id>.mjs`,
      `data/<id>/`)
- [ ] 📝 **Docs** — README, PORTING.md, Kommentar-Verbesserungen

## Worum geht's?

<!-- Kurze Beschreibung: Was ändert sich, warum? -->

## Verknüpftes Issue

<!-- Falls es zu einem bestehenden Issue gehört: "Schliesst #123" oder "Teil von #45" -->

Closes #

---

## Checkliste pro Beitrags-Art

### Bei Verwaltungs-Logik / Lebenslagen / Zuständigkeiten

- [ ] Die `zustaendig`-ID existiert in `data/<stadt>/org-chart.json`
      (CI-Validator prüft das automatisch).
- [ ] Neue `stichworte` sind Kleinschreibung, singular, ohne Sonderzeichen.
- [ ] Falls ein Synonym-Cluster in `config/synonyms/<locale>.json` betroffen
      ist: `npm run probe:search` lokal gelaufen, alle Probes grün.
- [ ] PR-Beschreibung enthält Quelle/Beleg (Merkblatt, stadt-zuerich.ch-Seite,
      offizielle Meldung), damit der Change nachvollziehbar bleibt.

### Bei Code-Changes (Bug-Fix, Feature)

- [ ] `npm run typecheck` lokal grün.
- [ ] `npm run build` lokal grün.
- [ ] `npm run lint` lokal grün.
- [ ] Neue Dependencies: `package.json` + `package-lock.json` beide
      committed (CI nutzt `npm ci`, divergierende Lockfiles brechen).
- [ ] Kommentare: nur wo das *Warum* nicht offensichtlich ist.

### Bei Übersetzungen

- [ ] Nur den Ziel-Locale-Slot bearbeitet (`fr`, `it`, …); andere
      Locales unverändert.
- [ ] Institutionsnamen bleiben Deutsch (Eigennamen Schweizer Behörden).
- [ ] Wenn Leichte Sprache (`ls`): kurze Sätze, einfache Wörter, aktive
      Formen — siehe Inclusion-Handicap-Richtlinien.

### Bei Daten-Aktualisierung (Reorganisation, neue Einheit)

- [ ] `scripts/mapping/institution-mapping.json` reflektiert die Änderung
      (alte→neue IDs, falls Umbenennung).
- [ ] Lokaler `npm run data:fetch:force`-Lauf hat keine unerwarteten
      Konflikte produziert.
- [ ] PR-Beschreibung nennt die offizielle Quelle (Stadtratsbeschluss,
      Gemeinderatsbeschluss, Medienmitteilung mit Datum).

### Bei White-Label / neuer Stadt

- [ ] `npm run scaffold:city <id> "<name>"` als Basis verwendet.
- [ ] Platzhalter-Werte in `config/city.config.<id>.json` (`TODO-<id>.example`,
      …) durch echte URLs/Domains ersetzt.
- [ ] PORTING.md-Checkliste durchgearbeitet.
- [ ] Brand-Glyph ist ein abstraktes Symbol, **nicht das offizielle
      Wappen** der Stadt (Anti-Staatsemblem-Policy).

---

## Öffentliches Issue / Privacy

- [ ] Diese Änderung enthält keine persönlichen Daten.
- [ ] Wenn ich mich auf eine konkrete Verwaltungssituation beziehe, habe
      ich sie abstrahiert — keine Namen, Adressen, Case-Nummern.
