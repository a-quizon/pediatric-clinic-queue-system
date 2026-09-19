import React from "react";
import { PqAuthShell } from "../parent/pqUi";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Uncaught UI error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <PqAuthShell>
        <div className="pq-glass-window overflow-hidden">
          <div className="p-8 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">Something went wrong</h1>
            <p className="pq-muted text-sm mt-3 leading-relaxed">
              Please reload the page to continue.
            </p>
            <button
              type="button"
              className="pq-btn-primary w-full mt-6"
              onClick={this.handleReload}
            >
              Reload
            </button>
          </div>
        </div>
      </PqAuthShell>
    );
  }
}
