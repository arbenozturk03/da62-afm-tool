import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AircraftProvider } from "./context/AircraftContext";
import { PerformanceProvider } from "./context/PerformanceContext";
import "./index.css";
import App from "./App.tsx";

// Warm-up: preload cabin image so it’s cached before user opens W&B
if (typeof window !== "undefined") {
  const cabinImg = new Image();
  cabinImg.src = "/cabin-desktop.webp";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AircraftProvider>
        <PerformanceProvider>
          <App />
        </PerformanceProvider>
      </AircraftProvider>
    </BrowserRouter>
  </StrictMode>,
);
