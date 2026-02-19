// src/data/envelope.ts
// CG Envelope polygon points: x = CG (m aft of datum), y = Weight (kg)

export const envelope = {
    xLabel: "CG (m aft of datum)",
    yLabel: "Weight (kg)",
  
    // Axis ranges (add a little padding so chart looks nice)
    xMin: 2.30,
    xMax: 2.55,
    yMin: 1500,
    yMax: 2350,
  
    // Polygon points in boundary order (last point repeats first to close)
    polygon: [
      { x: 2.34, y: 1600 },
      { x: 2.34, y: 1800 },
      { x: 2.46, y: 2300 },
      { x: 2.53, y: 2300 },
      { x: 2.51, y: 1999 },
      { x: 2.51, y: 1900 },
      { x: 2.46, y: 1600 },
      { x: 2.34, y: 1600 },
    ],
  };
