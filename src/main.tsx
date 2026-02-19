import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AircraftProvider } from "./context/AircraftContext";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AircraftProvider>
        <App />
      </AircraftProvider>
    </BrowserRouter>
  </StrictMode>,
);
