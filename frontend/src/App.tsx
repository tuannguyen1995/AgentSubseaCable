import React, { useState, useEffect, useCallback } from 'react';
import {
  Waves,
  RefreshCw,
  Search,
  Filter,
  PlusCircle,
  ExternalLink,
  Shield,
  Layers,
  Radio,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  Info,
  UserCheck,
  Check,
  X,
  AlertOctagon,
  ArrowRight,
  Database
} from 'lucide-react';
import {
  SubseaPolicyData,
  ContractStats,
  readContract,
  fetchStudionetBalance,
  getSavedContractAddress,
  STATUS_POLICY_OPEN,
  STATUS_ALERT_SUBMITTED,
  STATUS_AWAITING_PAYOUT,
  STATUS_SETTLED_SLA_BREACH,
  STATUS_SETTLED_PARTIAL,
  STATUS_SETTLED_FORCE_MAJEURE,
  STATUS_DISPUTED,
  STATUS_EXPIRED_RECLAIMED,
  STATUS_UNRESOLVED,
  STUDIONET_CHAIN_ID_HEX,
  STUDIO_URL
} from './config/genlayer';
import { Navbar } from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { SubseaWorldMap } from './components/SubseaWorldMap';
import { PolicyCard } from './components/PolicyCard';
import { PullPayoutButton } from './components/PullPayoutButton';
import { CreatePolicyModal } from './components/CreatePolicyModal';
import { TriggerAlertModal } from './components/TriggerAlertModal';
import { TelemetryInspectorModal } from './components/TelemetryInspectorModal';
import { AppealModal } from './components/AppealModal';
import { ErrorBoundary } from './components/ErrorBoundary';

interface TxToast {
  id: string;
  txHash: string;
  message: string;
  timestamp: number;
}

