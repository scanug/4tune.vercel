'use client';

import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log per debug
    console.error('💥 ERROR BOUNDARY CAUGHT:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          color: '#fff',
          background: '#1a1f35',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '3px solid #ef4444',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '600px',
            textAlign: 'center',
          }}>
            <h1 style={{ color: '#fca5a5', marginBottom: '1rem' }}>
              💥 Errore Critico
            </h1>
            <p style={{ color: '#cbd5e1', marginBottom: '1rem' }}>
              Si è verificato un errore durante il caricamento della pagina
            </p>
            
            {this.state.error && (
              <details style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                textAlign: 'left',
              }}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#fca5a5',
                  marginBottom: '0.5rem',
                  fontWeight: 'bold',
                }}>
                  Dettagli Errore
                </summary>
                <pre style={{
                  overflow: 'auto',
                  maxHeight: '200px',
                  fontSize: '0.75rem',
                  color: '#f1f5f9',
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && '\n\n' + this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                border: 'none',
                color: '#fff',
                padding: '0.75rem 2rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              🔄 Ricarica Pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
