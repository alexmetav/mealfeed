import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorData = null;
      try {
        if (this.state.error?.message.includes('FirestoreErrorInfo')) {
           errorData = JSON.parse(this.state.error.message);
        } else if (this.state.error?.message.startsWith('{')) {
           errorData = JSON.parse(this.state.error.message);
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
          <div className="bg-zinc-900 border border-red-500/30 p-6 rounded-2xl max-w-lg w-full shadow-2xl">
            <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h2>
            {errorData ? (
              <div className="space-y-4">
                <p className="text-zinc-600 dark:text-zinc-300 text-sm">A database permission error occurred.</p>
                <div className="bg-zinc-50 dark:bg-black/50 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs text-red-300">
                    {JSON.stringify(errorData, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            )}
            <button
              className="mt-6 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm font-medium"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
