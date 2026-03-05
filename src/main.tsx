import * as React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0f0f1a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: 'white', padding: '20px', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>👑</div>
            <div style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#facc15' }}>Король парковки</div>
            <div style={{ color: '#9ca3af', marginBottom: '16px', fontSize: '0.9rem' }}>Ошибка загрузки</div>
            <div style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '16px', maxWidth: '400px', wordBreak: 'break-all' }}>{this.state.error.message}</div>
            <button onClick={() => window.location.reload()} style={{ background: '#facc15', color: '#0f0f1a', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}>
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root") ?? document.body;
createRoot(rootEl).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
