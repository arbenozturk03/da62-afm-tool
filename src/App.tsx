import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import Takeoff from "./Takeoff";
import Landing from "./Landing";
import Logo from "./Logo";
import "./App.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{ padding: 30, fontFamily: "system-ui" }}>
          <h1>Something went wrong</h1>
          <pre style={{ color: "#c00", overflow: "auto" }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [page, setPage] = useState<"takeoff" | "landing">("takeoff");

  return (
    <ErrorBoundary>
      <header className="app-header">
        <Logo className="tai-logo" />
        <nav className="page-nav">
          <button
            className={page === "takeoff" ? "active" : ""}
            onClick={() => setPage("takeoff")}
          >
            Takeoff
          </button>
          <button
            className={page === "landing" ? "active" : ""}
            onClick={() => setPage("landing")}
          >
            Landing
          </button>
        </nav>
      </header>
      {page === "takeoff" ? <Takeoff /> : <Landing />}
    </ErrorBoundary>
  );
}
