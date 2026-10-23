import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, AlertCircle, Loader2, Sparkles, Coins } from 'lucide-react';
import { readContract, encodeCalldata, getSavedContractAddress, waitForTransactionReceipt } from '../config/genlayer';
import { formatGen, formatAddress } from '../utils/formatters';

interface PullPayoutButtonProps {
  account: string;
  onRefresh: () => void;
}

export const PullPayoutButton: React.FC<PullPayoutButtonProps> = ({ account, onRefresh }) => {
  const [claimableBalance, setClaimableBalance] = useState('0');
  const [totalWithdrawn, setTotalWithdrawn] = useState('0');
  const [isClaiming, setIsClaiming] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchBalances = async () => {
    if (!account) {
      setClaimableBalance('0');
      setTotalWithdrawn('0');
      return;
    }
    try {
      const claimable = await readContract('get_claimable_balance', [account]);
      const withdrawn = await readContract('get_total_withdrawn', [account]);
      setClaimableBalance(String(claimable || '0'));
      setTotalWithdrawn(String(withdrawn || '0'));
    } catch (err) {
      console.warn('Error reading claimable balance:', err);
    }
  };

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [account]);

  const handleClaim = async () => {
    if (!account) return;
    setErrorMessage('');
    setStatusMessage('');

    const bVal = BigInt(claimableBalance);
    if (bVal <= 0n) {
      setErrorMessage('No claimable balance available for withdrawal.');
      return;
    }

    try {
      setIsClaiming(true);
      setStatusMessage('Executing safe pull-payment withdrawal...');

      const calldata = encodeCalldata('claim_payout', []);
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

      setStatusMessage(`Claim transaction submitted: ${txHash.slice(0, 10)}...`);
      await waitForTransactionReceipt(txHash);

      setStatusMessage('Withdrawal successful! GEN credited directly to your wallet.');
      await fetchBalances();
      onRefresh();

      setTimeout(() => {
        setIsClaiming(false);
        setStatusMessage('');
      }, 3000);
    } catch (err: any) {
      console.error('Error claiming payout:', err);
      setErrorMessage(err.message || 'Failed to claim payout.');
      setIsClaiming(false);
    }
  };

  const hasClaimable = BigInt(claimableBalance) > 0n;

  return (
    <div className="bg-abyss-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasClaimable ? 'bg-telecom-emerald/15 text-telecom-emerald border border-telecom-emerald/30' : 'bg-slate-800 text-slate-400'}`}>
          <Coins className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Pure Pull-Payment Ledger
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              Anti-Stuck Protection
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-lg font-mono font-bold text-white">
              {formatGen(claimableBalance)} GEN
            </span>
            <span className="text-xs font-mono text-slate-500">
              Claimable ({formatGen(totalWithdrawn)} GEN withdrawn lifetime)
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto">
        {statusMessage && (
          <span className="text-xs font-mono text-telecom-emerald hidden md:inline">
            {statusMessage}
          </span>
        )}
        {errorMessage && (
          <span className="text-xs font-mono text-red-400 hidden md:inline">
            {errorMessage}
          </span>
        )}

        <button
          onClick={handleClaim}
          disabled={!hasClaimable || isClaiming || !account}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition ${
            hasClaimable
              ? 'bg-gradient-to-r from-telecom-emerald to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-abyss-950 shadow-emerald-glow'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
          }`}
        >
          {isClaiming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Withdrawing...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Claim Accrued Payout</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
