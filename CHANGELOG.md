# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Geführte Tour für Erstnutzer:** Beim ersten Besuch oder durch Klick auf das `?` im Header startet nun eine interaktive Guided Tour, welche die UI-Elemente erklärt.
- **Leichte Sprache (Graph Layout):** Bei Sprachwahl `ls` ("Leichte Sprache") wird nicht nur der Text vereinfacht, sondern auch der Graph signifikant entrümpelt (Stäbe und Beteiligungen ausgeblendet) und die Boxen/Schriften massiv vergrössert, um die Kognition zu entlasten.
- **Hierarchisches Nesting (Compound Nodes):** Dienstabteilungen und Stäbe werden in Cytoscape nun visuell *innerhalb* der Box ihres zugehörigen Departements dargestellt. Das räumt den Graphen massiv auf und reduziert den "Spaghetti-Effekt". Beteiligungen und externe Betriebe bleiben als Satelliten erhalten.
- **Mobile-First Ansicht:** Die hierarchische Listenansicht (`ListView`) wird nun auf mobilen Endgeräten (bis 640px) als Standard anstelle des interaktiven D3/Cytoscape-Graphen angezeigt, um das "Fat-Finger"-Problem zu umgehen. 
- **Responsive Layout:** Das UI passt sich nun auf Smartphones automatisch an (scrollbare Tabs im Header, angepasste Breiten der Detail- und Such-Panels).
- **Legende:** Die Legende ist auf mobilen Geräten standardmäßig als einklappbares Menü dargestellt (`<details>`), um wertvollen Platz zu sparen.
- **Budget-Zusammenfassung:** Die Budget-Übersichtspille ist mobil an den unteren Bildschirmrand verlagert, um nicht mit der Navigation/Suche zu überlappen.

### Fixed
- **Cytoscape Resize Bug:** Verhindert Abstürze/Render-Fehler von Cytoscape, wenn der Graph-Container beim initialen Laden unsichtbar (`display: none`) ist, mittels `ResizeObserver`.
- **Lint Errors:** Behoben: Veraltete Eslint-Directive-Warnungen entfernt und TypeScript `any`-Typen im Legend-Component präzisiert.
