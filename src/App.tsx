import { Component, type ErrorInfo, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Takeoff from "./Takeoff";
import Landing from "./Landing";
import CgPage from "./pages/cg/CgPage";
import ConfigPage from "./pages/config/ConfigPage";
import FuelPage from "./pages/fuel/FuelPage";
import Logo from "./Logo";
import AppLayout from "./layout/AppLayout";
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
  return (
    <ErrorBoundary>
      <header className="app-header">
        <Logo className="tai-logo" />
      </header>

      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/wb" element={<CgPage />} />
          <Route path="/takeoff" element={<Takeoff />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/fuel" element={<FuelPage />} />
          <Route path="*" element={<Navigate to="/config" replace />} />
        </Route>
        {/* Backward compat: /cg -> /wb */}
        <Route path="/cg" element={<Navigate to="/wb" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
