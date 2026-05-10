# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Mobile-First Ansicht:** Die hierarchische Listenansicht (`ListView`) wird nun auf mobilen Endgeräten (bis 640px) als Standard anstelle des interaktiven D3/Cytoscape-Graphen angezeigt, um das "Fat-Finger"-Problem zu umgehen. 
- **Responsive Layout:** Das UI passt sich nun auf Smartphones automatisch an (scrollbare Tabs im Header, angepasste Breiten der Detail- und Such-Panels).
- **Legende:** Die Legende ist auf mobilen Geräten standardmäßig als einklappbares Menü dargestellt (`<details>`), um wertvollen Platz zu sparen.
- **Budget-Zusammenfassung:** Die Budget-Übersichtspille ist mobil an den unteren Bildschirmrand verlagert, um nicht mit der Navigation/Suche zu überlappen.

### Fixed
- **Cytoscape Resize Bug:** Verhindert Abstürze/Render-Fehler von Cytoscape, wenn der Graph-Container beim initialen Laden unsichtbar (`display: none`) ist, mittels `ResizeObserver`.
- **Lint Errors:** Behoben: Veraltete Eslint-Directive-Warnungen entfernt und TypeScript `any`-Typen im Legend-Component präzisiert.
