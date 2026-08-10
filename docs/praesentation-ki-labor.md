# Präsentationsdrehbuch: KI-Fachgruppe & Smart City

**Zweck:** Die Maschinerie so vorstellen, dass Zweck, Ziele und Funktionsweise in
zwanzig Minuten sitzen — und ein konkretes Experiment fürs geplante KI-Labor
vorschlagen.

**Status:** Arbeitsdokument, kein Datenvertrag. Alle Zahlen sind aus dem Repo
erhoben (Stand 2026-08-10) und beim nächsten Einsatz neu zu prüfen.

---

## Die eine Botschaft

> Das Sprachmodell darf Struktur vorschlagen. Es darf keine Frist und keine
> Gebühr behaupten. Genau dieses Verbot macht KI in einem rechtlich heiklen Feld
> einsetzbar.

Wenn nach zwanzig Minuten nur ein Satz hängen bleibt, soll es dieser sein. Jede
Folie zahlt darauf ein: die Demo zeigt, wofür es gut ist, die Falle zeigt, warum
es nötig ist, die Gates zeigen, dass es hält.

---

## Dramaturgie (20 Minuten)

Zeigen, dann erklären — nie umgekehrt. Erst der Nutzen, den man sieht, dann das
Risiko, das man nicht sieht, dann der Mechanismus, der es einfängt. Wer mit der
Architektur beginnt, verliert den Raum in Minute drei.

| Zeit | Inhalt | Folien |
|---|---|---|
| 0–2′ | Aufhänger und die eine Botschaft | 1–2 |
| 2–5′ | Live-Demo | 3 |
| 5–7′ | Stand in Zahlen, warum Handarbeit nicht skaliert | 4–5 |
| 7–11′ | **Herzstück:** die Falle und die Kardinalregel | 6–7 |
| 11–15′ | Funktionsweise, Gates, abgestufte Autonomie | 8–10 |
| 15–18′ | Das übertragbare Muster, Experimentvorschlag | 11–12 |
| 18–20′ | Grenzen offenlegen, dann der Ask | 13–14 |

### Notfallvariante (5 Minuten)

Traktanden verschieben sich. Diese vier tragen die Botschaft allein — alles
andere ersatzlos streichen, nicht schneller sprechen.

1. **Folie 6** — die Falle (der falsch zugeordnete 30-Tage-Fall).
2. **Folie 7** — «Link, don't assert» und der Linter, der sie durchsetzt.
3. **Folie 3** — 60 Sekunden live: Suche → Prozessgraph → Reference anklicken.
4. **Folie 12** — der Experimentvorschlag.

### Demo-Checkliste

Alle Tabs vorher öffnen und einmal durchklicken.

- [ ] Startseite mit interaktivem Organigramm
- [ ] `/steuerfranken` — Treemap
- [ ] Lebenslagen-Suche, Suchfeld leer
- [ ] `/prozesse/zh/hund-anmelden` — der einfache Fall
- [ ] `/prozesse/zh/baugesuch` — Hochrisiko-Disclaimer sichtbar
- [ ] `/api/v1/prozesse` — rohes JSON
- [ ] Sprachumschalter einmal auf Leichte Sprache
- [ ] Screenshots als Fallback, falls Netz oder Preview streiken

**Regieanweisung:** Nicht die ganze App vorführen. *Ein* Klickpfad, durchgehend:
Suchfeld → Lebenslage → Prozessgraph → Klick auf eine Reference → die amtliche
Quelle öffnet sich. Dieser Pfad ist das Argument.

---

## Folien

### 1 — Titel (≈ 45 Sek)

**Die Maschinerie.** Verwaltungsprozesse als Karte — und ein KI-Verfahren, das
nichts behaupten darf.

*Sprechtext:* Drei Dinge ankündigen — Nutzen für Bürger:innen, Funktionsweise der
KI, und warum sie in einem rechtlich heiklen Feld eingesetzt werden darf. Die
kürzeste Fassung vorwegnehmen. **Gleich zu Beginn sagen, dass es ein privates
Projekt ohne offiziellen Auftrag ist** — das entwaffnet die Frage, die sonst die
ganze Zeit im Raum steht.

### 2 — Zweck (≈ 75 Sek)

**Die Verwaltung ist öffentlich. Verständlich ist sie damit noch nicht.**

