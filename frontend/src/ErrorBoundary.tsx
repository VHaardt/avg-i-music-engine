import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", color: "#f66", fontFamily: "monospace", background: "#0d0d0d", height: "100vh" }}>
          <h2>Errore di rendering</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem", color: "#888" }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
