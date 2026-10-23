import React, { useState, useEffect } from 'react';
import { X, ShieldPlus, Layers, Clock, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { encodeCalldata, getSavedContractAddress, waitForTransactionReceipt } from '../config/genlayer';

interface CreatePolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  account: string;
  prefilledCable?: { id: string; latency: number };
}

const CABLE_PRESETS = [
  { id: 'AAG-TRANS-PACIFIC-S1', name: 'Asia-America Gateway (AAG)', latency: 120, desc: 'San Luis Obispo ⟷ Hong Kong/Singapore' },
  { id: 'SEA-ME-WE-5-S2', name: 'SEA-ME-WE 5', latency: 90, desc: 'Singapore ⟷ Marseille' },
  { id: 'TAT-14-TRANSATLANTIC', name: 'Transatlantic 14', latency: 85, desc: 'New Jersey ⟷ Bude (UK)' },
  { id: 'FASTER-PACIFIC-N1', name: 'FASTER Cable', latency: 80, desc: 'Oregon ⟷ Chikura (Japan)' },
  { id: '2AFRICA-WEST-LOOP', name: '2Africa System', latency: 110, desc: 'Bude (UK) ⟷ Cape Town' },
  { id: 'MAREA-TRANSATLANTIC', name: 'MAREA Ultra-High Capacity', latency: 60, desc: 'Virginia Beach ⟷ Bilbao (Spain)' },
];

export const CreatePolicyModal: React.FC<CreatePolicyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  account,
  prefilledCable,
}) => {
  const [cableId, setCableId] = useState('AAG-TRANS-PACIFIC-S1');
  const [clientAddress, setClientAddress] = useState('0x71c26b8e3ad5d321d227f2f111818d6a7822998a');
  const [maxLatencyMs, setMaxLatencyMs] = useState(120);
  const [durationBlocks, setDurationBlocks] = useState(6000);
  const [escrowGen, setEscrowGen] = useState('2.0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (prefilledCable) {
      setCableId(prefilledCable.id);
      setMaxLatencyMs(prefilledCable.latency);
    }
  }, [prefilledCable, isOpen]);

  if (!isOpen) return null;

  const handlePresetSelect = (preset: typeof CABLE_PRESETS[0]) => {
    setCableId(preset.id);
    setMaxLatencyMs(preset.latency);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (!account) {
      setErrorMessage('Please connect your Web3 wallet first.');
      return;
    }

    if (!clientAddress.startsWith('0x') || clientAddress.length !== 42) {
      setErrorMessage('Valid 42-character telecom client beneficiary address required.');
      return;
    }

    if (clientAddress.toLowerCase() === account.toLowerCase()) {
      setErrorMessage('Operator cannot designate themselves as client beneficiary.');
      return;
    }

    const escrowVal = parseFloat(escrowGen);
    if (isNaN(escrowVal) || escrowVal <= 0) {
      setErrorMessage('SLA indemnity escrow deposit must be greater than 0 GEN.');
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage('Broadcasting SLA Escrow creation to StudioNet...');

      const valueWei = BigInt(Math.floor(escrowVal * 1e18));
      const calldata = encodeCalldata('create_subsea_sla_escrow', [
        clientAddress,
        cableId.trim().toUpperCase(),
        maxLatencyMs,
        durationBlocks,
      ]);

      const contractAddr = getSavedContractAddress();

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: contractAddr,
            data: calldata,
            value: `0x${valueWei.toString(16)}`,
          },
        ],
      });

      setStatusMessage(`Transaction submitted: ${txHash.slice(0, 10)}... Waiting for validators consensus.`);

      await waitForTransactionReceipt(txHash);

      setStatusMessage('Consensus reached! Subsea SLA Escrow activated on-chain.');
      setTimeout(() => {
        setIsSubmitting(false);
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error creating subsea policy:', err);
      setErrorMessage(err.message || 'Failed to deploy SLA escrow on GenLayer.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-abyss-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-abyss-900 border border-ocean-cyan/30 rounded-2xl shadow-cyan-glow overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-abyss-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-ocean-cyan/10 border border-ocean-cyan/30 flex items-center justify-center">
              <ShieldPlus className="w-5 h-5 text-ocean-cyan" />
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-lg">
                Create Subsea Cable SLA Escrow
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Lock GEN indemnity deposit guaranteeing transoceanic bandwidth continuity & RTT latency.
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
        <form onSubmit={handleCreate} className="p-6 space-y-5">
          {/* Presets */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
              Select Transoceanic Cable Corridor
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CABLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    cableId === preset.id
                      ? 'bg-ocean-cyan/15 border-ocean-cyan text-white shadow-cyan-glow'
                      : 'bg-abyss-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-mono font-bold truncate">{preset.id}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{preset.name}</p>
                  <span className="inline-block mt-1 text-[10px] font-mono text-ocean-cyan font-semibold">
                    RTT &lt;= {preset.latency} ms
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cable ID */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Cable Identifier
              </label>
              <input
                type="text"
                value={cableId}
                onChange={(e) => setCableId(e.target.value.toUpperCase())}
                required
                className="w-full bg-abyss-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:border-ocean-cyan outline-none"
                placeholder="e.g. AAG-TRANS-PACIFIC-S1"
              />
            </div>

            {/* Max Tolerable Latency */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Max Agreed Latency (RTT ms)
              </label>
              <input
                type="number"
                min="10"
                max="2000"
                value={maxLatencyMs}
                onChange={(e) => setMaxLatencyMs(parseInt(e.target.value) || 0)}
                required
                className="w-full bg-abyss-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:border-ocean-cyan outline-none"
              />
            </div>
          </div>

          {/* Client Beneficiary */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Client Telecom Beneficiary Address
            </label>
            <input
              type="text"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              required
              className="w-full bg-abyss-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:border-ocean-cyan outline-none"
              placeholder="0x..."
            />
            <p className="text-[11px] text-slate-500 font-sans mt-1">
              Telecom carrier or cloud provider entitled to SLA indemnity disbursement in event of verified fiber cuts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Escrow Deposit in GEN */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                SLA Escrow Indemnity (GEN)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={escrowGen}
                onChange={(e) => setEscrowGen(e.target.value)}
                required
                className="w-full bg-abyss-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:border-ocean-cyan outline-none"
                placeholder="2.0"
              />
            </div>

            {/* Duration Blocks */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Coverage Duration (Blocks)
              </label>
              <input
                type="number"
                min="100"
                value={durationBlocks}
                onChange={(e) => setDurationBlocks(parseInt(e.target.value) || 0)}
                required
                className="w-full bg-abyss-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:border-ocean-cyan outline-none"
              />
              <span className="text-[10px] text-slate-400 font-mono">
                ~{Math.round((durationBlocks * 3) / 3600)} hours ({durationBlocks} blocks at 3s/block)
              </span>
            </div>
          </div>

          {/* Status / Error Displays */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-ocean-cyan/10 border border-ocean-cyan/30 text-xs font-mono text-ocean-glow flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-ocean-cyan" />
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-ocean-cyan to-ocean-electric text-abyss-950 text-sm font-semibold shadow-cyan-glow hover:opacity-95 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activating SLA Escrow...</span>
                </>
              ) : (
                <>
                  <span>Deposit Escrow & Lock SLA</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
