// cytoscape-fcose liefert keine Typdefinitionen mit.
// Ambient-Declaration damit TS den Default-Import akzeptiert; die Lib wird
// in GraphView nur an cytoscape.use() übergeben, konkrete Typen sind hier
// nicht nötig.
declare module 'cytoscape-fcose';
