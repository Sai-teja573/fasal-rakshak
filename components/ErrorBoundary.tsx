
import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 p-6 text-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100 dark:border-red-900">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400 text-2xl">
              ⚠️
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              The application encountered an unexpected error. We have logged this issue.
            </p>
            <div className="p-4 bg-slate-100 dark:bg-slate-950 rounded-lg mb-6 text-left overflow-auto max-h-32 text-xs font-mono text-slate-600 dark:text-slate-400">
               {this.state.error?.message}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