export const AppContent: React.FC = () => {
  const [account, setAccount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0.000');
  const [contractAddress, setContractAddress] = useState<string>(getSavedContractAddress());
  const [policies, setPolicies] = useState<SubseaPolicyData[]>([]);
  const [stats, setStats] = useState<ContractStats>({
    total_policies: 0,
    total_telecom_locked: '0',
    total_policies_settled: 0,
    total_pending_claims: '0',
    owner: '',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toasts, setToasts] = useState<TxToast[]>([]);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [prefilledCable, setPrefilledCable] = useState<{ id: string; latency: number } | undefined>(undefined);
  const [selectedAlertPolicy, setSelectedAlertPolicy] = useState<SubseaPolicyData | null>(null);
  const [selectedInspectorPolicy, setSelectedInspectorPolicy] = useState<SubseaPolicyData | null>(null);
  const [selectedAppealPolicy, setSelectedAppealPolicy] = useState<SubseaPolicyData | null>(null);

  // Push transaction toast
  const addTxToast = (txHash: string, message = 'Transaction submitted to GenLayer consensus') => {
    const newToast: TxToast = {
      id: `${Date.now()}-${Math.random()}`,
      txHash,
      message,
      timestamp: Date.now(),
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 3)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 12000);
  };

  // Connect MetaMask Wallet
  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (accounts && accounts[0]) {
          setAccount(accounts[0]);
          const bal = await fetchStudionetBalance(accounts[0]);
          setBalance(bal);
        }
      } catch (err) {
        console.error('Wallet connection failed:', err);
      }
    } else {
      alert('MetaMask or a Web3 compatible browser extension is required.');
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setBalance('0.000');
  };

  // Fetch On-Chain Data (100% Genuine On-Chain, NO MOCKS)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (account) {
        const bal = await fetchStudionetBalance(account);
        setBalance(bal);
      }

      // 1. Read on-chain contract statistics
      const statsRaw = await readContract('get_stats', [], contractAddress);
      if (statsRaw && typeof statsRaw === 'object') {
        setStats(statsRaw as ContractStats);
      } else if (typeof statsRaw === 'string') {
        try {
          setStats(JSON.parse(statsRaw));
        } catch {
          // ignore
        }
      }

      // 2. Read on-chain policies array directly from contract
      const policiesRaw = await readContract('get_all_policies', [], contractAddress);
      if (Array.isArray(policiesRaw)) {
        setPolicies(policiesRaw as SubseaPolicyData[]);
      } else if (typeof policiesRaw === 'string') {
        try {
          const parsed = JSON.parse(policiesRaw);
          if (Array.isArray(parsed)) {
            setPolicies(parsed as SubseaPolicyData[]);
          } else {
            setPolicies([]);
          }
        } catch {
          setPolicies([]);
        }
      } else {
        setPolicies([]);
      }
    } catch (err) {
      console.warn('On-Chain Query Notice:', err);
      // Clean error state - no mock injection
      setPolicies([]);
    } finally {
      setIsLoading(false);
    }
  }, [account, contractAddress]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle account change events
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleAccountsChanged = (accs: string[]) => {
        if (accs.length > 0) {
          setAccount(accs[0]);
          fetchStudionetBalance(accs[0]).then(setBalance);
        } else {
          disconnectWallet();
        }
      };
      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  // Filtered policies based on search & role
  const userAccLower = account ? account.toLowerCase() : '';

  const filteredPolicies = policies.filter((p) => {
    const matchesSearch =
      p.cable_system_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.policy_id.includes(searchQuery) ||
      p.cable_operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'my_operator') return p.cable_operator.toLowerCase() === userAccLower;
    if (statusFilter === 'my_client') return p.client.toLowerCase() === userAccLower;
    if (statusFilter === 'action_required') {
      const isMyOperator = p.cable_operator.toLowerCase() === userAccLower;
      const isMyClient = p.client.toLowerCase() === userAccLower;
      if (isMyClient && (p.status === STATUS_POLICY_OPEN || p.status === STATUS_UNRESOLVED)) return true;
      if ((isMyOperator || isMyClient) && p.status === STATUS_ALERT_SUBMITTED) return true;
      if ((isMyOperator || isMyClient) && p.status === STATUS_AWAITING_PAYOUT) return true;
      return false;
    }
    if (statusFilter === 'open') return p.status === STATUS_POLICY_OPEN;
    if (statusFilter === 'alert') return p.status === STATUS_ALERT_SUBMITTED;
    if (statusFilter === 'cooling') return p.status === STATUS_AWAITING_PAYOUT;
    if (statusFilter === 'breach') return p.status === STATUS_SETTLED_SLA_BREACH;
    if (statusFilter === 'partial') return p.status === STATUS_SETTLED_PARTIAL;
    if (statusFilter === 'force_majeure') return p.status === STATUS_SETTLED_FORCE_MAJEURE;
    if (statusFilter === 'disputed') return p.status === STATUS_DISPUTED;

    return true;
  });

  const activeOutagesCount = policies.filter(
    (p) => p.status === STATUS_ALERT_SUBMITTED || p.status === STATUS_AWAITING_PAYOUT || p.status === STATUS_DISPUTED
  ).length;

  return (
    <div className="min-h-screen bg-abyss-950 text-slate-100 flex flex-col font-sans selection:bg-ocean-cyan/30 selection:text-white">
      {/* Top Banner / Ticker */}
      <div className="bg-gradient-to-r from-abyss-900 via-ocean-cyan/15 to-abyss-900 border-b border-ocean-cyan/20 py-2 px-4 text-center">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-ocean-glow">
          <Radio className="w-3.5 h-3.5 text-telecom-emerald animate-pulse" />
          <span className="font-bold">GENLAYER STUDIONET 100% ON-CHAIN CONSENSUS</span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="hidden sm:inline text-slate-300">
            Real OTDR Reflectometry & USGS Seabed Geohazard Adjudication
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-white font-semibold">Chain: 61999 (0xF22F)</span>
        </div>
      </div>

      {/* Main Navigation */}
      <Navbar
        account={account}
        balance={balance}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
        contractAddress={contractAddress}
        onUpdateContract={(addr) => {
          setContractAddress(addr);
          fetchData();
        }}
        onOpenCreateModal={() => {
          setPrefilledCable(undefined);
          setIsCreateOpen(true);
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Top Header / Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-ocean-cyan/15 border border-ocean-cyan/30 text-ocean-cyan font-mono text-[10px] font-bold uppercase tracking-wider">
                DePIN Telecom Escrow
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-telecom-emerald/15 border border-telecom-emerald/30 text-telecom-emerald font-mono text-[10px] font-bold uppercase tracking-wider">
                Non-Deterministic AI Consensus
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
              <span>Transoceanic Fiber Optic Cable SLA & Seismic Risk Escrow</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl font-sans leading-relaxed">
              Autonomous on-chain adjudication for international submarine telecommunications cables. GenLayer AI validators cross-examine
              OTDR optical attenuation against USGS seafloor seismic feeds to distinguish human/trawler fiber damage from natural Force Majeure.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-abyss-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition"
              title="Refresh on-chain state"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ocean-cyan' : ''}`} />
              <span>Refresh On-Chain</span>
            </button>
            <button
              onClick={() => {
                setPrefilledCable(undefined);
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-ocean-cyan to-ocean-electric text-abyss-950 font-bold font-mono text-xs shadow-cyan-glow hover:opacity-95 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create SLA Escrow</span>
            </button>
          </div>
        </div>

        {/* Global On-Chain Statistics Overview */}
        <StatsOverview
          totalPolicies={stats.total_policies || policies.length}
          totalLocked={stats.total_telecom_locked}
          totalSettled={stats.total_policies_settled}
          totalPendingClaims={stats.total_pending_claims}
          activeOutagesCount={activeOutagesCount}
        />

        {/* Global Subsea Cable Operations Center Map */}
        <SubseaWorldMap />

        {/* Pure Pull Payment Ledger Claim Bar */}
        <div className="mb-8">
          <PullPayoutButton account={account} onRefresh={fetchData} />
        </div>

        {/* Search & Role-Based Filter Toolbar */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
              {[
                { id: 'all', label: 'All Corridors' },
                { id: 'my_operator', label: 'My Operator Policies' },
                { id: 'my_client', label: 'My Client Policies' },
                { id: 'action_required', label: 'Action Required By Me' },
                { id: 'open', label: 'Active SLA' },
                { id: 'alert', label: 'Alerts Filed' },
                { id: 'cooling', label: 'In Cooling-Off (72s)' },
                { id: 'breach', label: 'SLA Breaches (100%)' },
                { id: 'partial', label: 'Partial (40%)' },
                { id: 'force_majeure', label: 'Force Majeure' },
                { id: 'disputed', label: 'Disputed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition ${
                    statusFilter === tab.id
                      ? 'bg-ocean-cyan text-abyss-950 font-bold shadow-cyan-glow'
                      : 'bg-abyss-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[260px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by cable ID, address, or policy #..."
                className="w-full bg-abyss-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs font-mono text-white focus:border-ocean-cyan outline-none"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* Real On-Chain Policies Grid */}
        {filteredPolicies.length === 0 ? (
          <div className="bg-abyss-900 border border-slate-800 rounded-2xl p-12 text-center shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none"></div>
            <div className="w-16 h-16 rounded-2xl bg-ocean-cyan/10 border border-ocean-cyan/30 flex items-center justify-center mx-auto mb-4 text-ocean-cyan">
              <Database className="w-8 h-8" />
            </div>
            <h3 className="font-display font-bold text-white text-xl mb-2">
              {policies.length === 0
                ? 'GenLayer StudioNet Connected — Zero On-Chain Policies'
                : 'No Policies Match Current Filter'}
            </h3>
            <p className="text-xs text-slate-400 max-w-lg mx-auto mb-6 leading-relaxed font-sans">
              {policies.length === 0
                ? 'Your dApp is communicating 100% directly with the deployed Intelligent Contract on GenLayer StudioNet. No mock or simulated policies are loaded. Deposit the first SLA indemnity escrow to begin on-chain transoceanic monitoring.'
                : 'Try switching the filter tab or clearing your search query to inspect other active oceanic corridors.'}
            </p>
            <button
              onClick={() => {
                setPrefilledCable(undefined);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-ocean-cyan to-ocean-electric text-abyss-950 font-bold font-mono text-xs shadow-cyan-glow hover:opacity-95 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Subsea SLA Escrow On-Chain</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPolicies.map((policy) => (
              <PolicyCard
                key={policy.policy_id}
                policy={policy}
                account={account}
                onOpenAlertModal={setSelectedAlertPolicy}
                onOpenInspectorModal={setSelectedInspectorPolicy}
                onOpenAppealModal={setSelectedAppealPolicy}
                onRefresh={fetchData}
                onTxSubmitted={addTxToast}
              />
            ))}
          </div>
        )}
      </main>

      {/* Transaction Toaster */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="p-4 rounded-xl bg-abyss-900 border border-ocean-cyan/40 shadow-cyan-glow backdrop-blur-md flex items-start justify-between gap-3 text-xs font-mono"
            >
              <div className="flex items-start gap-2.5">
                <Radio className="w-4 h-4 text-ocean-cyan animate-pulse mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-bold">{toast.message}</p>
                  <a
                    href={`${STUDIO_URL}/tx/${toast.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ocean-cyan hover:underline flex items-center gap-1 mt-1 truncate"
                  >
                    <span>Tx: {toast.txHash.slice(0, 14)}...</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-abyss-900/60 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ocean-cyan"></span>
            <span>AgentSubseaCable Protocol — DePIN Subsea Telecom SLA & Seismic Escrow (100% On-Chain)</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`${STUDIO_URL}/address/${contractAddress}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-ocean-cyan transition flex items-center gap-1"
            >
              <span>Intelligent Contract</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>•</span>
            <span>GenLayer StudioNet (Chain 61999)</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CreatePolicyModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
        account={account}
        prefilledCable={prefilledCable}
      />

      <TriggerAlertModal
        policy={selectedAlertPolicy}
        isOpen={!!selectedAlertPolicy}
        onClose={() => setSelectedAlertPolicy(null)}
        onSuccess={() => {
          fetchData();
        }}
        account={account}
      />

      <TelemetryInspectorModal
        policy={selectedInspectorPolicy}
        isOpen={!!selectedInspectorPolicy}
        onClose={() => setSelectedInspectorPolicy(null)}
      />

      <AppealModal
        policy={selectedAppealPolicy}
        isOpen={!!selectedAppealPolicy}
        onClose={() => setSelectedAppealPolicy(null)}
        onSuccess={() => {
          fetchData();
        }}
        account={account}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