| Frage | Heutige Antwort |
|---|---|
| «Wie ist diese Stadt organisiert?» | Organigramm als PDF, ohne Bezug zu Geld oder Stellen |
| «Wohin geht mein Steuerfranken?» | Die Rechnung als Tabellenwerk — korrekt, vollständig, unlesbar |
| «Was muss ich tun, um X zu erledigen?» | Merkblatt-Prosa über mehrere Ämter, Kanton und Bund verteilt |

→ **Die Daten sind längst offen. Was fehlt, ist die Karte.**

*Sprechtext:* Bewusst **keine** Strategie-Folie hier. Die Rückbindung (Zürich
2040, Digitalisierungsstrategie, Service Standard, Smart City) ist dokumentiert
und wird auf Nachfrage nachgereicht — vorangestellt wirkt sie wie eine
Legitimationssuche.

### 3 — Demo (≈ 3 Min, live)

Nicht vorlesen. Landkarte für den Klickpfad:

1. **Organigramm als interaktiver Graph** — Departemente bis Beteiligungen, mit
   Budget und Stellenwerten aus offenen Daten.
2. **«Wohin geht mein Steuerfranken?»** — Treemap auf Ist-Werten aus dem
   Geschäftsbericht, nicht auf Budgetzahlen.
3. **Lebenslagen-Suche** — Alltagssprache statt Verwaltungssprache.
4. **Prozessgraph** — gerichteter Graph aus Schritten mit
   Vorgängerbeziehungen, Akteuren, Unterlagen und belegten Verweisen.

Nebenbei erwähnen, nicht ausbreiten: fünf Sprachen inkl. Leichter Sprache, ohne
JavaScript bedienbar, Screenreader-Tabelle hinter dem Graphen, offene REST-API
unter `/api/v1`, Deep-Links.

*Sprechtext:* Wenn Zeit bleibt, einmal auf Leichte Sprache umschalten — der Graph
räumt sich auf, Boxen und Schrift werden grösser. Barrierefreiheit als Verhalten,
nicht als Häkchen.

### 4 — Stand (≈ 60 Sek)

**Kein Konzept. Ein laufender Stand.**

| 17 | 193 | 56 | 5 | 0 |
|---|---|---|---|---|
| Prozesse | Schritte | belegte Verweise | Sprachen inkl. LS | automatische Merges |

- Nutzennachweis **förmlich abgenommen am 2026-06-29** — erst danach wurde die
  Automatisierung freigegeben. Die Reihenfolge war ein Gate, kein Vorsatz.
- Auf offenen Daten gebaut, ohne neue Infrastruktur (CC-BY 4.0).
- Abgeleitete Werte werden geprüft: Stellen pro Einheit sind ein Näherungswert
  aus dem Personalaufwand, gegen den publizierten Wert des Steueramts geprüft
  (227 vs. 222 = 2 % Abweichung) — und auch als Näherungswert beschriftet.

*Sprechtext:* Die Null ist die wichtigste Zahl auf der Folie: nichts geht ohne
Mensch nach `main`.

### 5 — Warum KI (≈ 60 Sek)

**17 Prozesse sind der Beweis. Die Lösung sind sie nicht.**

- Von Hand modellieren kostet: lesen, modellieren, jeden bindenden Wert wörtlich
  belegen, in fünf Sprachen ausformulieren.
- Die Stadt hat hunderte Lebenslagen — bei diesem Tempo ein Jahrzehntprojekt.
- Und der Boden bewegt sich: Beim ersten Live-Check waren **25 hinterlegte Links
  tot**. Pflege ist kein Restposten, sondern der Hauptaufwand.

→ **Skalieren heisst extrahieren. Extrahieren heisst Sprachmodell. Und genau da
fängt das Risiko an.**

*Sprechtext:* Wir sind nicht aus Begeisterung für KI bei KI gelandet, sondern
weil Handarbeit nachweislich nicht reicht. Für dieses Gremium der glaubwürdigere
Einstieg.

### 6 — Das Risiko (≈ 2 Min, Herzstück)

**Der gefährlichste Output ist nicht der Fehlschlag. Es ist der plausible
Treffer.**

Realer Fall aus der Arbeit am Repo:

- **Gesucht:** der Beleg für «Einsprache gegen die Veranlagung — innert 30 Tagen».
- **Gefunden:** die richtige amtliche Steuerseite, mit der korrekten Wendung
  «innert 30 Tagen». Nur gehörte diese Frist zur **Bezahlung** der Steuerrechnung
  (§ 178) und nicht zur **Einsprache** gegen die Veranlagung (§ 140).
