import type { Budget, Fte } from '@/types/stadt';

export interface ExportNode {
  id: string;
  name: string;
  type: string;
  parent: string | null;
  budget?: Budget;
  fte?: Fte;
}

/**
 * Wandelt ein Array von ExportNodes in einen CSV-String um und triggert
 * direkt einen Browser-Download.
 */
export function downloadNodesAsCSV(nodes: ExportNode[], filename = 'maschinerie-zuerich-export.csv') {
  if (!nodes || nodes.length === 0) return;

  // Header
  const headers = ['ID', 'Name', 'Typ', 'Uebergeordnet', 'Budget_Aufwand', 'Budget_Ertrag', 'Budget_Nettoaufwand', 'Budget_Jahr', 'FTE', 'FTE_Jahr'];
  const rows: string[] = [headers.join(',')];

  // Rows
  for (const n of nodes) {
    const row = [
      escapeCSV(n.id),
      escapeCSV(n.name),
      escapeCSV(n.type),
      escapeCSV(n.parent ?? ''),
      n.budget?.aufwand ?? '',
      n.budget?.ertrag ?? '',
      n.budget?.nettoaufwand ?? '',
      n.budget?.jahr ?? '',
      n.fte?.schaetzung ?? '',
      n.fte?.jahr ?? ''
    ];
    rows.push(row.join(','));
  }

  const csvContent = rows.join('\n');
  
  // Create Blob and trigger download
  const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // \ufeff is BOM for Excel UTF-8 support
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSV(val: string): string {
  if (val == null) return '';
  const str = String(val);
  // Wenn der String ein Komma, ein Newline oder Anführungszeichen enthält, muss er in Quotes gesetzt werden
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
