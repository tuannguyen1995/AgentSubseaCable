import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in AgentSubseaCable dApp:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-abyss-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-abyss-900 border border-red-500/30 rounded-2xl p-8 text-center shadow-crimson-glow">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold font-display text-white mb-2">
              NOC Telemetry Interface Alert
            </h2>
            <p className="text-sm text-slate-400 mb-6 font-sans">
              An unexpected interface anomaly occurred while communicating with the GenLayer consensus network.
            </p>
            <div className="bg-abyss-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-red-400 mb-6 text-left break-all">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-ocean-cyan hover:bg-ocean-electric text-abyss-950 font-semibold rounded-xl transition duration-200"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Network Terminal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
