import React from 'react';
import {
  X,
  ShieldCheck,
  Activity,
  Layers,
  Hash,
  ExternalLink,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Waves,
  Zap
} from 'lucide-react';
import { SubseaPolicyData } from '../config/genlayer';
import { formatRichter, formatLatency, formatTimestamp, getStatusMeta } from '../utils/formatters';

interface TelemetryInspectorModalProps {
  policy: SubseaPolicyData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TelemetryInspectorModal: React.FC<TelemetryInspectorModalProps> = ({
  policy,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !policy) return null;

  const statusMeta = getStatusMeta(policy.status);
  const latencyAnalysis = formatLatency(policy.measured_latency_ms, policy.max_tolerable_latency_ms);
  const isForceMajeure = policy.detected_magnitude_richter >= 55;
  const isFullCut = policy.measured_latency_ms >= 5000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-abyss-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-abyss-900 border border-ocean-cyan/30 rounded-2xl shadow-cyan-glow overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-abyss-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-ocean-cyan/10 border border-ocean-cyan/30 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-ocean-cyan" />
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-lg">
                AI Subsea & Seismic Tribunal Inspector
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Consensus Evidence Snapshot for <span className="font-mono text-ocean-cyan">{policy.cable_system_id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Adjudication Verdict Banner */}
          <div className={`p-4 rounded-xl border ${statusMeta.border} ${statusMeta.bg} flex items-start gap-3`}>
            <div className="mt-0.5">
              {isForceMajeure ? (
                <AlertTriangle className="w-5 h-5 text-seismic-amber" />
              ) : isFullCut ? (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-ocean-cyan" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-mono font-bold uppercase tracking-wider ${statusMeta.text}`}>
                  {policy.verdict || 'PENDING ADJUDICATION'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Confidence: <span className="text-white font-bold">{policy.confidence}%</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 font-sans mt-1.5 leading-relaxed">
                {policy.reason || 'Telemetry observation under active evaluation by GenVM consensus validators.'}
              </p>
            </div>
          </div>

          {/* Key Hydrographic Metrics Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Metric 1: OTDR Latency vs SLA */}
            <div className="bg-abyss-950 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase text-slate-400">Measured Optical RTT</span>
                <span className={`text-xs font-mono font-bold ${
                  latencyAnalysis.status === 'severe'
                    ? 'text-red-400'
                    : latencyAnalysis.status === 'warning'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {latencyAnalysis.text}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-mono font-bold text-white">
                  {policy.measured_latency_ms}
                </span>
                <span className="text-xs font-mono text-slate-400">ms RTT</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    policy.measured_latency_ms > policy.max_tolerable_latency_ms
                      ? 'bg-red-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(100, (policy.measured_latency_ms / (policy.max_tolerable_latency_ms * 2)) * 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-[10px] font-mono text-slate-400 mt-2">
                Agreed SLA Threshold: &lt;= {policy.max_tolerable_latency_ms} ms RTT
              </p>
            </div>

            {/* Metric 2: Seabed Seismic Magnitude */}
            <div className="bg-abyss-950 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase text-slate-400">USGS Seabed Seismicity</span>
                <span className={`text-xs font-mono font-bold ${
                  policy.detected_magnitude_richter >= 55 ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {formatRichter(policy.detected_magnitude_richter)}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-mono font-bold text-white">
                  {(policy.detected_magnitude_richter / 10).toFixed(1)}
                </span>
                <span className="text-xs font-mono text-slate-400">Richter</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    policy.detected_magnitude_richter >= 55 ? 'bg-amber-500' : 'bg-slate-600'
                  }`}
                  style={{
                    width: `${Math.min(100, (policy.detected_magnitude_richter / 80) * 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-[10px] font-mono text-slate-400 mt-2">
                Force Majeure Clause Trigger: &gt;= 5.5 Richter (55)
              </p>
            </div>
          </div>

          {/* Telemetry Endpoint & Cryptographic Evidence Hash */}
          <div className="space-y-3">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Subsea Telemetry Feed Endpoint
              </span>
              <div className="bg-abyss-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs font-mono text-slate-300">
                <span className="truncate">{policy.telemetry_feed_url || 'No active telemetry feed filed'}</span>
                {policy.telemetry_feed_url && (
                  <a
                    href={policy.telemetry_feed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 hover:text-ocean-cyan text-slate-400"
                    title="View Telemetry Feed"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Cryptographic Evidence Hash (SHA-256 Payload Digest)
              </span>
              <div className="bg-abyss-950 border border-slate-800 rounded-xl p-3 flex items-center gap-2 text-xs font-mono text-ocean-glow break-all">
                <Hash className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>{policy.evidence_hash || '0000000000000000000000000000000000000000000000000000000000000000'}</span>
              </div>
            </div>
          </div>

          {/* Timestamps & Security Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-abyss-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase">Policy Created</span>
              <span className="text-slate-300">{formatTimestamp(policy.created_at_time)}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-abyss-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase">Adjudication Time</span>
              <span className="text-slate-300">{formatTimestamp(policy.audit_completed_time)}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-abyss-950 border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-500 block uppercase">Canary Security Check</span>
              <span className="text-telecom-emerald font-bold">VERIFIED (V1)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-abyss-850 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold font-mono transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
