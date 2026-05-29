'use client';

import { useEffect, useState } from 'react';

type WaterData = {
  timestamp: string;
  values: {
    water_temperature: { value: number; unit: string };
    air_temperature: { value: number; unit: string };
  };
};

export default function LiveClimateWidget({ 
  gudBudgetDelta = 0,
  onGudBudgetDeltaChange = () => {}
}: {
  gudBudgetDelta?: number;
  onGudBudgetDeltaChange?: (val: number) => void;
}) {
  const [data, setData] = useState<WaterData | null>(null);
  const [loading, setLoading] = useState(true);

  // Das Basisbudget für das GUD gemäss org-chart.json (Nettoaufwand ca. 2.6 Mia)
  const GUD_BASE_BUDGET_MIO = 2637;

  useEffect(() => {
    // Try fetching from Tecdottir Open Data API (Wasserschutzpolizei Mythenquai)
    fetch('https://tecdottir.herokuapp.com/measurements/mythenquai')
      .then(res => res.json())
      .then(res => {
        if (res.result && res.result.values) {
          setData(res.result);
        } else {
          throw new Error('Invalid format');
        }
      })
      .catch(() => {
        // Fallback dummy data if API is down or blocked by CORS
        setData({
          timestamp: new Date().toISOString(),
          values: {
            water_temperature: { value: 16.5, unit: '°C' },
            air_temperature: { value: 18.2, unit: '°C' },
          }
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return null;

  const currentBudgetMio = Math.round(GUD_BASE_BUDGET_MIO * (1 + gudBudgetDelta / 100));
  const diffMio = currentBudgetMio - GUD_BASE_BUDGET_MIO;

  return (
    <div className="fixed bottom-3 right-3 bg-[var(--color-panel)] p-3 rounded-xl shadow-lg border border-[var(--color-line)] z-10 pointer-events-auto w-[240px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🌊</span>
        <h4 className="m-0 text-sm font-semibold text-[var(--color-ink)]">Erfolgskontrolle GUD</h4>
      </div>
      <p className="text-[11px] text-[var(--color-mute)] mb-2">
        Live-Daten (Mythenquai) der Wasserschutzpolizei als Indikator.
      </p>
      {data && (
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div className="bg-[var(--color-bg)] p-2 rounded-lg text-center">
            <div className="text-[var(--color-mute)] mb-1">Wasser</div>
            <div className="font-bold text-[var(--color-accent)]">{data.values.water_temperature.value} {data.values.water_temperature.unit}</div>
          </div>
          <div className="bg-[var(--color-bg)] p-2 rounded-lg text-center">
            <div className="text-[var(--color-mute)] mb-1">Luft</div>
            <div className="font-bold text-orange-500">{data.values.air_temperature.value} {data.values.air_temperature.unit}</div>
          </div>
        </div>
      )}
      
      <div className="pt-2 border-t border-[var(--color-line)]">
        <h5 className="text-[11px] font-semibold text-[var(--color-ink)] mb-1 flex justify-between">
          <span>Klimabudget-Simulation GUD</span>
          <span className={gudBudgetDelta > 0 ? 'text-[var(--color-status-negative)]' : gudBudgetDelta < 0 ? 'text-[var(--color-status-positive)]' : 'text-[var(--color-mute)]'}>
            {gudBudgetDelta > 0 ? '+' : ''}{gudBudgetDelta}%
          </span>
        </h5>
        <input 
          type="range" 
          min="-50" 
          max="50" 
          step="1"
          value={gudBudgetDelta} 
          onChange={(e) => onGudBudgetDeltaChange(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)] mb-1"
          aria-label="Klimabudget-Simulation GUD"
        />
        <div className="text-[10px] text-[var(--color-mute)] flex justify-between">
          <span>~ {currentBudgetMio} Mio CHF</span>
          {diffMio !== 0 && (
            <span className="font-medium">
              {diffMio > 0 ? '+' : ''}{diffMio} Mio
            </span>
          )}
        </div>
      </div>

      <div className="text-[9px] text-[var(--color-mute)] mt-2 text-right">
        Quelle: Open Data Zürich
      </div>
    </div>
  );
}
