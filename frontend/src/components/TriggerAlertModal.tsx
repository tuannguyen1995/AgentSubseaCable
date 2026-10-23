import React, { useState } from 'react';
import { X, AlertOctagon, Radio, Link as LinkIcon, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { SubseaPolicyData, encodeCalldata, getSavedContractAddress, waitForTransactionReceipt } from '../config/genlayer';

interface TriggerAlertModalProps {
  policy: SubseaPolicyData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  account: string;
}

const TELEMETRY_PRESETS = [
  {
    title: 'Optical Fiber Severance (OTDR / RIPE)',
    url: 'https://atlas.ripe.net/api/v2/measurements/aag_fiber_cut_rtt.json',
    desc: 'Simulates complete physical transoceanic fiber cut (RTT > 9000ms, zero seismic activity).',
    verdictPreview: 'OUTAGE_SLA_BREACH_COMPENSATED (100% Payout)',
    badgeColor: 'border-red-500/30 text-red-400 bg-red-500/10',
  },
  {
    title: 'Seafloor Earthquake 6.2R (USGS Seismology)',
    url: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&cable=smw5',
    desc: 'Simulates high-magnitude seabed seismic event (6.2 Richter). Tectonic rupture.',
    verdictPreview: 'FORCE_MAJEURE_EARTHQUAKE_VERIFIED (SLA Waived)',
    badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  {
    title: 'Moderate Latency Jitter (NOAA NDBC DART)',
    url: 'https://ndbc.noaa.gov/data/realtime2/tat14_telemetry.txt',
    desc: 'Simulates optical amplifier degradation exceeding SLA baseline by ~40-60%.',
    verdictPreview: 'PARTIAL_LATENCY_DEGRADATION (40% Payout)',
    badgeColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
  },
];

export const TriggerAlertModal: React.FC<TriggerAlertModalProps> = ({
  policy,
  isOpen,
  onClose,
  onSuccess,
  account,
}) => {
  const [telemetryUrl, setTelemetryUrl] = useState(TELEMETRY_PRESETS[0].url);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !policy) return null;

  const handleSelectPreset = (url: string) => {
    setTelemetryUrl(url);
  };

  const handleSubmitAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (!account) {
      setErrorMessage('Please connect your Web3 wallet first.');
      return;
    }

    const cleanUrl = telemetryUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMessage('Valid HTTP/HTTPS telemetry endpoint required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage('Filing cable outage telemetry to GenLayer Intelligent Contract...');

      const calldata = encodeCalldata('trigger_cable_outage_alert', [
        policy.policy_id,
        cleanUrl,
      ]);

      const contractAddr = getSavedContractAddress();

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: contractAddr,
            data: calldata,
          },
        ],
      });

      setStatusMessage(`Transaction submitted: ${txHash.slice(0, 10)}... Awaiting validator block inclusion.`);

      await waitForTransactionReceipt(txHash);

      setStatusMessage('Telemetry successfully registered! Ready for AI Subsea Tribunal adjudication.');
      setTimeout(() => {
        setIsSubmitting(false);
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error submitting outage alert:', err);
      setErrorMessage(err.message || 'Failed to trigger outage alert on GenLayer.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-abyss-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-abyss-900 border border-seismic-amber/40 rounded-2xl shadow-amber-glow overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-abyss-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-seismic-amber/10 border border-seismic-amber/30 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5 text-seismic-amber" />
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-lg">
                File Subsea Outage / Latency Alert
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Cable Corridor: <span className="font-mono text-ocean-cyan font-semibold">{policy.cable_system_id}</span> (Policy #{policy.policy_id})
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

        {/* Content Form */}
        <form onSubmit={handleSubmitAlert} className="p-6 space-y-5">
          {/* Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Accredited Telemetry Presets (1-Click Test)
              </label>
              <span className="flex items-center gap-1 text-[11px] font-mono text-ocean-cyan">
                <Sparkles className="w-3 h-3" />
                <span>USGS / NOAA / RIPE</span>
              </span>
            </div>
            <div className="space-y-2">
              {TELEMETRY_PRESETS.map((preset, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectPreset(preset.url)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    telemetryUrl === preset.url
                      ? 'bg-seismic-amber/10 border-seismic-amber text-white shadow-amber-glow'
                      : 'bg-abyss-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-slate-200">{preset.title}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${preset.badgeColor}`}>
                      {preset.verdictPreview}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-sans">{preset.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry URL input */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Accredited Subsea / Seismic Telemetry Endpoint
            </label>
            <div className="relative">
              <input
                type="url"
                value={telemetryUrl}
                onChange={(e) => setTelemetryUrl(e.target.value)}
                required
                className="w-full bg-abyss-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-mono text-white focus:border-seismic-amber outline-none"
                placeholder="https://atlas.ripe.net/api/v2/..."
              />
              <LinkIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-slate-500 font-sans mt-1">
              Must originate strictly from accredited sources: RIPE Atlas, USGS Earthquakes, NOAA NDBC Buoy, or Submarine Cable Map.
            </p>
          </div>

          {/* Status / Error Displays */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-seismic-amber/10 border border-seismic-amber/30 text-xs font-mono text-amber-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-seismic-amber flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-seismic-amber to-amber-600 text-abyss-950 text-sm font-semibold shadow-amber-glow hover:opacity-95 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Alert...</span>
                </>
              ) : (
                <span>Trigger On-Chain Outage Alert</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