- Richtige Domain, richtiges Gesetz, richtige Zahl, falsche Zuordnung. Kein
  Warnzeichen an keiner Stelle.

Dieselbe Fehlerklasse: Pass ≠ Identitätskarte (andere Gebühr), Erwachsene ≠
Kinder (andere Gültigkeit).

→ **Ein sichtbarer Fehler wird korrigiert. Dieser hier wird geglaubt** — und
jemand verpasst darauf gestützt eine Rechtsmittelfrist.

*Sprechtext:* Langsam sprechen; das ist die Folie, an die sich der Raum morgen
noch erinnert. Danach eine Pause — die nächste Folie ist die Antwort und wirkt
nur, wenn die Frage kurz stehen bleibt.

### 7 — Die Antwort (≈ 2 Min, Herzstück)

**Link, don't assert.**

Bindende Werte — Fristen, Gebühren, Rekursfristen — erscheinen nie als
eigenständiger, gerenderter Wert. Nur als Reference: Bezeichnung, Deep-Link auf
die exakte Originalseite, und der wörtliche Satz von dort.

| Verboten — behauptet | Vertrag — belegt |
|---|---|
| Schritt-Label: «Einsprache innert 30 Tagen erheben» | Schritt-Label: «Einsprache erheben» |
| Die Zahl steht im Produkt und ist damit unsere eigene Aussage — ohne Quelle, ohne Datum, ohne Kontext | Der Schritt verweist auf eine Reference: Bezeichnung + Deep-Link + wörtliches Zitat. **Dort** lebt die Zahl |
| Wenn falsch: realer Schaden | Nachprüfbar — und es fällt auf, wenn sich die Quelle ändert |

**Der entscheidende Konstruktionsgriff:** Im Datenmodell gibt es *kein Feld* für
«Frist als Zahl». Was nicht existiert, kann nicht halluziniert werden. Ein Linter
prüft bei jedem Commit, dass in keinem Schritt-Label eine bindende Zahl steht —
sonst wird der Build rot.

*Sprechtext:* «Wir haben dem Modell die riskante Aussage nicht verboten — wir
haben ihr den Platz weggenommen.» Falls jemand einwendet, das sei unbequem für
Nutzende: Ja. Und es ist der Grund, warum man das Ding öffentlich zeigen kann.
Ein Wert ohne Quelle ist kein Service, sondern ein Risiko mit Benutzeroberfläche.

### 8 — Funktionsweise (≈ 2 Min)

**Zwei Systeme, ein Vertrag, vier Stufen.**

```
Amtliche Quellen  →  Extraktion (Python)      →  Mechanische Gates (CI)  →  Mensch  →  Öffentliche Ansicht
  Stadt · Kanton      1 Quelle finden             Schema · Belegpflicht      Review      Graph, 5 Sprachen,
  Bund · Erlasse      2 Seite beschaffen          Kardinalregel-Lint         jeder       offene API
  offene Daten        3 Passage vorschlagen       Regressionsschutz          Änderung
                      4 Urteil — oder Abstinenz   Link-Prüfung               kein
                                                                             Auto-Merge
                            ↑─────────────  rote Prüfung = harter Stopp ─────┘
```

- Die Extraktion liefert bewusst **nur Struktur**: deutsche Schritte und
  Abhängigkeiten, Übersetzungsfelder leer. Bestehende geprüfte Texte werden
  feldweise zusammengeführt und nie überschrieben.
- Der **Datenvertrag ist kanonisch** und liegt bei der Visualisierung (JSON-Schema
  mit Version). Weicht die Extraktion ab, gilt der Vertrag — nicht umgekehrt.

*Sprechtext:* Die Trennung ist der Punkt. Der Agent hat auf das publizierende
System nur Schreibrecht in Form eines Vorschlags. Die vierte Stufe hervorheben:
Die ersten drei sind gut automatisierbar; die vierte — belegt diese Passage
*genau* den behaupteten Wert? — ist die gefährliche. Deshalb steht sie separat
und darf mit «weiss nicht» enden.

### 9 — Die Leitplanken (≈ 75 Sek)

**Mechanische Prüfungen sind verlässlicher als das Urteil des Modells.**

