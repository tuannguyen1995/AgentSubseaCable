import React, { useState } from 'react';
import { Waves, Activity, AlertCircle, CheckCircle, Zap } from 'lucide-react';

interface CableRoute {
  id: string;
  name: string;
  endpoints: string;
  lengthKm: number;
  slaMs: number;
  activeIncidents: number;
  status: 'nominal' | 'alert' | 'cut' | 'earthquake';
  pathD: string;
  stations: { name: string; x: number; y: number }[];
}

const GLOBAL_ROUTES: CableRoute[] = [
  {
    id: 'AAG-TRANS-PACIFIC-S1',
    name: 'Asia-America Gateway (AAG)',
    endpoints: 'San Luis Obispo ⟷ Hong Kong / Singapore',
    lengthKm: 20000,
    slaMs: 120,
    activeIncidents: 1,
    status: 'cut',
    pathD: 'M 780 180 Q 550 240 260 210 Q 220 230 180 250',
    stations: [
      { name: 'San Luis Obispo (US)', x: 780, y: 180 },
      { name: 'Hawaii (BU)', x: 550, y: 240 },
      { name: 'Guam (BU)', x: 330, y: 220 },
      { name: 'Hong Kong (HK)', x: 220, y: 210 },
      { name: 'Singapore (SG)', x: 180, y: 250 },
    ],
  },
  {
    id: 'SEA-ME-WE-5-S2',
    name: 'South East Asia-Middle East-Western Europe 5',
    endpoints: 'Singapore ⟷ Marseille (France)',
    lengthKm: 20000,
    slaMs: 90,
    activeIncidents: 1,
    status: 'earthquake',
    pathD: 'M 180 250 Q 220 280 320 260 Q 420 220 480 160 Q 520 140 540 120',
    stations: [
      { name: 'Singapore (SG)', x: 180, y: 250 },
      { name: 'Colombo (LK)', x: 260, y: 240 },
      { name: 'Djibouti (DJ)', x: 380, y: 200 },
      { name: 'Suez (EG)', x: 460, y: 150 },
      { name: 'Marseille (FR)', x: 540, y: 120 },
    ],
  },
  {
    id: 'TAT-14-TRANSATLANTIC',
    name: 'Transatlantic 14 (TAT-14)',
    endpoints: 'New Jersey (US) ⟷ Bude (UK) / Norden (DE)',
    lengthKm: 15000,
    slaMs: 85,
    activeIncidents: 0,
    status: 'nominal',
    pathD: 'M 720 140 Q 640 120 560 110',
    stations: [
      { name: 'Tuckerton (US)', x: 720, y: 140 },
      { name: 'Bude (UK)', x: 560, y: 110 },
    ],
  },
  {
    id: 'FASTER-PACIFIC-N1',
    name: 'FASTER Cable System',
    endpoints: 'Oregon (US) ⟷ Chikura & Shima (Japan)',
    lengthKm: 11629,
    slaMs: 80,
    activeIncidents: 0,
    status: 'nominal',
    pathD: 'M 760 140 Q 500 130 250 160',
    stations: [
      { name: 'Bandon (US)', x: 760, y: 140 },
      { name: 'Chikura (JP)', x: 250, y: 160 },
    ],
  },
  {
    id: '2AFRICA-WEST-LOOP',
    name: '2Africa Oceanic Ring',
    endpoints: 'Bude (UK) ⟷ Cape Town (South Africa)',
    lengthKm: 45000,
    slaMs: 110,
    activeIncidents: 0,
    status: 'nominal',
    pathD: 'M 560 110 Q 510 180 500 240 Q 520 320 540 370',
    stations: [
      { name: 'Bude (UK)', x: 560, y: 110 },
      { name: 'Accra (GH)', x: 500, y: 240 },
      { name: 'Cape Town (ZA)', x: 540, y: 370 },
    ],
  },
];

