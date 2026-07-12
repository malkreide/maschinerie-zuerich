import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const departmentName = searchParams.get('q') || '';

  // Echte API anfragen (PARIS API des Zürcher Gemeinderats)
  try {
    // Die API verlangt oft komplexe CQL Queries. 
    // Wir versuchen eine einfache Suche nach Suchtext,
    // beenden aber nach 3 Sekunden den Fetch, um das UI nicht zu blockieren.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Endpoint für Geschäfte (Beispielhafte Abfrage)
    const apiUrl = `https://www.gemeinderat-zuerich.ch/api/Geschaeft?Suchtext=${encodeURIComponent(departmentName)}`;
    
    const response = await fetch(apiUrl, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/xml'
      }
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const xmlData = await response.text();
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(xmlData);
      
      // Die genaue XML-Struktur der PARIS API kann variieren.
      // Wir gehen von einer Liste von "Geschaeft" aus.
      let items = parsed?.Geschaefte?.Geschaeft || parsed?.ArrayOfGeschaeft?.Geschaeft || [];
      if (!Array.isArray(items)) {
        items = [items];
      }

      const formattedItems = items.slice(0, 5).map((item: Record<string, unknown>) => ({
        id: item.Id || item.Geschaeftsnummer || Math.random().toString(),
        titel: item.Titel || item.Gegenstand || "Ohne Titel",
        geschaeftsart: item.Geschaeftsart || "Geschäft",
        datum: item.Datum || new Date().toISOString().split('T')[0],
        link: item.Url || `https://www.gemeinderat-zuerich.ch/geschaefte/detailansicht-geschaeft?gId=${item.Id}`
      }));

      if (formattedItems.length > 0) {
        return NextResponse.json(formattedItems);
      }
    }
  } catch (error) {
    console.error("RIS API Fetch Fehler:", error);
  }

  // Kein Fallback auf fiktive Geschäfte: Wenn die echte API nicht antwortet,
  // keine Treffer hat oder CORS/Timeout greift, geben wir bewusst eine leere
  // Liste zurück. Das Frontend zeigt dann "keine Daten" plus einen Link zur
  // offiziellen Geschäfts-Suche. Erfundene parlamentarische Geschäfte dürfen
  // niemals wie offizielle Stadtinformation wirken.
  return NextResponse.json([]);
}