| Prüfung | Was sie verhindert |
|---|---|
| Schema- und Vertragsvalidierung | Struktur ausserhalb des Vertrags; Verweise ohne wörtlichen Beleg |
| Kardinalregel-Lint | Eine bindende Zahl, die sich in ein Label oder eine Beschreibung geschlichen hat |
| Regressionsschutz | Dass eine automatische Lieferung geprüfte Texte leert; gemergt wird feldweise |
| Link-Prüfung, zeitgesteuert | Dass tote Quellen unbemerkt stehen bleiben (tot ≠ blockiert ≠ Netzfehler) |
| Kein automatischer Merge | Dass irgendetwas ohne menschliche Freigabe öffentlich wird |

→ **Rote Prüfung heisst harter Stopp. Der Agent wird so gebaut, dass er die Gates
erfüllt — nicht so, dass er sie umgeht.**

*Sprechtext:* Der am ehesten übertragbare Teil. Falls nach der Ausnahmemöglichkeit
im Regressionsschutz gefragt wird: Ja, sie existiert, ist begründungspflichtig
und ausdrücklich kein Weg, den Schutz zu umgehen.

### 10 — Governance (≈ 60 Sek)

**Autonomie wird nach Risiko abgestuft, nicht ein- oder ausgeschaltet.**

| Aufgabe | Autonomie | Begründung |
|---|---|---|
| Struktur: Schritte, Abhängigkeiten, Akteure | Vorschlag automatisch, Review leicht | Fehler sichtbar und billig |
| Übersetzungen, Leichte Sprache | Vorschlag automatisch, Fachreview | Fehler ärgerlich, nicht bindend |
| Bindende Rechtswerte | Nur Vorschlag, nie automatisch | Fehler = realer Schaden |
| Hochrisiko: Baugesuch, Sozialhilfe, Veranstaltung | Erhöhter Review, sichtbarer Warnhinweis | Höchstes Reputationsrisiko |

**Voreinstellung: Abstinenz.** Bei Mehrdeutigkeit wird nicht publiziert, sondern
als offen markiert — mit Begründung.

*Sprechtext:* «Darf der Agent das?» ist falsch gestellt. Richtig ist: «Bei welcher
Aufgabe darf er wie weit gehen?» In der Verwaltung ist eine Lücke ein bekannter
Zustand; eine falsche Angabe ist ein neues Problem.

### 11 — Das Angebot (≈ 75 Sek)

**Das Muster ist die Lieferung. Nicht die App.**

1. Ein **kanonischer Datenvertrag**, maschinenlesbar und versioniert — statt eines
   Prompts, an den man glaubt.
2. Eine **Kardinalregel**, die dem Modell die riskante Aussage strukturell
   verunmöglicht, statt sie ihm zu untersagen.
3. **Mechanische Gates** statt Vertrauen in die Selbsteinschätzung des Modells.
4. **Risikoabgestufte Autonomie** statt der Frage, ob KI eingesetzt wird.
5. **Der Mensch genau dort, wo Haftung entsteht** — und nur dort, damit das Review
   nicht zur Attrappe wird.

→ Anwendbar auf jede Domäne, in der die Verwaltung verbindliche Aussagen macht.

*Sprechtext:* Punkt 5 absichern: Menschliches Review wirkt nur, wenn es selten und
gezielt ist. Wer alles reviewen lässt, bekommt Durchwinken.

### 12 — Experimentvorschlag (≈ 2,5 Min)

**Ein enges Experiment, das in acht Wochen eine belastbare Antwort liefert.**

> **Die Frage:** Wie viel Prozessstruktur kann ein Agent liefern, ohne dass die
> Verwaltung dabei Haftungsrisiko übernimmt?

**Aufbau**

- Fünf Prozesse aus einem Bereich, den die Fachgruppe wählt — gern einen, der als
  mühsam gilt.
- Die Extraktion läuft und liefert Vorschläge als Pull Requests, struktur-only.
- Fachpersonen reviewen gegen die bestehenden Gates. Nichts geht ohne Freigabe live.
- Ergebnis öffentlich im Preview, durchgehend als inoffiziell gekennzeichnet.

**Was die Fachgruppe beisteuert**

- Die Auswahl der fünf Prozesse.
- Rund zwei Stunden Fachreview je Prozess — insgesamt etwa ein Personentag.
- Eine Ansprechperson für die Rückfragen, die der Agent bewusst offenlässt.
- Einverständnis, dass das Ergebnis als inoffizielle Darstellung öffentlich ist.

