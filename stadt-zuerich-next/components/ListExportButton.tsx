'use client';

import { downloadNodesAsCSV, type ExportNode } from '@/lib/export';
import type { StadtData } from '@/types/stadt';

interface Props {
  data: StadtData;
  locale: string;
  label: string;
}

export default function ListExportButton({ data, locale, label }: Props) {
  const handleExport = () => {
    const isLs = locale === 'ls';
    const nodes: ExportNode[] = [];

    // Center
    nodes.push({
      id: data.center.id,
      name: data.center.name,
      type: 'center',
      parent: null
    });

    // Departments
    for (const dep of data.departments) {
      nodes.push({
        id: dep.id,
        name: dep.name,
        type: 'department',
        parent: data.center.id,
        budget: dep.budget,
        fte: dep.fte
      });

      // Units
      const units = data.units.filter(u => u.parent === dep.id);
      for (const u of units) {
        if (isLs && u.kind !== 'unit') continue;
        nodes.push({
          id: u.id,
          name: u.name,
          type: u.kind,
          parent: dep.id,
          budget: u.budget,
          fte: u.fte
        });
      }

      // Beteiligungen (Satelliten)
      if (!isLs) {
        const bets = data.beteiligungen.filter(b => b.verbunden === dep.id);
        for (const b of bets) {
          nodes.push({
            id: b.id,
            name: b.name,
            type: 'beteiligung',
            parent: dep.id,
            budget: b.budget,
            fte: b.fte
          });
        }
      }
    }

    downloadNodesAsCSV(nodes, `maschinerie-zuerich-liste-${locale}.csv`);
  };

  return (
    <button
      onClick={handleExport}
      className="mt-2 mb-6 px-3 py-1.5 text-xs bg-transparent border border-[var(--color-line)] rounded hover:bg-[var(--color-bg)] text-[var(--color-ink)] transition-colors cursor-pointer"
    >
      {label}
    </button>
  );
}
