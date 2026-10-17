import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the console useful during development. No error content is sent to a server.
    console.error('[uniscope] rendering error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container page page--narrow">
        <header className="page-head">
          <p className="eyebrow">Something broke</p>
          <h1>This page could not be displayed</h1>
          <p className="page-sub">
            UniScope stopped rendering to avoid showing partial or misleading information. Your locally saved shortlist
            has not been changed.
          </p>
        </header>
        <div className="state-block state-block--error" role="alert">
          <div className="state-block__icon" aria-hidden="true">!</div>
          <div>
            <h2>What you can try</h2>
            <p>Reload the page. If it keeps happening, open search and continue from there.</p>
            <div className="button-row">
              <button type="button" className="button" onClick={() => window.location.reload()}>
                Reload
              </button>
              <a className="button button--secondary" href="/search">Go to search</a>
              <a className="button button--ghost" href="/report">Report a problem</a>
            </div>
          </div>
        </div>
        <p className="cell-note">
          If you installed the app, an old cached version can occasionally conflict with a new one. Closing and
          reopening the app, or reloading once online, usually resolves it.
        </p>
      </div>
    );
  }
}