**Messgrössen — vorher festgelegt, nachher nicht verhandelbar**

| Kennzahl | Definition | Zielwert |
|---|---|---|
| Abstinenztreue | Anteil bindender Werte ohne eigene Behauptung des Agenten | **100 %** — jede Verletzung ist ein Abbruchkriterium, keine Kennzahl |
| Strukturpräzision | Anteil vorgeschlagener Schritte, die ohne inhaltliche Korrektur übernommen werden | Zu erheben — die eigentliche offene Frage |
| Belegquote | Anteil Verweise mit verifiziertem wörtlichem Zitat an der Live-Quelle | Höher ist besser, nachrangig gegenüber Abstinenztreue |
| Reviewaufwand | Minuten pro Prozess, gegen Handmodellierung gemessen | Deutlich unter Handarbeit, sonst trägt das Verfahren nicht |
| Quellenstabilität | Anteil Quell-URLs, die nach 90 Tagen noch erreichbar sind | Zu erheben — bestimmt den Pflegeaufwand |

**Was am Ende vorliegt:** ein laufender öffentlicher Preview mit den fünf
Prozessen, ein Bericht mit den fünf Kennzahlen gegen die vorab gesetzten Ziele,
und die Gate-Konfiguration als wiederverwendbare Vorlage. **Auch ein Nein ist ein
verwertbares Ergebnis** — dann wissen wir belegt, wo die Grenze liegt.

*Sprechtext:* Bewusst etwas Kleines vorschlagen. Die Abstinenztreue als
Abbruchkriterium formulieren, nicht als Zielwert — das ist der Punkt, an dem eine
Fachgruppe merkt, dass hier jemand mit Risiko gerechnet hat und nicht mit Erfolg.
Ausdrücklich sagen: Ein negatives Ergebnis wird publiziert.

### 13 — Grenzen (≈ 60 Sek)

**Was es nicht ist.**

- **Kein offizielles Angebot der Stadt.** Privates Open-Source-Projekt ohne
  Auftrag; jede Prozessseite trägt einen sichtbaren Hinweis.
- **Keine Rechtsauskunft.** Verbindlich ist ausschliesslich die verlinkte amtliche
  Quelle. Genau deshalb die Kardinalregel.
- **Kein amtlicher Digitalisierungsgrad.** Die Bewertung ist ein Ist-Schnappschuss
  der Modelldaten und wird so beschriftet. Kein Indikator wird geraten — was nicht
  belegt oder berechnet ist, steht als unbekannt.
- **Offene Punkte:** FR/IT-Erstbefüllung braucht Muttersprachen-Review, Leichte
  Sprache ein Fachreview, tabellarische Gebühren aus Tarif-Widgets sind ungelöst —
  dort wird konsequent abstiniert.

*Sprechtext:* **Diese Folie kommt vor den Fragen, nicht danach.** Wer die Grenzen
selbst nennt, bevor jemand sie sucht, gewinnt den Rest der Diskussion. Und: Die
offenen Punkte sind genau die Stellen, an denen ein Labor helfen könnte.

### 14 — Der Ask (≈ 45 Sek)

1. **Klein:** fünf Prozesse und je zwei Stunden Fachreview für das Experiment.
2. **Mittel:** zusätzlich eine Fachstelle als Gesprächspartnerin für die
   Hochrisikofälle.
3. **Gross:** wenn das Muster trägt, wird die Gate-Konfiguration zur Vorlage für
   weitere KI-Vorhaben im Labor.

→ **Belegen statt behaupten. Wenn das Muster hält, ist es mehr wert als die App.**

*Sprechtext:* Mit der kleinsten Variante schliessen und dort stehen bleiben. Ein
Personentag ist im Raum entscheidbar, ein Grundsatzentscheid nicht — und ein
vertagter Grundsatzentscheid ist ein toter Termin. Danach schweigen.

---

## Anhang: die harten Fragen

**Warum nicht einfach ein Chatbot auf den Stadtseiten?**
Ein Chatbot behauptet — das ist seine Funktionsweise. Hier ist Behaupten
strukturell ausgeschlossen: Der Wert existiert nur innerhalb eines wörtlichen
Zitats mit Link. Dazu zeigt ein Graph Reihenfolge, Abhängigkeiten und Rücksprünge,
ein Chatfenster nicht. Beides lässt sich kombinieren — die geprüfte Struktur muss
zuerst da sein.

