import React, { useState } from 'react';
import {
  Shield,
  Activity,
  Wallet,
  ExternalLink,
  Edit2,
  Check,
  Radio,
  PlusCircle,
  Waves
} from 'lucide-react';
import {
  STUDIONET_CHAIN_ID_HEX,
  STUDIONET_CHAIN_ID,
  STUDIONET_RPC_URL,
  STUDIO_URL,
  getSavedContractAddress,
  saveContractAddress,
} from '../config/genlayer';
import { formatAddress } from '../utils/formatters';

interface NavbarProps {
  account: string;
  balance: string;
  onConnect: () => void;
  onDisconnect: () => void;
  contractAddress: string;
  onUpdateContract: (addr: string) => void;
  onOpenCreateModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  account,
  balance,
  onConnect,
  onDisconnect,
  contractAddress,
  onUpdateContract,
  onOpenCreateModal,
}) => {
  const [isEditingContract, setIsEditingContract] = useState(false);
  const [tempAddress, setTempAddress] = useState(contractAddress);

  const handleSaveContract = () => {
    if (tempAddress.trim().startsWith('0x') && tempAddress.trim().length === 42) {
      saveContractAddress(tempAddress.trim());
      onUpdateContract(tempAddress.trim());
      setIsEditingContract(false);
    } else {
      alert('Please enter a valid 42-character GenLayer contract address.');
    }
  };

  const handleSwitchNetwork = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          try {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: STUDIONET_CHAIN_ID_HEX,
                  chainName: 'GenLayer StudioNet',
                  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
                  rpcUrls: [STUDIONET_RPC_URL],
                  blockExplorerUrls: [STUDIO_URL],
                },
              ],
            });
          } catch (addError) {
            console.error('Failed to add StudioNet:', addError);
          }
        }
      }
    }
  };

  return (
    <nav className="border-b border-ocean-cyan/20 bg-abyss-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-abyss-800 to-abyss-950 border border-ocean-cyan/40 flex items-center justify-center shadow-cyan-glow">
                <Waves className="w-6 h-6 text-ocean-cyan animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-telecom-emerald opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-telecom-emerald"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-xl tracking-wide bg-gradient-to-r from-white via-slate-200 to-ocean-glow bg-clip-text text-transparent">
                  AgentSubseaCable
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-md bg-ocean-cyan/15 text-ocean-cyan border border-ocean-cyan/30">
                  NOC v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans hidden sm:block">
                Autonomous Transoceanic Fiber Optic Cable SLA & Seismic Risk Escrow
              </p>
            </div>
          </div>

          {/* Center: Live Network Status */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={handleSwitchNetwork}
              title="Click to switch to GenLayer StudioNet"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-abyss-800 border border-slate-700 hover:border-ocean-cyan/50 text-xs font-mono text-slate-300 transition"
            >
              <Radio className="w-3.5 h-3.5 text-telecom-emerald animate-pulse" />
              <span>StudioNet (61999)</span>
            </button>

            {/* Contract Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-abyss-800 border border-slate-700 text-xs font-mono text-slate-300">
              <Shield className="w-3.5 h-3.5 text-ocean-cyan" />
              {isEditingContract ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempAddress}
                    onChange={(e) => setTempAddress(e.target.value)}
                    className="bg-abyss-950 border border-ocean-cyan rounded px-2 py-0.5 text-xs text-white w-48 font-mono outline-none"
                    placeholder="0x..."
                  />
                  <button
                    onClick={handleSaveContract}
                    className="p-1 hover:text-telecom-emerald text-slate-400"
                    title="Save"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Contract:</span>
                  <span className="text-slate-200 font-semibold">{formatAddress(contractAddress)}</span>
                  <button
                    onClick={() => {
                      setTempAddress(contractAddress);
                      setIsEditingContract(true);
                    }}
                    className="p-0.5 hover:text-ocean-cyan text-slate-400"
                    title="Edit Contract Address"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <a
                    href={`${STUDIO_URL}/address/${contractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-0.5 hover:text-ocean-cyan text-slate-400"
                    title="View on GenLayer Studio"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Right Actions: Create SLA & Wallet */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenCreateModal}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-ocean-cyan to-ocean-electric text-abyss-950 font-semibold text-sm shadow-cyan-glow hover:opacity-95 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create SLA Escrow</span>
            </button>

            {account ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">Available</span>
                  <span className="text-xs font-mono font-bold text-ocean-glow">
                    {balance} GEN
                  </span>
                </div>
                <div className="relative group">
                  <button
                    onClick={onDisconnect}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-abyss-800 border border-ocean-cyan/30 text-xs font-mono text-slate-200 hover:border-red-400/50 transition"
                  >
                    <div className="w-2 h-2 rounded-full bg-telecom-emerald"></div>
                    <span>{formatAddress(account)}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={onConnect}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-abyss-800 border border-ocean-cyan/40 hover:border-ocean-cyan text-ocean-cyan font-mono text-xs font-semibold transition shadow-cyan-glow"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect NOC Wallet</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
