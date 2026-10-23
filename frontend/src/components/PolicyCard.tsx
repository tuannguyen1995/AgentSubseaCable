import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Scale,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Loader2,
  FileSearch,
  Radio,
  ArrowRight,
  RotateCcw,
  Zap,
  Waves
} from 'lucide-react';
import {
  SubseaPolicyData,
  STATUS_POLICY_OPEN,
  STATUS_ALERT_SUBMITTED,
  STATUS_AWAITING_PAYOUT,
  STATUS_SETTLED_SLA_BREACH,
  STATUS_SETTLED_PARTIAL,
  STATUS_SETTLED_FORCE_MAJEURE,
  STATUS_DISPUTED,
  STATUS_EXPIRED_RECLAIMED,
  STATUS_UNRESOLVED,
  encodeCalldata,
  getSavedContractAddress,
  waitForTransactionReceipt,
  fetchRemainingCoolingOff,
  fetchUserRole,
} from '../config/genlayer';
import {
  formatGen,
  formatAddress,
  formatTimestamp,
  formatRichter,
  formatLatency,
  getStatusMeta,
} from '../utils/formatters';

interface PolicyCardProps {
  policy: SubseaPolicyData;
  account: string;
  onOpenAlertModal: (policy: SubseaPolicyData) => void;
  onOpenInspectorModal: (policy: SubseaPolicyData) => void;
  onOpenAppealModal: (policy: SubseaPolicyData) => void;
  onRefresh: () => void;
}

