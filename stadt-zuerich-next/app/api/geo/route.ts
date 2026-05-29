import { NextResponse } from 'next/server';

// Koordinaten Raum Zürich
// Lat: ~47.35 bis 47.41, Lng: ~8.48 bis 8.58
function getRandomZrhCoord() {
  const lat = 47.35 + Math.random() * 0.06;
  const lng = 8.48 + Math.random() * 0.1;
  return [lng, lat]; // GeoJSON expects [longitude, latitude]
}

function generateFeatures(count: number, type: string, namePrefix: string, department: string) {
  return Array.from({ length: count }).map((_, i) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: getRandomZrhCoord()
    },
    properties: {
      id: `${type}-${i}`,
      name: `${namePrefix} ${i + 1}`,
      department: department
    }
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const layer = searchParams.get('layer');

  let features: ReturnType<typeof generateFeatures> = [];

  if (layer === 'schools' || !layer) {
    features = features.concat(generateFeatures(40, 'school', 'Schulhaus', 'SSD'));
  }
  if (layer === 'recycling' || !layer) {
    features = features.concat(generateFeatures(30, 'recycling', 'Entsorgungsstelle', 'TED'));
  }
  if (layer === 'playgrounds' || !layer) {
    features = features.concat(generateFeatures(60, 'playground', 'Spielplatz', 'GUD'));
  }

  return NextResponse.json({
    type: 'FeatureCollection',
    features
  });
}
