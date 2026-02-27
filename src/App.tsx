import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import Takeoff from "./Takeoff";
import Landing from "./Landing";
import CgPage from "./pages/cg/CgPage";
import ConfigPage from "./pages/config/ConfigPage";
import FuelPage from "./pages/fuel/FuelPage";
import CruisePage from "./pages/cruise/CruisePage";
import ClimbCalculator from "./components/ClimbCalculator";
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

// Top navigation order: Config → W&B → Takeoff → Climb → Cruise → Landing
const NAV_ITEMS = [
  { to: "/config", label: "Config" },
  { to: "/cg", label: "W&B" },
  { to: "/takeoff", label: "Takeoff" },
  { to: "/climb", label: "Climb" },
  { to: "/cruise", label: "Cruise" },
  { to: "/landing", label: "Landing" },
] as const;

export default function App() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <ErrorBoundary>
      <header className="app-header">
        <Logo className="tai-logo" />
        <div className="app-header-menu">
          <span className="nav-label">Menu</span>
          <button
            type="button"
            className="nav-toggle"
            onClick={() => setNavOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <span className="nav-toggle-line" />
            <span className="nav-toggle-line" />
            <span className="nav-toggle-line" />
          </button>
          {navOpen && (
            <nav className="page-nav menu-dropdown">
              {NAV_ITEMS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={() => setNavOpen(false)}
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </header>

      <Routes>
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/cg" element={<CgPage />} />
        <Route path="/takeoff" element={<Takeoff />} />
        <Route path="/climb" element={<ClimbCalculator />} />
        <Route path="/cruise" element={<CruisePage />} />
        <Route path="/landing" element={<Landing />} />
        {/* Fuel page kept for direct URL access, but removed from top nav */}
        <Route path="/fuel" element={<FuelPage />} />
        <Route path="*" element={<Navigate to="/config" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