export const PolicyCard: React.FC<PolicyCardProps> = ({
  policy,
  account,
  onOpenAlertModal,
  onOpenInspectorModal,
  onOpenAppealModal,
  onRefresh,
}) => {
  const [coolingSeconds, setCoolingSeconds] = useState(0);
  const [userRole, setUserRole] = useState('OBSERVER');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const statusMeta = getStatusMeta(policy.status);
  const latencyAnalysis = formatLatency(policy.measured_latency_ms, policy.max_tolerable_latency_ms);
  const isEarthquake = policy.detected_magnitude_richter >= 55;
  const isFiberCut = policy.measured_latency_ms >= 5000;

  useEffect(() => {
    let isMounted = true;
    const fetchStatusData = async () => {
      if (policy.status === STATUS_AWAITING_PAYOUT) {
        const rem = await fetchRemainingCoolingOff(policy.policy_id);
        if (isMounted) setCoolingSeconds(rem);
      }
      if (account) {
        const role = await fetchUserRole(policy.policy_id, account);
        if (isMounted) setUserRole(role);
      }
    };

    fetchStatusData();
    const timer = setInterval(() => {
      setCoolingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [policy.policy_id, policy.status, account]);

  const executeContractCall = async (methodName: string, args: any[], successText: string) => {
    if (!account) {
      alert('Please connect your Web3 wallet first.');
      return;
    }
    setActionError('');
    setActionMessage('');
    try {
      setIsProcessing(true);
      setActionMessage(`Submitting ${methodName}...`);

      const calldata = encodeCalldata(methodName, args);
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

      setActionMessage(`Waiting for consensus on ${txHash.slice(0, 10)}...`);
      await waitForTransactionReceipt(txHash);

      setActionMessage(successText);
      setTimeout(() => {
        setIsProcessing(false);
        setActionMessage('');
        onRefresh();
      }, 1500);
    } catch (err: any) {
      console.error(`Error executing ${methodName}:`, err);
      setActionError(err.message || `Failed to execute ${methodName}.`);
      setIsProcessing(false);
    }
  };

  const handleAdjudicateOutage = () => {
    executeContractCall(
      'adjudicate_cable_outage',
      [policy.policy_id],
      'AI Subsea Tribunal evaluated optical and seismic telemetry!'
    );
  };

  const handleAdjudicateAppeal = () => {
    executeContractCall(
      'adjudicate_appeal',
      [policy.policy_id],
      'Supreme Appellate Tribunal rendered final verdict!'
    );
  };

  const handleFinalizeSettlement = () => {
    executeContractCall(
      'finalize_settlement',
      [policy.policy_id],
      'Settlement finalized and credited to beneficiary pull ledger!'
    );
  };

  const handleResolveStaleAppeal = () => {
    executeContractCall(
      'resolve_stale_appeal',
      [policy.policy_id],
      'Stale appeal resolved! 100% dispute bond refunded to appellant.'
    );
  };

  const handleCancelOrReclaim = () => {
    executeContractCall(
      'cancel_or_reclaim',
      [policy.policy_id],
      'Expired SLA escrow reclaimed successfully by operator.'
    );
  };

  return (
    <div className={`bg-abyss-900 border ${statusMeta.border} rounded-2xl p-5 shadow-lg relative flex flex-col justify-between hover:border-ocean-cyan/50 transition`}>
      {/* Top Card Header */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-ocean-cyan px-2 py-0.5 rounded bg-ocean-cyan/10 border border-ocean-cyan/20">
              #{policy.policy_id}
            </span>
            <span className="font-mono text-sm font-bold text-white tracking-wide truncate">
              {policy.cable_system_id}
            </span>
          </div>
          <span className={`text-[11px] font-mono px-2.5 py-1 rounded-md border font-semibold uppercase tracking-wider ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}>
            {statusMeta.label}
          </span>
        </div>

        {/* Escrow and SLA Target Header */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-abyss-950 rounded-xl border border-slate-800 mb-4">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block">SLA Escrow Indemnity</span>
            <span className="text-base font-mono font-bold text-ocean-glow">
              {formatGen(policy.escrow_amount)} GEN
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Agreed Max Latency</span>
            <span className="text-sm font-mono font-bold text-white">
              &lt;= {policy.max_tolerable_latency_ms} ms RTT
            </span>
          </div>
        </div>

        {/* Telemetry and Seismic Gauges */}
        <div className="space-y-3 mb-4">
          {/* Measured Optical Latency */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-slate-400">Measured Optical RTT:</span>
              <span className={`font-bold ${
                latencyAnalysis.status === 'severe'
                  ? 'text-red-400'
                  : latencyAnalysis.status === 'warning'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}>
                {policy.measured_latency_ms > 0 ? `${policy.measured_latency_ms} ms` : 'Nominal (No Alert)'}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  policy.measured_latency_ms >= 5000
                    ? 'bg-red-500'
                    : policy.measured_latency_ms > policy.max_tolerable_latency_ms
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{
                  width: `${policy.measured_latency_ms > 0 ? Math.min(100, (policy.measured_latency_ms / (policy.max_tolerable_latency_ms * 2)) * 100) : 5}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Seabed Seismicity Meter */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-slate-400">Seafloor Seismicity:</span>
              <span className={`font-bold ${isEarthquake ? 'text-amber-400' : 'text-slate-300'}`}>
                {formatRichter(policy.detected_magnitude_richter)}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${isEarthquake ? 'bg-amber-500' : 'bg-slate-600'}`}
                style={{
                  width: `${policy.detected_magnitude_richter > 0 ? Math.min(100, (policy.detected_magnitude_richter / 80) * 100) : 0}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Reason / Verdict Text */}
        {policy.reason && (
          <div className="p-2.5 rounded-lg bg-abyss-850 border border-slate-800/80 mb-4 text-xs font-sans text-slate-300 line-clamp-2">
            <span className="text-slate-400 font-mono font-semibold">Consensus Audit: </span>
            {policy.reason}
          </div>
        )}

        {/* Counterparties & Role */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 border-t border-slate-800/60 pt-3 mb-4">
          <div>
            <span className="text-slate-500 block uppercase text-[9px]">Cable Operator</span>
            <span className="text-slate-300">{formatAddress(policy.cable_operator)}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block uppercase text-[9px]">Client Beneficiary</span>
            <span className="text-slate-300">{formatAddress(policy.client)}</span>
          </div>
        </div>
      </div>

      {/* Bottom Actions & Cooling-Off Bar */}
      <div>
        {/* Cooling-Off Window Countdown Banner */}
        {policy.status === STATUS_AWAITING_PAYOUT && (
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 mb-3 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-cyan-300">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>Cooling-off Challenge:</span>
            </div>
            <span className="font-bold text-white">
              {coolingSeconds > 0 ? `${coolingSeconds}s remaining` : 'Window Expired (Ready to Settle)'}
            </span>
          </div>
        )}

        {/* Execution Error or Status feedback */}
        {actionMessage && (
          <div className="p-2 rounded-lg bg-ocean-cyan/10 border border-ocean-cyan/30 mb-3 text-xs font-mono text-ocean-glow flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-ocean-cyan" />
            <span className="truncate">{actionMessage}</span>
          </div>
        )}
        {actionError && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 mb-3 text-xs font-mono text-red-400">
            {actionError}
          </div>
        )}

        {/* Action Button Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action 1: Trigger Outage Alert */}
          {(policy.status === STATUS_POLICY_OPEN || policy.status === STATUS_UNRESOLVED) && (
            <button
              onClick={() => onOpenAlertModal(policy)}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-seismic-amber/15 hover:bg-seismic-amber/25 text-seismic-amber border border-seismic-amber/40 text-xs font-mono font-bold transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Trigger Alert</span>
            </button>
          )}

          {/* Action 2: Adjudicate Outage */}
          {(policy.status === STATUS_ALERT_SUBMITTED || policy.status === STATUS_UNRESOLVED) && (
            <button
              onClick={handleAdjudicateOutage}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-ocean-cyan hover:bg-ocean-electric text-abyss-950 font-mono text-xs font-bold shadow-cyan-glow transition"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Adjudicate Outage</span>
            </button>
          )}

          {/* Action 3: File Appeal (during cooling-off) */}
          {policy.status === STATUS_AWAITING_PAYOUT && coolingSeconds > 0 && (
            <button
              onClick={() => onOpenAppealModal(policy)}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/40 text-xs font-mono font-bold transition"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Stake Appeal (10%)</span>
            </button>
          )}

          {/* Action 4: Finalize Settlement (after cooling-off) */}
          {policy.status === STATUS_AWAITING_PAYOUT && coolingSeconds === 0 && (
            <button
              onClick={handleFinalizeSettlement}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-telecom-emerald hover:bg-emerald-400 text-abyss-950 text-xs font-mono font-bold shadow-emerald-glow transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Finalize Payout</span>
            </button>
          )}

          {/* Action 5: Adjudicate Appeal */}
          {policy.status === STATUS_DISPUTED && (
            <button
              onClick={handleAdjudicateAppeal}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold transition"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Adjudicate Appeal</span>
            </button>
          )}

          {/* Action 6: Recover Stale Appeal */}
          {policy.status === STATUS_DISPUTED && (
            <button
              onClick={handleResolveStaleAppeal}
              disabled={isProcessing}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
              title="Refund 100% dispute bond if appeal timed out"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recover Appeal</span>
            </button>
          )}

          {/* Action 7: Cancel or Reclaim Expired */}
          {policy.status === STATUS_POLICY_OPEN && (
            <button
              onClick={handleCancelOrReclaim}
              disabled={isProcessing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Reclaim Escrow if coverage duration expired"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Action 8: Inspect Telemetry */}
          <button
            onClick={() => onOpenInspectorModal(policy)}
            className="p-2 rounded-xl bg-abyss-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-ocean-cyan transition"
            title="Inspect AI Subsea Tribunal Evidence Digest"
          >
            <FileSearch className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
