import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { 
  children: ReactNode; 
}

interface State { 
  hasError: boolean; 
  error?: Error; 
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-8">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
          <p className="text-gray-400 mb-6">{this.state.error?.message}</p>
          <button 
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="px-6 py-3 bg-cyan-500 text-black rounded-lg font-bold hover:bg-cyan-400 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}