export const SubseaWorldMap: React.FC = () => {
  const [selectedRoute, setSelectedRoute] = useState<CableRoute>(GLOBAL_ROUTES[0]);

  return (
    <div className="bg-abyss-900 border border-ocean-cyan/20 rounded-2xl p-6 mb-8 shadow-cyan-glow relative overflow-hidden">
      {/* Background bathymetry lines effect */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-ocean-cyan animate-pulse"></span>
            <h3 className="text-lg font-bold font-display text-white">
              Global Submarine Cable Operations Center (NOC)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-sans">
            Live hydrographic telemetry, optical reflectometry (OTDR), and USGS seabed seismic monitoring.
          </p>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-abyss-950 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-telecom-emerald"></span>
            <span className="text-slate-300">Nominal (&lt; SLA)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-abyss-950 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-seismic-amber animate-pulse"></span>
            <span className="text-slate-300">Seismic Hazard (&gt;= 5.5R)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-abyss-950 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-telecom-crimson animate-ping"></span>
            <span className="text-slate-300">Optical Severance</span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Ocean Corridor */}
      <div className="relative w-full h-72 sm:h-80 bg-abyss-950 rounded-xl border border-slate-800 overflow-hidden">
        {/* Ocean Grids */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#07142b_1px,transparent_1px),linear-gradient(to_bottom,#07142b_1px,transparent_1px)] bg-[size:40px_40px] opacity-40"></div>

        <svg viewBox="0 0 900 420" className="w-full h-full object-cover">
          <defs>
            {/* Glowing filter for optical pulse */}
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Seabed Tectonic Fault Lines */}
          <path
            d="M 220 80 Q 250 180 320 260 Q 400 320 480 390"
            fill="none"
            stroke="#b45309"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            opacity="0.4"
          />
          <path
            d="M 700 80 Q 640 200 680 320 Q 720 380 750 410"
            fill="none"
            stroke="#b45309"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            opacity="0.4"
          />

          {/* Subsea Cable Routes */}
          {GLOBAL_ROUTES.map((route) => {
            const isSelected = selectedRoute.id === route.id;
            let strokeColor = '#06B6D4';
            let filter = 'url(#glow-cyan)';
            if (route.status === 'cut') {
              strokeColor = '#EF4444';
              filter = 'url(#glow-red)';
            } else if (route.status === 'earthquake') {
              strokeColor = '#F59E0B';
              filter = 'url(#glow-amber)';
            }

            return (
              <g key={route.id} className="cursor-pointer" onClick={() => setSelectedRoute(route)}>
                {/* Thick background click area */}
                <path
                  d={route.pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="20"
                />
                {/* Visual Cable Fiber Strand */}
                <path
                  d={route.pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? '4' : '2'}
                  filter={isSelected ? filter : undefined}
                  className="transition-all duration-300"
                />
                {/* Fiber Light Optical Pulse */}
                <path
                  d={route.pathD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeDasharray="8, 20"
                  className="animate-wave-scroll"
                  opacity={isSelected ? '0.9' : '0.4'}
                />

                {/* Stations */}
                {route.stations.map((station, sIdx) => (
                  <g key={sIdx}>
                    <circle
                      cx={station.x}
                      cy={station.y}
                      r={isSelected ? '5' : '3.5'}
                      fill="#040914"
                      stroke={strokeColor}
                      strokeWidth="2"
                    />
                    <circle
                      cx={station.x}
                      cy={station.y}
                      r="2"
                      fill={route.status === 'cut' ? '#EF4444' : '#10B981'}
                    />
                    {isSelected && (
                      <text
                        x={station.x}
                        y={station.y - 8}
                        fill="#cbd5e1"
                        fontSize="9"
                        fontFamily="monospace"
                        textAnchor="middle"
                        className="select-none"
                      >
                        {station.name}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        </svg>

        {/* Selected Route Floating Card */}
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md bg-abyss-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-3 shadow-lg flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-ocean-cyan">{selectedRoute.id}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                selectedRoute.status === 'cut'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : selectedRoute.status === 'earthquake'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {selectedRoute.status === 'cut' ? 'FIBER CUT VERIFIED' : selectedRoute.status === 'earthquake' ? 'SEISMIC FORCE MAJEURE' : 'NOMINAL SLA'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-sans mt-0.5 truncate">{selectedRoute.endpoints}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 uppercase">SLA Target</span>
            <p className="text-xs font-mono font-bold text-white">&lt;= {selectedRoute.slaMs} ms</p>
          </div>
        </div>
      </div>
    </div>
  );
};
