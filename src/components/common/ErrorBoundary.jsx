import { Component } from 'react';

/** Catches rendering errors so one broken screen can't blank the whole app. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Screen crashed:', error, info && info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card" role="alert">
        <h2>Something went wrong on this screen</h2>
        <p className="muted">Your data is safe: everything you logged is stored on this device and in your Sheet.</p>
        <div className="btn-row">
          <button className="btn btn--primary" onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="btn" onClick={() => window.location.reload()}>Reload app</button>
        </div>
        <details className="archived">
          <summary>Technical details</summary>
          <p className="small">{String((this.state.error && this.state.error.message) || this.state.error)}</p>
        </details>
      </section>
    );
  }
}