**Wer haftet, wenn etwas falsch ist?**
Bei bindenden Werten steht keiner drin, der falsch sein könnte — deshalb ist die
Kardinalregel keine Kosmetik, sondern die Haftungsarchitektur. Falsch zugeordnete
Struktur ist korrigierbar, als inoffiziell gekennzeichnet und führt nicht zu einer
Fristversäumnis.

**Was, wenn das Modell die Quelle falsch liest?**
Dann greift die Belegpflicht in der Validierung, oder das menschliche Review, oder
der Wert wird gar nicht publiziert. Voreinstellung bei Mehrdeutigkeit ist Abstinenz
mit Begründung, nicht der beste Rateversuch.

**Wie schnell veralten die Daten?**
Ständig. stadt-zuerich.ch hat die URL-Struktur umgestellt, kantonale Seiten sind
verschoben, eine Bundesseite war innerhalb weniger Tage erst erreichbar und dann
weg. Beim ersten Live-Check waren 25 Links tot. Deshalb läuft die Link-Prüfung
zeitgesteuert und unterscheidet tot / blockiert / Netzfehler — sonst erscheinen
Umgebungsprobleme als Datenfehler.

**Was kostet das die Stadt?**
Im Experiment nur Reviewzeit, rund ein Personentag. Keine Beschaffung, keine neue
Infrastruktur, keine neue Datenerhebung.

**Und der Datenschutz?**
Keine Personendaten. Der Rückkanal für Feedback ist datensparsam, es stehen keine
Personendaten in URLs, Query-Strings oder Logs, die öffentliche Roadmap wird ohne
Personenbezug erzeugt.

**Warum zwei getrennte Systeme statt eines?**
Weil die Trennung die Sicherheitseigenschaft ist. Die Extraktion hat keinen
Schreibzugriff auf die publizierte Darstellung — sie kann ausschliesslich einen
Vorschlag einreichen, der durch Prüfungen und ein menschliches Review muss.

---

## Anhang: Anschlussfähigkeit (nur auf Nachfrage)

Das Projekt ist bottom-up entstanden. Die Rückbindung ist in
[`docs/bewertung-strategiebezug.md`](bewertung-strategiebezug.md) dokumentiert und
ehrlich abgestuft — wo ein Anker schwach oder nicht vorhanden ist, steht das dort.

| Bezug | Beitrag |
|---|---|
| Strategien Zürich 2040 | Verwaltung als Ganzes sichtbar — Transparenz über Strukturen, Budgets, Stellen |
| Digitalisierungsstrategie der Stadt | Nutzerzentrierter Dienst: Struktur in Alltagssprache, barrierefrei, mehrsprachig |
| Service Standard (Nutzendenzentrierung) | Liefert die einzige messbare Norm der Referenzdokumente (WCAG 2.1 AA) sowie leicht verständliche Sprache |
| Smart City Zürich | Leichtgewichtiger Pilot: offene Daten ohne neue Infrastruktur zu einem Dienst kombiniert |
| Digitale Schweiz | Konkrete Nachnutzung von OGD, bewusst auf andere Schweizer Städte übertragbar |

**Sprachregelung:** Kontext, nicht Autorität. Erst zeigen, wenn danach gefragt
wird — eine Präsentation, die mit Strategiezitaten beginnt, wirkt, als suche sie
Erlaubnis.

---

## Quellen der Zahlen

| Zahl | Herkunft |
|---|---|
| 17 Prozesse, 193 Schritte, 56 Verweise | `stadt-zuerich-next/data/prozesse/zh/*.json`, erhoben 2026-08-10 |
| Nutzennachweis abgenommen 2026-06-29 | [`docs/v0-gate.md`](v0-gate.md) |
| 25 tote Links beim ersten Live-Check | [`docs/agent-lessons.md`](agent-lessons.md), Abschnitt B.1 |
| § 140 / § 178, Einsprache vs. Bezahlung | [`docs/agent-lessons.md`](agent-lessons.md), Abschnitt B.5 |
| FTE-Proxy 227 vs. 222 publiziert | [`README.md`](../README.md), Abschnitt Datenquellen |
| Gates und Kardinalregel | [`CLAUDE.md`](../CLAUDE.md), [`docs/process-data-contract.md`](process-data-contract.md) |
