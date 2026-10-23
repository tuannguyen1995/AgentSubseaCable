export function formatGen(val: string | number | bigint | undefined | null): string {
  if (val === undefined || val === null) return '0.000';
  try {
    let numStr = String(val).trim();
    if (numStr.startsWith('0x') || numStr.startsWith('0X')) {
      const bInt = BigInt(numStr);
      const dec = Number(bInt) / 1e18;
      return dec.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 4 });
    }
    const bInt = BigInt(numStr);
    const dec = Number(bInt) / 1e18;
    return dec.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 4 });
  } catch {
    const parsed = parseFloat(String(val));
    return isNaN(parsed) ? '0.000' : parsed.toFixed(3);
  }
}

export function formatAddress(addr: string | undefined | null): string {
  if (!addr) return '0x0000...0000';
  const clean = addr.trim();
  if (clean.length <= 10) return clean;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

export function formatTimestamp(ts: string | number | bigint | undefined | null): string {
  if (!ts) return 'N/A';
  try {
    const num = Number(ts);
    if (num === 0) return 'None';
    const date = new Date(num * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return String(ts);
  }
}

export function formatRichter(magnitudeX10: number): string {
  if (!magnitudeX10 || magnitudeX10 === 0) return '0.0 (None)';
  const mag = (magnitudeX10 / 10).toFixed(1);
  if (magnitudeX10 >= 55) {
    return `${mag} Richter (FORCE MAJEURE)`;
  }
  return `${mag} Richter`;
}

export function formatLatency(latencyMs: number, slaMs?: number): { text: string; status: 'normal' | 'warning' | 'severe' } {
  if (latencyMs >= 5000) {
    return { text: `${latencyMs} ms (FULL FIBER CUT)`, status: 'severe' };
  }
  if (slaMs && latencyMs >= slaMs * 2) {
    return { text: `${latencyMs} ms (CRITICAL SLA BREACH)`, status: 'severe' };
  }
  if (slaMs && latencyMs > slaMs) {
    return { text: `${latencyMs} ms (MODERATE DEGRADATION)`, status: 'warning' };
  }
  return { text: `${latencyMs} ms (COMPLIANT)`, status: 'normal' };
}

export function getStatusMeta(status: number): { label: string; bg: string; text: string; border: string } {
  switch (status) {
    case 0:
      return {
        label: 'POLICY ACTIVE',
        bg: 'bg-ocean-cyan/10',
        text: 'text-ocean-cyan',
        border: 'border-ocean-cyan/30',
      };
    case 1:
      return {
        label: 'ALERT SUBMITTED',
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
    case 2:
      return {
        label: 'AWAITING PAYOUT (COOLING-OFF)',
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500/30',
      };
    case 3:
      return {
        label: 'SETTLED: SLA BREACH (100%)',
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
    case 4:
      return {
        label: 'SETTLED: PARTIAL (40%)',
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
    case 5:
      return {
        label: 'SETTLED: FORCE MAJEURE',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 6:
      return {
        label: 'UNDER APPEAL DISPUTE',
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
      };
    case 7:
      return {
        label: 'EXPIRED & RECLAIMED',
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
    case 8:
      return {
        label: 'UNRESOLVED (PROTECTED)',
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
      };
    default:
      return {
        label: 'UNKNOWN',
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
  }
}
