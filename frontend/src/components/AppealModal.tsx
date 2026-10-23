import React, { useState } from 'react';
import {
  X,
  Scale,
  AlertTriangle,
  Coins,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { SubseaPolicyData, encodeCalldata, getSavedContractAddress, waitForTransactionReceipt } from '../config/genlayer';
import { formatGen } from '../utils/formatters';

interface AppealModalProps {
  policy: SubseaPolicyData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  account: string;
}

export const AppealModal: React.FC<AppealModalProps> = ({
  policy,
  isOpen,
  onClose,
  onSuccess,
  account,
}) => {
  const [reason, setReason] = useState('Supplemental seabed seismograph logs show localized micro-fault displacement along the submarine trench.');
  const [suppUrl, setSuppUrl] = useState('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&region=subsea_trench');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !policy) return null;

  const escrowValBigInt = BigInt(policy.escrow_amount || '0');
  const requiredBondBigInt = escrowValBigInt > 0n ? (escrowValBigInt * 10n) / 100n : 1n;
  const bondGen = formatGen(requiredBondBigInt);

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (!account) {
      setErrorMessage('Please connect your Web3 wallet first.');
      return;
    }

    if (reason.trim().length < 10) {
      setErrorMessage('Detailed dispute justification (>= 10 chars) required.');
      return;
    }

    const cleanUrl = suppUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMessage('Valid HTTP/HTTPS supplemental telemetry endpoint required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage('Staking 10% appeal bond & filing appellate review on GenLayer...');

      const calldata = encodeCalldata('appeal_verdict', [
        policy.policy_id,
        reason.trim(),
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
            value: `0x${requiredBondBigInt.toString(16)}`,
          },
        ],
      });

      setStatusMessage(`Appeal transaction submitted: ${txHash.slice(0, 10)}... Awaiting block inclusion.`);

      await waitForTransactionReceipt(txHash);

      setStatusMessage('Appellate dispute staked successfully! Policy moved to STATUS_DISPUTED.');
      setTimeout(() => {
        setIsSubmitting(false);
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error filing appeal:', err);
      setErrorMessage(err.message || 'Failed to submit appellate challenge.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-abyss-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-abyss-900 border border-purple-500/40 rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-abyss-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <Scale className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-lg">
                Appellate Challenge Window
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Cooling-off challenge for Policy #{policy.policy_id} ({policy.cable_system_id})
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
        <form onSubmit={handleSubmitAppeal} className="p-6 space-y-4">
          {/* Required Bond Notice */}
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Coins className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-xs font-mono font-bold text-purple-200">Required 10% Dispute Stake</p>
                <p className="text-[11px] text-slate-400">Refunded 100% if appeal is upheld or on timeout recovery.</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-mono font-bold text-purple-300">{bondGen} GEN</span>
            </div>
          </div>

          {/* Dispute Reason */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Appellate Justification
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full bg-abyss-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white focus:border-purple-500 outline-none resize-none leading-relaxed"
              placeholder="State the technical and legal basis for challenging the AI tribunal's verdict..."
            />
          </div>

          {/* Supplemental Accredited Evidence URL */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Accredited Supplemental Telemetry Feed
            </label>
            <div className="relative">
              <input
                type="url"
                value={suppUrl}
                onChange={(e) => setSuppUrl(e.target.value)}
                required
                className="w-full bg-abyss-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-mono text-white focus:border-purple-500 outline-none"
                placeholder="https://earthquake.usgs.gov/..."
              />
              <LinkIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-slate-500 font-sans mt-1">
              Must originate strictly from accredited sources (USGS, NOAA, RIPE, Submarine Cable Map).
            </p>
          </div>

          {/* Status / Error Displays */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs font-mono text-purple-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400 flex-shrink-0" />
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
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-semibold shadow-lg hover:opacity-95 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Staking Appeal...</span>
                </>
              ) : (
                <span>Stake {bondGen} GEN & Challenge</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
