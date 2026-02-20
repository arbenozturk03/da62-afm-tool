import { Component, type ErrorInfo, type ReactNode } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import Takeoff from "./Takeoff";
import Landing from "./Landing";
import CgPage from "./pages/cg/CgPage";
import ConfigPage from "./pages/config/ConfigPage";
import FuelPage from "./pages/fuel/FuelPage";
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

// Top navigation order: Config → W&B → Takeoff → Landing
const NAV_ITEMS = [
  { to: "/config", label: "Config" },
  { to: "/cg", label: "W&B" },
  { to: "/takeoff", label: "Takeoff" },
  { to: "/landing", label: "Landing" },
] as const;

export default function App() {
  return (
    <ErrorBoundary>
      <header className="app-header">
        <Logo className="tai-logo" />
        <nav className="page-nav">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <Routes>
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/cg" element={<CgPage />} />
        <Route path="/takeoff" element={<Takeoff />} />
        <Route path="/landing" element={<Landing />} />
        {/* Fuel page kept for direct URL access, but removed from top nav */}
        <Route path="/fuel" element={<FuelPage />} />
        <Route path="*" element={<Navigate to="/config" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
