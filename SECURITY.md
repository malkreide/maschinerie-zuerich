# Sicherheitsmeldungen

Wenn du einen Sicherheitsaspekt entdeckst, bitte **nicht** als öffentliches
Issue melden. Stattdessen:

1. GitHub «Private Vulnerability Reporting» nutzen (Tab «Security» des Repos),
   **ODER**
2. E-Mail an den Maintainer-Account (siehe Profil des Repo-Owners auf GitHub).

## Was als «sicherheitsrelevant» gilt

- Cross-Site-Scripting über Eingaben (Lebenslagen-Frage, Suche)
- Injection in URLs (`?focus=`, `?q=`) → unerwartete Navigationen
- Cookie-Probleme beim Theme-State
- Abhängigkeits-CVEs in `package.json`
- Leaking von Daten ausserhalb der öffentlichen Datensätze

## Was nicht

- Datenfehler (falsche Zuordnung, veraltete Zahlen) — dafür normales Issue
- Der im Repo enthaltene API-Key `vopVcmhIMkeUCf8gQjk1GgU2wK+gGgU2wK...` für
  `data.stadt-zuerich.ch` ist **öffentlich** und Teil der Dataset-Dokumentation
  von Stadt Zürich — kein Geheimnis, keine Meldung nötig

## Reaktionszeit

Ich versuche, innerhalb einer Woche zu reagieren. Für kritische Issues mit
aktiver Ausnutzung bitte im Titel «urgent» markieren.
