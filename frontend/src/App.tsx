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
  Info
} from 'lucide-react';
import {
  SubseaPolicyData,
  ContractStats,
  readContract,
  fetchStudionetBalance,
  getSavedContractAddress,
  MOCK_POLICIES,
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

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [selectedAlertPolicy, setSelectedAlertPolicy] = useState<SubseaPolicyData | null>(null);
  const [selectedInspectorPolicy, setSelectedInspectorPolicy] = useState<SubseaPolicyData | null>(null);
  const [selectedAppealPolicy, setSelectedAppealPolicy] = useState<SubseaPolicyData | null>(null);

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

  // Fetch On-Chain Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (account) {
        const bal = await fetchStudionetBalance(account);
        setBalance(bal);
      }

      // Read contract statistics
      const statsRaw = await readContract('get_stats', [], contractAddress);
      if (statsRaw && typeof statsRaw === 'object') {
        setStats(statsRaw as ContractStats);
      }

      // Read all policies
      const policiesRaw = await readContract('get_all_policies', [], contractAddress);
      if (Array.isArray(policiesRaw) && policiesRaw.length > 0) {
        setPolicies(policiesRaw as SubseaPolicyData[]);
      } else {
        // Fallback to rich pre-loaded simulated data if contract storage is fresh
        setPolicies(MOCK_POLICIES);
        setStats((prev) => ({
          ...prev,
          total_policies: MOCK_POLICIES.length,
          total_telecom_locked: '10500000000000000000',
          total_policies_settled: 2,
        }));
      }
    } catch (err) {
      console.warn('Network call fallback to simulated dataset:', err);
      setPolicies(MOCK_POLICIES);
      setStats({
        total_policies: MOCK_POLICIES.length,
        total_telecom_locked: '10500000000000000000',
        total_policies_settled: 2,
        total_pending_claims: '3000000000000000000',
        owner: '0xF34587A45C397281Ef6BDd839d4A1de2DEe393ad',
      });
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

  // Filtered policies
  const filteredPolicies = policies.filter((p) => {
    const matchesSearch =
      p.cable_system_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.policy_id.includes(searchQuery) ||
      p.cable_operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
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
    <div className="min-h-screen bg-abyss-950 text-slate-100 flex flex-col font-sans">
      {/* Top Banner / Ticker */}
      <div className="bg-gradient-to-r from-abyss-900 via-ocean-cyan/15 to-abyss-900 border-b border-ocean-cyan/20 py-1.5 px-4 text-center">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-[11px] font-mono text-ocean-glow">
          <Radio className="w-3.5 h-3.5 text-telecom-emerald animate-pulse" />
          <span>SUBSEA NOC CONSENSUS LAYER ACTIVE</span>
          <span className="text-slate-600">|</span>
          <span className="hidden sm:inline text-slate-300">
            Real-Time USGS Seismology & RIPE Atlas Optical Reflectometry (OTDR)
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-white font-semibold">Chain ID: 61999 (0xF22F)</span>
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
        onOpenCreateModal={() => setIsCreateOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Top Header / Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
              <span>Transoceanic Fiber Optic SLA Escrow</span>
              <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-ocean-cyan/10 border border-ocean-cyan/30 text-ocean-cyan">
                Parametric Risk Protection
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl font-sans">
              Autonomous on-chain resolution for subsea telecommunications disruptions. AI consensus tribunal cross-references
              OTDR optical attenuation against USGS seabed earthquake telemetry to distinguish technician SLA breaches from natural Force Majeure.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-abyss-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ocean-cyan' : ''}`} />
              <span>Refresh NOC</span>
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-ocean-cyan to-ocean-electric text-abyss-950 font-semibold text-xs shadow-cyan-glow hover:opacity-95 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create SLA Escrow</span>
            </button>
          </div>
        </div>

        {/* Global Statistics */}
        <StatsOverview
          totalPolicies={stats.total_policies || policies.length}
          totalLocked={stats.total_telecom_locked}
          totalSettled={stats.total_policies_settled}
          totalPendingClaims={stats.total_pending_claims}
          activeOutagesCount={activeOutagesCount}
        />

        {/* Global Subsea Cable Operations Center Map */}
        <SubseaWorldMap />

        {/* Pull Payment Ledger Claim Bar */}
        <div className="mb-8">
          <PullPayoutButton account={account} onRefresh={fetchData} />
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Corridors' },
              { id: 'open', label: 'Active SLA' },
              { id: 'alert', label: 'Alerts Filed' },
              { id: 'cooling', label: 'Cooling-Off' },
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
          <div className="relative min-w-[240px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cable ID, policy or address..."
              className="w-full bg-abyss-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs font-mono text-white focus:border-ocean-cyan outline-none"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Policy Grid */}
        {filteredPolicies.length === 0 ? (
          <div className="bg-abyss-900 border border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4 text-slate-500">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="font-display font-bold text-white text-lg mb-1">
              No Subsea Cable Corridors Found
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
              No active SLA escrow policies match your query. Create a new SLA escrow to protect transoceanic capacity.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-ocean-cyan text-abyss-950 text-xs font-mono font-bold hover:bg-ocean-electric transition"
            >
              Deposit SLA Indemnity Escrow
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
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-abyss-900/60 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ocean-cyan"></span>
            <span>AgentSubseaCable Protocol — DePIN Subsea Telecom SLA & Seismic Escrow</span>
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
        onSuccess={fetchData}
        account={account}
      />

      <TriggerAlertModal
        policy={selectedAlertPolicy}
        isOpen={!!selectedAlertPolicy}
        onClose={() => setSelectedAlertPolicy(null)}
        onSuccess={fetchData}
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
        onSuccess={fetchData}
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
