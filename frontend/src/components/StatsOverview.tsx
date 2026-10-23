import React from 'react';
import {
  ShieldAlert,
  Coins,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { formatGen } from '../utils/formatters';

interface StatsOverviewProps {
  totalPolicies: number;
  totalLocked: string;
  totalSettled: number;
  totalPendingClaims: string;
  activeOutagesCount: number;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  totalPolicies,
  totalLocked,
  totalSettled,
  totalPendingClaims,
  activeOutagesCount,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Metric 1: Total Locked Indemnity */}
      <div className="relative overflow-hidden bg-abyss-900 border border-ocean-cyan/20 rounded-2xl p-5 shadow-cyan-glow group hover:border-ocean-cyan/40 transition">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Total SLA Indemnity Locked
          </span>
          <div className="w-9 h-9 rounded-xl bg-ocean-cyan/10 border border-ocean-cyan/30 flex items-center justify-center">
            <Coins className="w-5 h-5 text-ocean-cyan" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-white">
            {formatGen(totalLocked)}
          </span>
          <span className="text-xs font-mono text-ocean-glow font-semibold">GEN</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-ocean-cyan"></span>
          <span>Parametric Escrow on GenLayer Consensus</span>
        </div>
      </div>

      {/* Metric 2: Monitored Cable Systems */}
      <div className="relative overflow-hidden bg-abyss-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Transoceanic Cables
          </span>
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Layers className="w-5 h-5 text-slate-300" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-white">
            {totalPolicies}
          </span>
          <span className="text-xs font-mono text-slate-400">Corridors Monitored</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-telecom-emerald"></span>
          <span>AAG, APG, SEA-ME-WE-5, TAT-14</span>
        </div>
      </div>

      {/* Metric 3: Active Outages / Seismic Incidents */}
      <div className={`relative overflow-hidden bg-abyss-900 border ${activeOutagesCount > 0 ? 'border-seismic-amber/40 shadow-amber-glow' : 'border-slate-800'} rounded-2xl p-5 transition`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Active Incidents & Alerts
          </span>
          <div className="w-9 h-9 rounded-xl bg-seismic-amber/10 border border-seismic-amber/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-seismic-amber" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl sm:text-3xl font-bold font-mono ${activeOutagesCount > 0 ? 'text-seismic-amber' : 'text-white'}`}>
            {activeOutagesCount}
          </span>
          <span className="text-xs font-mono text-slate-400">Outage Triggers</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <span className={`w-2 h-2 rounded-full ${activeOutagesCount > 0 ? 'bg-seismic-amber animate-ping' : 'bg-slate-500'}`}></span>
          <span>OTDR Fiber Cuts & Seafloor Quakes</span>
        </div>
      </div>

      {/* Metric 4: Resolved & Settled SLA Payouts */}
      <div className="relative overflow-hidden bg-abyss-900 border border-telecom-emerald/20 rounded-2xl p-5 hover:border-telecom-emerald/40 transition">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Settled Claims / Claims Unclaimed
          </span>
          <div className="w-9 h-9 rounded-xl bg-telecom-emerald/10 border border-telecom-emerald/30 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-telecom-emerald" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-white">
            {totalSettled}
          </span>
          <span className="text-xs font-mono text-telecom-emerald font-semibold">
            ({formatGen(totalPendingClaims)} GEN Unclaimed)
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-telecom-emerald"></span>
          <span>Pure Pull-Payment Safe Delivery</span>
        </div>
      </div>
    </div>
  );
};
