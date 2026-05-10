import { NextResponse } from 'next/server';
import { loadStadtData } from '@/lib/data';

// Offene API: Erlaubt den Zugriff von allen Domains (CORS)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET() {
  try {
    const data = await loadStadtData();
    return NextResponse.json(data, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Fehler beim Laden der Strukturdaten:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
